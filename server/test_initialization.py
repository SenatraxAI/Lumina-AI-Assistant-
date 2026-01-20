# server/test_initialization.py
import os
import logging
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test")

def test_llm():
    logger.info("Testing LLM Handler...")
    try:
        from llm_handler import LLMHandler
        handler = LLMHandler()
        logger.info(f"LLM Available: {handler.is_available}")
        if handler.is_available:
            ans = handler.generate_answer("Hello", "Say 'Gemini is ready'")
            logger.info(f"LLM Response: {ans}")
    except Exception as e:
        logger.error(f"LLM Test Failed: {e}")

def test_tts():
    logger.info("Testing TTS Handler...")
    try:
        from tts_handler import TTSHandler
        handler = TTSHandler()
        logger.info(f"TTS Available: {handler.is_available}")
        if handler.is_available:
            audio = handler.generate_speech("Test")
            logger.info(f"TTS generated audio shape: {audio.shape}")
    except Exception as e:
        logger.error(f"TTS Test Failed: {e}")

def test_novasr():
    logger.info("Testing NovaSR Handler...")
    try:
        from novasr_handler import NovaSRHandler
        handler = NovaSRHandler()
        logger.info(f"NovaSR Available: {handler.is_available}")
    except Exception as e:
        logger.error(f"NovaSR Test Failed: {e}")

if __name__ == "__main__":
    test_llm()
    test_tts()
    test_novasr()
