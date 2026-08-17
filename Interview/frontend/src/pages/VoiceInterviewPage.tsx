import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getSession, completeVoiceInterview } from '../services/api';
import type { SessionInfo } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { Microphone, Robot, User, Clock, StopCircle, ArrowRight } from '@phosphor-icons/react';

interface TranscriptEntry {
  speaker: 'user' | 'ai' | 'system';
  text: string;
  timestamp: number;
}

const formatTime = (sec: number) => {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Noise gate: compute RMS of a PCM buffer and decide whether it's silence
function computeRMS(pcmData: Int16Array): number {
  let sum = 0;
  for (let i = 0; i < pcmData.length; i++) {
    sum += pcmData[i] * pcmData[i];
  }
  return Math.sqrt(sum / pcmData.length);
}

const NOISE_THRESHOLD = 400; // RMS below this is considered silence/noise

export default function VoiceInterviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const lastSessionIdRef = useRef<string | null>(null);

  // Auto-scroll transcripts
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Load session
  useEffect(() => {
    if (sessionId && lastSessionIdRef.current !== sessionId) {
      lastSessionIdRef.current = sessionId;
      loadSession();
    }
  }, [sessionId]);

  const loadSession = async () => {
    if (!sessionId) return;
    try {
      const s = await getSession(sessionId);
      setSession(s);
      if (s.status === 'completed') {
        setFinished(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Timer
  useEffect(() => {
    if (!session || finished || session.status === 'completed') return;
    const startTime = session.started_at ? new Date(session.started_at).getTime() : Date.now();
    const durationMs = (session.duration_minutes || 30) * 60 * 1000;
    const endTime = startTime + durationMs;

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(diff);
      if (diff <= 0) {
        clearInterval(timerId);
        handleEndInterview('timeout');
      }
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);
    return () => clearInterval(timerId);
  }, [session, finished]);

  // Play audio queue
  const playNextChunk = useCallback(() => {
    if (playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setAiSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setAiSpeaking(true);

    const chunk = playbackQueueRef.current.shift()!;
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const buffer = ctx.createBuffer(1, chunk.length, 24000);
    buffer.getChannelData(0).set(chunk);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = playNextChunk;
    source.start();
  }, []);

  const enqueueAudio = useCallback((base64Data: string) => {
    // Decode base64 to PCM bytes (16-bit LE, 24kHz from Gemini)
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Convert Int16 to Float32
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    playbackQueueRef.current.push(float32);

    if (!isPlayingRef.current) {
      playNextChunk();
    }
  }, [playNextChunk]);

  // Connect WebSocket and start mic
  const startVoiceSession = async () => {
    if (!sessionId) return;
    setConnecting(true);
    setError(null);

    try {
      // Create AudioContext
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = `${protocol}://${window.location.host}/api/v1/interviews/${sessionId}/voice`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Voice WS connected');
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'session_started':
            setConnected(true);
            setConnecting(false);
            startMicCapture(ctx, stream);
            setTranscripts(prev => [...prev, {
              speaker: 'system',
              text: 'Voice interview session started. The interviewer will begin shortly...',
              timestamp: Date.now(),
            }]);
            break;

          case 'audio':
            enqueueAudio(msg.data);
            break;

          case 'transcript_user':
            setTranscripts(prev => {
              // Merge with last user entry if recent
              const last = prev[prev.length - 1];
              if (last && last.speaker === 'user' && Date.now() - last.timestamp < 3000) {
                return [...prev.slice(0, -1), { ...last, text: last.text + ' ' + msg.text, timestamp: Date.now() }];
              }
              return [...prev, { speaker: 'user', text: msg.text, timestamp: Date.now() }];
            });
            break;

          case 'transcript_ai':
            setTranscripts(prev => {
              const last = prev[prev.length - 1];
              if (last && last.speaker === 'ai' && Date.now() - last.timestamp < 3000) {
                return [...prev.slice(0, -1), { ...last, text: last.text + ' ' + msg.text, timestamp: Date.now() }];
              }
              return [...prev, { speaker: 'ai', text: msg.text, timestamp: Date.now() }];
            });
            break;

          case 'turn_complete':
            setAiSpeaking(false);
            break;

          case 'interrupted':
            // Clear playback queue on barge-in
            playbackQueueRef.current = [];
            setAiSpeaking(false);
            break;

          case 'error':
            setError(msg.message);
            setConnecting(false);
            break;
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection failed');
        setConnecting(false);
      };

      ws.onclose = () => {
        setConnected(false);
        stopMicCapture();
      };

    } catch (e: any) {
      setError(e.message || 'Failed to start voice session');
      setConnecting(false);
    }
  };

  const startMicCapture = (ctx: AudioContext, stream: MediaStream) => {
    const source = ctx.createMediaStreamSource(stream);
    sourceRef.current = source;

    // ScriptProcessor for capturing raw PCM
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);

      // Convert Float32 to Int16
      const int16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Compute mic level for visualization
      const rms = computeRMS(int16);
      setMicLevel(Math.min(1, rms / 5000));

      // Noise gate: only send if above threshold
      if (rms > NOISE_THRESHOLD) {
        setUserSpeaking(true);
        // Convert to base64
        const uint8 = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64 = btoa(binary);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'audio', data: base64 }));
        }
      } else {
        setUserSpeaking(false);
      }
    };

    source.connect(processor);
    processor.connect(ctx.destination);
  };

  const stopMicCapture = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
    }
  };

  const handleEndInterview = async (reason?: string) => {
    if (!sessionId) return;
    try {
      // Close WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'end' }));
        wsRef.current.close();
      }
      stopMicCapture();

      // Send transcript to backend for analytics generation
      await completeVoiceInterview(sessionId, transcripts);

      setFinished(true);
      setConnected(false);

      const msg = reason === 'timeout'
        ? 'Time is up! Interview completed.'
        : 'Interview ended.';
      setTranscripts(prev => [...prev, { speaker: 'system', text: msg + ' View your analytics for results.', timestamp: Date.now() }]);
    } catch (e) {
      console.error(e);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      stopMicCapture();
    };
  }, []);

  if (!session) return <LoadingSpinner text="Loading interview session..." />;

  return (
    <div className="max-w-4xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-4 mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: connected ? 'var(--color-success)' : 'var(--color-danger)' }} />
            {session.title}
          </h1>
          <p className="text-xs flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1" style={{ background: 'rgba(134, 194, 50, 0.2)', color: 'var(--color-primary)' }}>
              <Microphone size={12} weight="bold" />
              VOICE
            </span>
            {session.difficulty} • {session.total_questions} questions
          </p>
        </div>
        <div className="flex items-center gap-4">
          {!finished && timeLeft !== null && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-sm"
                 style={{
                   borderColor: timeLeft < 60 ? 'var(--color-danger)' : 'var(--color-border)',
                   color: timeLeft < 60 ? 'var(--color-danger)' : 'var(--color-text-primary)',
                   background: timeLeft < 60 ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-bg-elevated)'
                 }}>
              <Clock size={16} weight="bold" className={timeLeft < 60 ? 'animate-pulse' : ''} />
              <span>{formatTime(timeLeft)}</span>
            </div>
          )}
          {!finished && connected && (
            <button onClick={() => { if (confirm('End the interview early?')) handleEndInterview('force_quit'); }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 hover:bg-[rgba(239,68,68,0.1)] transition-colors cursor-pointer"
              style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
              <StopCircle size={16} weight="bold" />
              End Interview
            </button>
          )}
          {finished && (
            <button onClick={() => navigate(`/analytics/${sessionId}`)}
              className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 cursor-pointer" style={{ background: 'var(--color-primary)', color: '#fff' }}>
              View Analytics
              <ArrowRight size={16} weight="bold" />
            </button>
          )}
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Transcript Area */}
        <div className="flex-1 overflow-y-auto glass rounded-2xl p-4 space-y-3">
          <AnimatePresence>
            {transcripts.map((entry, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                {entry.speaker === 'system' && (
                  <div className="text-center py-2">
                    <span className="inline-block px-4 py-2 rounded-xl text-xs" style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}>
                      {entry.text}
                    </span>
                  </div>
                )}
                {entry.speaker === 'ai' && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md" style={{ background: 'var(--gradient-primary)' }}>
                      <Robot size={18} color="#fff" weight="bold" />
                    </div>
                    <div className="max-w-[80%]">
                      <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
                        {entry.text}
                      </div>
                    </div>
                  </div>
                )}
                {entry.speaker === 'user' && (
                  <div className="flex gap-3 justify-end">
                    <div className="max-w-[80%]">
                      <div className="px-4 py-3 rounded-2xl rounded-tr-sm text-sm" style={{ background: 'var(--color-primary)', color: '#fff' }}>
                        {entry.text}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-md" style={{ background: 'var(--color-primary-dark)', color: '#fff' }}>
                      {user?.name ? user.name.charAt(0).toUpperCase() : <User size={16} color="#fff" weight="bold" />}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={transcriptEndRef} />
        </div>

        {/* Voice Control Panel */}
        {!finished && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6">
            {!connected && !connecting && (
              <div className="flex flex-col items-center gap-4">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Click the button below to start the voice interview session
                </p>
                <button onClick={startVoiceSession}
                  className="w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all hover:scale-105 cursor-pointer shadow-xl"
                  style={{ background: 'var(--gradient-primary)', boxShadow: '0 0 30px rgba(134, 194, 50, 0.4)' }}>
                  <Microphone size={36} color="#fff" weight="bold" />
                </button>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Ensure your microphone is enabled
                </p>
              </div>
            )}

            {connecting && (
              <div className="flex flex-col items-center gap-4">
                <LoadingSpinner text="Connecting to AI interviewer..." />
              </div>
            )}

            {connected && (
              <div className="flex items-center justify-between">
                {/* Mic visualization */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {/* Pulse ring */}
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{ background: 'rgba(134, 194, 50, 0.2)' }}
                      animate={{
                        scale: userSpeaking ? [1, 1.4 + micLevel * 0.6] : 1,
                        opacity: userSpeaking ? [0.4, 0] : 0,
                      }}
                      transition={{ duration: 0.6, repeat: userSpeaking ? Infinity : 0 }}
                    />
                    <div className="w-14 h-14 rounded-full flex items-center justify-center relative z-10"
                      style={{
                        background: userSpeaking ? 'var(--gradient-primary)' : 'var(--color-bg-elevated)',
                        border: `2px solid ${userSpeaking ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        transition: 'all 0.2s',
                      }}>
                      <Microphone size={24} color={userSpeaking ? '#fff' : 'var(--color-text-secondary)'} weight="bold" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {userSpeaking ? 'Listening...' : aiSpeaking ? 'AI is speaking...' : 'Waiting for input...'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {userSpeaking ? 'Speak clearly into your microphone' : aiSpeaking ? 'You can interrupt anytime' : 'Start speaking to answer'}
                    </p>
                  </div>
                </div>

                {/* Audio levels */}
                <div className="flex items-end gap-[3px] h-8">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const barHeight = userSpeaking
                      ? Math.max(4, Math.random() * micLevel * 32)
                      : aiSpeaking
                      ? Math.max(4, Math.sin(Date.now() / 200 + i) * 16 + 16)
                      : 4;
                    return (
                      <motion.div
                        key={i}
                        className="w-[3px] rounded-full"
                        style={{
                          background: userSpeaking ? 'var(--color-primary)' : aiSpeaking ? 'var(--color-accent)' : 'var(--color-border)',
                        }}
                        animate={{ height: barHeight }}
                        transition={{ duration: 0.1 }}
                      />
                    );
                  })}
                </div>

                {/* Status indicators */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-success)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Live</span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-3 text-center text-xs py-2 px-4 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)' }}>
                {error}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
