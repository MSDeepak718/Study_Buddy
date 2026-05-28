import json
import time
import logging
from google import genai
from google.genai import types
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

MAX_RETRIES = 3
INITIAL_BACKOFF = 5  # seconds


class GeminiService:
    """Service for interacting with Google Gemini API."""

    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return self._client

    def _is_rate_limit_error(self, error: Exception) -> bool:
        """Check if an exception is a 429 rate-limit error."""
        error_str = str(error)
        return "429" in error_str or "RESOURCE_EXHAUSTED" in error_str

    def generate_text(self, prompt: str, temperature: float = 0.7) -> str:
        """
        Generate text using Gemini.

        Args:
            prompt: The input prompt
            temperature: Controls randomness (0=deterministic, 1=creative)

        Returns:
            Generated text string
        """
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                response = self.client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=temperature,
                        top_p=0.9,
                        max_output_tokens=2048,
                    ),
                )
                return response.text.strip() if response.text else ""
            except Exception as e:
                last_error = e
                if self._is_rate_limit_error(e) and attempt < MAX_RETRIES - 1:
                    wait = INITIAL_BACKOFF * (2 ** attempt)
                    logger.warning(f"Gemini rate limit hit (attempt {attempt + 1}/{MAX_RETRIES}). Retrying in {wait}s...")
                    time.sleep(wait)
                    continue
                logger.error(f"Gemini API error: {e}")
                raise RuntimeError(f"Failed to generate content: {e}")
        raise RuntimeError(f"Failed after {MAX_RETRIES} retries: {last_error}")

    def generate_json(self, prompt: str, temperature: float = 0.3) -> dict:
        """
        Generate JSON output from Gemini, with parsing and cleanup.

        Args:
            prompt: The input prompt (should request JSON output)
            temperature: Lower for more deterministic JSON

        Returns:
            Parsed JSON dictionary
        """
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                response = self.client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=temperature,
                        top_p=0.9,
                        max_output_tokens=2048,
                        response_mime_type="application/json"
                    ),
                )
                text = response.text.strip() if response.text else "{}"

                # Clean up common Gemini JSON artifacts
                if text.startswith("```json"):
                    text = text[7:]
                if text.startswith("```"):
                    text = text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()

                return json.loads(text)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Gemini JSON response: {e}\nRaw: {text}")
                raise RuntimeError(f"Invalid JSON from Gemini: {e}")
            except Exception as e:
                last_error = e
                if self._is_rate_limit_error(e) and attempt < MAX_RETRIES - 1:
                    wait = INITIAL_BACKOFF * (2 ** attempt)
                    logger.warning(f"Gemini rate limit hit (attempt {attempt + 1}/{MAX_RETRIES}). Retrying in {wait}s...")
                    time.sleep(wait)
                    continue
                logger.error(f"Gemini API error: {e}")
                raise RuntimeError(f"Failed to generate JSON content: {e}")
        raise RuntimeError(f"Failed after {MAX_RETRIES} retries: {last_error}")


# Singleton instance
gemini_service = GeminiService()

