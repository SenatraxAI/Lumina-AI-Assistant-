# server/app.py

import asyncio
import base64
import logging
import os
import wave
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

executor = ThreadPoolExecutor(max_workers=4)
AUDIO_DIR = Path(__file__).parent / "audio"
AUDIO_DIR.mkdir(exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Lumina server starting up...")
    
    # Force initialization of handlers at startup
    # This triggers the "Pre-Cache" logic in their __init__ methods
    logger.info("Pre-loading LLM and TTS handlers (this may take a moment)...")
    get_handler("llm")
    get_handler("tts")
    
    logger.info("Handlers initialized. Server is ready.")
    yield
    logger.info("Lumina server shutting down...")

app = FastAPI(
    title="Lumina Audio Assistant API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import io
from fastapi.responses import StreamingResponse

# ... (Previous imports kept in context of file, assuming we add StreamingResponse)

class GenerateRequest(BaseModel):
    text: str
    prompt: str
    screenshot: str | None = None
    screenshots: list[str] | None = None
    autoRead: bool = True
    apiKey: str | None = None
    voice: str = "alba"
    cloneAudio: str | None = None
    
    # New Multi-LLM Fields
    llmProvider: str | None = "gemini"
    apiKeyOpenai: str | None = None
    apiKeyClaude: str | None = None
    apiKeyGroq: str | None = None
    responseTone: str | None = "helpful"
    
    # Performance
    useCuda: bool = False
    stream: bool = False

_handlers = {
    "llm": None,
    "tts": None
}

def get_handler(name):
    if _handlers[name] is None:
        if name == "llm":
            from llm_handler import LLMHandler
            _handlers[name] = LLMHandler()
        elif name == "tts":
            from tts_handler import TTSHandler
            _handlers[name] = TTSHandler()
    return _handlers[name]

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "server": "Lumina Audio Assistant"
    }

# --- Streaming Logic ---
# --- Streaming Logic ---
async def stream_generator(request: GenerateRequest):
    """
    Generator that pipelines LLM text -> TTS -> Audio Bytes
    """
    try:
        # Debug Logging
        logger.info(f"Stream Job Request: Provider={request.llmProvider}")
        logger.info(f"Keys Received -> Legacy/Gemini: {str(request.apiKey)[:5]}... | Groq: {str(request.apiKeyGroq)[:5]}... | OpenAI: {str(request.apiKeyOpenai)[:5]}...")
        
        if request.apiKeyGroq:
            logger.info(f"Groq Key Present (Len: {len(request.apiKeyGroq)})")

        llm = get_handler("llm")
        tts = get_handler("tts")
        
        # Select correct API key based on provider
        # Priority: Request Payload > Environment Variable
        key_to_use = None
        
        if request.llmProvider == "groq":
            key_to_use = request.apiKeyGroq or os.getenv("GROQ_API_KEY")
        elif request.llmProvider == "openai":
            key_to_use = request.apiKeyOpenai or os.getenv("OPENAI_API_KEY")
        elif request.llmProvider == "claude":
            key_to_use = request.apiKeyClaude or os.getenv("ANTHROPIC_API_KEY")
        else:
            # Default to Gemini
            key_to_use = request.apiKey or os.getenv("GEMINI_API_KEY")
            
        if key_to_use:
            key_to_use = key_to_use.strip()
            
        # 1. Start LLM Generation (Blocking/Buffered)
        # User requested to "get full response first" to avoid streaming artifacts
        logger.info("Buffering full LLM response...")
        full_text_response = ""
        
        # We still use the stream generator to get the text, but we consume it all
        text_stream = llm.generate_answer_stream(
            text=request.text, prompt=request.prompt, screenshot_b64=request.screenshot,
            screenshots=request.screenshots, api_key=key_to_use,
            provider=request.llmProvider, tone=request.responseTone
        )
        
        for chunk in text_stream:
            full_text_response += chunk
            
        logger.info(f"Full LLM Response ({len(full_text_response)} chars): {full_text_response[:50]}...")
        
        # 2. TTS Generation & Audio Accumulation
        # We must send a VALID WAV file (with header). Raw PCM will not play in <audio> tag.
        # Since we are buffering the LLM text anyway, we can buffer the audio too
        # to ensure the WAV header has the correct length.
        
        import re
        sentences = re.split(r'(?<=[.!?])\s+', full_text_response)
        tts = get_handler("tts")
        
        # Prepare WAV buffer
        wav_buffer = io.BytesIO()
        # We need to know sample rate. Default for PocketTTS is 24000
        sample_rate = getattr(tts, 'sample_rate', 24000)
        
        with wave.open(wav_buffer, 'wb') as wf:
            wf.setnchannels(1) 
            wf.setsampwidth(2) # 16-bit PCM
            wf.setframerate(sample_rate)
            
            for sentence in sentences:
                if not sentence.strip():
                    continue
                    
                logger.info(f"Processing Sentence: {sentence[:30]}...")
                
                try:
                    # Generate Audio
                    loop = asyncio.get_event_loop()
                    audio_chunk = await loop.run_in_executor(
                        executor,
                        lambda: tts.generate_speech(
                            sentence,
                            voice=request.voice,
                            use_cuda=request.useCuda
                        )
                    )
                    # Write frames to WAV container
                    wf.writeframes(audio_chunk.tobytes())
                except Exception as e:
                    logger.error(f"TTS Generation Error for sentence '{sentence[:10]}...': {e}")
                    
        # Loop finished. wave.open context exit closes file and WRITES HEADER SIZE.
        
        # Reset pointer to start of file to read the whole valid WAV
        wav_buffer.seek(0)
        full_wav_data = wav_buffer.getvalue()
        
        logger.info(f"Generated complete WAV file size: {len(full_wav_data)} bytes")
        yield full_wav_data

    except Exception as e:
        logger.error(f"Stream Generator Critical Error: {e}")
        yield b""

@app.post("/api/generate")
async def generate(request: GenerateRequest):
    # Old legacy mode support or unified?
    # User plan says "StreamingResponse".
    
    # We always return JSON containing text? 
    # Frontend expects { audioUrl: "...", text: "..." }
    # Streaming Audio means we can't return JSON text first.
    # Frontend logic was changed to `request.stream = true`.
    
    # BUT wait, `content.js` expected `data.audioUrl` to play.
    # My updated `content.js` logic was:
    # 3. Send Request -> wait for JSON.
    # 4. Play `data.audioUrl`.
    
    # If using true streaming, this endpoint should return JSON with a "streamUrl"?
    # OR directly Stream Audio bytes?
    # If directly stream audio bytes, where does the Text go?
    
    # Refined Plan: 
    # 1. If stream=True: Return JSON { audioUrl: "/api/generate_stream?session=...", text: "Streaming..." }
    # 2. Frontend sets audio.src = audioUrl
    # 3. /api/generate_stream calls the generator.
    
    # Problem: Setting audio.src makes a NEW GET request. We need to pass the heavy payload (screenshot) again.
    # Passing 500KB in URL parameters is bad.
    
    # Solution: CACHE the request payload temporarily.
    
    
    # Enforce Streaming Architecture
    # CACHE the request payload and return a stream URL
    
    # Cache Job
    job_id = f"job_{int(time.time()*1000)}"
    _request_cache[job_id] = request
    
    return {
        "audioUrl": f"/api/stream/{job_id}",
        "text": "Streaming Answer...",
        "duration": 0
    }

# Cache for Stream Jobs
_request_cache = {}

@app.get("/api/stream/{job_id}")
async def stream_audio(job_id: str):
    if job_id not in _request_cache:
        raise HTTPException(status_code=404, detail="Job expired")
    
    request = _request_cache.pop(job_id)
    
    return StreamingResponse(
        stream_generator(request),
        media_type="audio/wav"
    )

@app.get("/api/audio/{filename}")
async def get_audio(filename: str):
    filepath = AUDIO_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(filepath, media_type="audio/wav")

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8080, reload=True)
