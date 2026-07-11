"""
WebSocket endpoint that proxies audio between the browser and Gemini Live API.

Architecture:
  Browser (mic PCM 16kHz) → FastAPI WS → Gemini Live API WSS
  Browser (speakers)      ← FastAPI WS ← Gemini Live API WSS

The backend injects RAG context into the Gemini system instruction so the
voice interviewer has domain knowledge from uploaded documents.
Transcriptions are relayed back to the browser for display and later saved
to the DB when the session completes.
"""

import asyncio
import json
import logging
import base64

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import websockets

from app.config import get_settings
from app.database import SessionLocal
from app.services.interview_service import interview_service
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/interviews", tags=["Voice Interview"])

GEMINI_LIVE_MODEL = "gemini-3.1-flash-live-preview"
GEMINI_WS_URL = (
    "wss://generativelanguage.googleapis.com/ws/"
    "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
    f"?key={settings.GEMINI_API_KEY}"
)


def _build_system_instruction(config, rag_context: str) -> str:
    """Build a system instruction for the voice interviewer."""
    topics_str = ", ".join(config.topics) if config.topics else "General"
    return f"""You are an expert technical interviewer conducting a live voice interview.

**INTERVIEW PARAMETERS:**
- Title: {config.title}
- Topics: {topics_str}
- Difficulty: {config.difficulty.value.upper()}
- Total Questions: {config.num_questions}

**REFERENCE MATERIAL:**
{rag_context}

**RULES:**
1. Start by welcoming the candidate and briefly explaining the interview format.
2. Ask one question at a time. Wait for the candidate to finish answering before moving on.
3. After each answer, give brief constructive feedback (1-2 sentences).
4. Keep track of the question count. After {config.num_questions} questions, wrap up the interview.
5. Match the difficulty level:
   - EASY: Basic concepts, definitions
   - MEDIUM: Application-level, "how" and "why" questions
   - HARD: System design, edge cases, trade-offs
6. Be professional, encouraging, and conversational.
7. If the candidate's audio is unclear or there's noise, politely ask them to repeat.
8. Base your questions on the reference material when available.
9. Do NOT ask yes/no questions.
10. Vary the topics across questions to cover breadth.
11. At the end, provide a brief overall summary of the candidate's performance.
"""


@router.websocket("/{session_id}/voice")
async def voice_interview(ws: WebSocket, session_id: str):
    """
    WebSocket endpoint for voice-based interviews.

    Protocol (browser → server):
      {"type": "audio", "data": "<base64 PCM 16kHz>"}
      {"type": "end"}

    Protocol (server → browser):
      {"type": "audio", "data": "<base64 PCM 24kHz>"}
      {"type": "transcript_user", "text": "..."}
      {"type": "transcript_ai", "text": "..."}
      {"type": "turn_complete"}
      {"type": "error", "message": "..."}
      {"type": "session_started"}
    """
    await ws.accept()
    logger.info(f"Voice interview WebSocket connected: session={session_id}")

    # Load session and config from DB
    db = SessionLocal()
    try:
        session = interview_service.get_session(db, session_id)
        if not session:
            await ws.send_json({"type": "error", "message": "Session not found"})
            await ws.close()
            return

        config = session.configuration

        # Retrieve RAG context
        document_ids = config.document_ids if config.document_ids else None
        topics_str = ", ".join(config.topics) if config.topics else "General"
        query = f"{topics_str} interview questions {config.difficulty.value}"
        retrieved_chunks = rag_service.retrieve(
            query=query, n_results=10, document_ids=document_ids
        )
        rag_context = "\n\n".join([
            f"[Reference {i+1}]: {chunk['text']}"
            for i, chunk in enumerate(retrieved_chunks)
        ]) if retrieved_chunks else "No specific reference material available."

        system_instruction = _build_system_instruction(config, rag_context)
    finally:
        db.close()

    # Connect to Gemini Live API
    gemini_ws = None
    try:
        gemini_ws = await websockets.connect(
            GEMINI_WS_URL,
            max_size=10 * 1024 * 1024,  # 10MB max message size
            ping_interval=30,
            ping_timeout=10,
        )
        logger.info(f"Connected to Gemini Live API for session {session_id}")

        # Send setup message
        setup_message = {
            "setup": {
                "model": f"models/{GEMINI_LIVE_MODEL}",
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": {
                        "voiceConfig": {
                            "prebuiltVoiceConfig": {
                                "voiceName": "Aoede"
                            }
                        }
                    }
                },
                "systemInstruction": {
                    "parts": [{"text": system_instruction}]
                },
                "realtimeInputConfig": {
                    "automaticActivityDetection": {
                        "disabled": False,
                        "startOfSpeechSensitivity": "START_SENSITIVITY_HIGH",
                        "endOfSpeechSensitivity": "END_SENSITIVITY_HIGH",
                        "prefixPaddingMs": 100,
                        "silenceDurationMs": 1000
                    }
                },
                "outputAudioTranscription": {},
                "inputAudioTranscription": {}
            }
        }
        await gemini_ws.send(json.dumps(setup_message))

        # Wait for setup complete
        setup_response = await asyncio.wait_for(gemini_ws.recv(), timeout=15)
        setup_data = json.loads(setup_response)
        logger.info(f"Gemini setup response: {json.dumps(setup_data)[:200]}")

        await ws.send_json({"type": "session_started"})

    except Exception as e:
        logger.error(f"Failed to connect to Gemini Live API: {e}")
        await ws.send_json({"type": "error", "message": f"Failed to connect to AI: {str(e)}"})
        await ws.close()
        return

    # Run bidirectional relay
    async def browser_to_gemini():
        """Relay audio from browser to Gemini."""
        try:
            while True:
                raw = await ws.receive_text()
                msg = json.loads(raw)

                if msg.get("type") == "audio":
                    audio_data = msg.get("data", "")
                    if audio_data:
                        gemini_msg = {
                            "realtimeInput": {
                                "audio": {
                                    "data": audio_data,
                                    "mimeType": "audio/pcm;rate=16000"
                                }
                            }
                        }
                        await gemini_ws.send(json.dumps(gemini_msg))

                elif msg.get("type") == "end":
                    logger.info(f"Browser requested end for session {session_id}")
                    break

        except WebSocketDisconnect:
            logger.info(f"Browser disconnected for session {session_id}")
        except Exception as e:
            logger.error(f"Error in browser_to_gemini: {e}")

    async def gemini_to_browser():
        """Relay audio and transcriptions from Gemini to browser."""
        try:
            async for message in gemini_ws:
                response = json.loads(message)

                if "serverContent" in response:
                    sc = response["serverContent"]

                    # Audio data from model
                    if "modelTurn" in sc and "parts" in sc["modelTurn"]:
                        for part in sc["modelTurn"]["parts"]:
                            if "inlineData" in part:
                                audio_b64 = part["inlineData"]["data"]
                                await ws.send_json({
                                    "type": "audio",
                                    "data": audio_b64
                                })

                    # Input transcription (what the user said)
                    if "inputTranscription" in sc:
                        text = sc["inputTranscription"].get("text", "")
                        if text.strip():
                            await ws.send_json({
                                "type": "transcript_user",
                                "text": text
                            })

                    # Output transcription (what the AI said)
                    if "outputTranscription" in sc:
                        text = sc["outputTranscription"].get("text", "")
                        if text.strip():
                            await ws.send_json({
                                "type": "transcript_ai",
                                "text": text
                            })

                    # Turn complete
                    if sc.get("turnComplete"):
                        await ws.send_json({"type": "turn_complete"})

                    # Interrupted
                    if sc.get("interrupted"):
                        await ws.send_json({"type": "interrupted"})

        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Gemini WS closed for session {session_id}")
        except Exception as e:
            logger.error(f"Error in gemini_to_browser: {e}")

    try:
        # Run both directions concurrently
        await asyncio.gather(
            browser_to_gemini(),
            gemini_to_browser(),
            return_exceptions=True,
        )
    finally:
        # Clean up
        if gemini_ws and not gemini_ws.closed:
            await gemini_ws.close()
        logger.info(f"Voice interview session {session_id} ended")

from app.schemas.interview import VoiceInterviewCompleteRequest
from app.services.gemini_service import gemini_service
from app.models.interview import Question, Answer
from app.services.analytics_service import analytics_service

@router.post("/{session_id}/voice/complete")
def complete_voice_interview(session_id: str, req: VoiceInterviewCompleteRequest):
    """
    Process the full voice transcript to extract questions and answers, evaluate them,
    and then mark the session as complete for analytics generation.
    """
    db = SessionLocal()
    try:
        session = interview_service.get_session(db, session_id)
        if not session:
            return {"error": "Session not found"}

        if not req.transcript:
            interview_service.complete_session(db, session_id)
            return {"message": "Session completed (no transcript)"}

        # Format transcript for Gemini
        transcript_text = "\n".join([f"{entry.speaker.upper()}: {entry.text}" for entry in req.transcript])
        prompt = f"""
Given the following transcript from an AI interview, extract the distinct questions asked by the AI (SYSTEM/AI) and the corresponding answers provided by the candidate (USER).
If the candidate's answer spans multiple turns, summarize it into a single cohesive answer.
Do not include conversational filler like "Hello" or "Let's begin". Focus only on actual interview questions and answers.

Transcript:
{transcript_text}

Return the result strictly as a JSON object with a single key "qa_pairs" containing a list of objects, each with "question" and "answer" strings.
"""
        
        try:
            result = gemini_service.generate_json(prompt, temperature=0.1)
            qa_pairs = result.get("qa_pairs", [])
            
            # Save them into the database
            for idx, qa in enumerate(qa_pairs):
                q = Question(
                    session_id=session_id,
                    question_number=idx + 1,
                    question_text=qa["question"],
                    topic="General",
                    difficulty=session.configuration.difficulty
                )
                db.add(q)
                db.commit()
                db.refresh(q)
                
                a = Answer(
                    question_id=q.id,
                    answer_text=qa["answer"]
                )
                db.add(a)
                db.commit()
                
                # Evaluate the answer
                from app.utils.prompts import EVALUATION_PROMPT
                eval_prompt = EVALUATION_PROMPT.format(
                    question=q.question_text,
                    difficulty=q.difficulty.value,
                    answer=a.answer_text,
                    context="No specific context"
                )
                eval_result = gemini_service.generate_json(eval_prompt)
                
                from app.models.evaluation import Evaluation
                ev = Evaluation(
                    session_id=session_id,
                    question_id=q.id,
                    technical_accuracy=eval_result.get("technical_accuracy", 5),
                    clarity=eval_result.get("clarity", 5),
                    relevance=eval_result.get("relevance", 5),
                    completeness=eval_result.get("completeness", 5),
                    overall_score=eval_result.get("overall_score", 5.0),
                    feedback=eval_result.get("feedback", ""),
                    strengths=eval_result.get("strengths", ""),
                    weaknesses=eval_result.get("weaknesses", "")
                )
                db.add(ev)
                db.commit()
                
        except Exception as e:
            logger.error(f"Failed to process voice transcript: {e}")

        # Complete the session
        interview_service.complete_session(db, session_id)
        return {"message": "Session completed and transcript analyzed"}
    finally:
        db.close()
