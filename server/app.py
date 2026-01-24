# server/app.py

import asyncio
import base64
import logging
import os
import re
import wave
import time
import torch
import hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import psutil
from dotenv import load_dotenv
from fastapi import UploadFile, File
import openai

load_dotenv()

# Logging Configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Execution resources
executor = ThreadPoolExecutor(max_workers=10) # General pool
AUDIO_DIR = Path(__file__).parent / "audio"
AUDIO_DIR.mkdir(exist_ok=True)

# Session Cleanup Logic
def cleanup_audio_files():
    """Removes all .wav files from audio directory on startup to reset session."""
    try:
        count = 0
        for wav_file in AUDIO_DIR.glob("*.wav"):
            wav_file.unlink()
            count += 1
        logger.info(f"Session Cleanup: Deleted {count} residual audio files.")
    except Exception as e:
        logger.error(f"Cleanup Error: {e}")

# Cache Cleanup Task
async def periodic_cache_cleanup():
    """Run periodically to remove expired requests from memory."""
    try:
        while True:
            await asyncio.sleep(300) # Run every 5 minutes
            
            now = time.time()
            expired_ids = []
            
            # Identify expired items (TTL: 30 minutes = 1800s)
            for jid, data in _request_cache.items():
                if now - data['timestamp'] > 1800:
                    expired_ids.append(jid)
            
            # Delete them
            for jid in expired_ids:
                del _request_cache[jid]
                
            if expired_ids:
                logger.info(f"Cache Cleanup: Removed {len(expired_ids)} expired jobs.")
                
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.error(f"Cache Cleanup Error: {e}")

# Dynamic Resource Scaling for TTS (Aggressive "Burst and Spin Down" Strategy)
def get_safe_worker_count():
    """
    Detect RAM and CPU cores to determine optimal parallel TTS workers.
    Uses aggressive scaling for burst workloads (2-10 second spikes).
    """
    try:
        total_ram_gb = psutil.virtual_memory().total / (1024**3)
        cpu_cores = psutil.cpu_count(logical=False)  # Physical cores only
        
        # RAM-based limit (aggressive for burst workloads)
        if total_ram_gb < 6:
            ram_workers = 2
        elif total_ram_gb < 10:
            ram_workers = 4
        elif total_ram_gb < 18:
            ram_workers = 8
        else:
            ram_workers = 12
        
        # CPU-based limit (prevent thrashing)
        # 2 workers per physical core leverages hyperthreading
        cpu_workers = cpu_cores * 2
        
        # Take the minimum (bottleneck wins), cap at 12
        workers = max(1, min(ram_workers, cpu_workers, 12))
        
        logger.info(f"TTS Worker Scaling: {total_ram_gb:.1f}GB RAM, {cpu_cores} CPU cores → {workers} workers (RAM limit: {ram_workers}, CPU limit: {cpu_workers})")
        return workers
    except Exception as e:
        logger.warning(f"Worker count detection failed: {e}. Using fallback: 2 workers")
        return 2  # Safe fallback

MAX_TTS_WORKERS = get_safe_worker_count()

@asynccontextmanager
async def lifespan_context(app: FastAPI):
    # Startup: Clean old session files (Crash Recovery)
    cleanup_audio_files()
    
    # Start Cache Cleanup Background Task
    cache_task = asyncio.create_task(periodic_cache_cleanup())

    # Pass worker count to handlers if needed
    os.environ["LUMINA_MAX_WORKERS"] = str(MAX_TTS_WORKERS)
    logger.info("Lumina server starting up...")
    
    # Force initialization of handlers at startup
    try:
        get_handler("llm")
        get_handler("tts")
        # Generate friendly cue
        await ensure_audio_cue()
    except Exception as e:
        logger.warning(f"Handler pre-init warning: {e}")
        
    yield
    
    # Shutdown
    cache_task.cancel()
    logger.info("Lumina server shutting down...")

app = FastAPI(
    title="Lumina Audio Assistant API",
    version="1.0.0",
    lifespan=lifespan_context
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
    customPersona: str | None = None
    history: list[dict[str, str]] | None = None
    shouldAudio: bool = False # 🎯 v3.0: Default to False for on-demand
    
    # Performance
    useCuda: bool = False
    stream: bool = False
    
    # Internal
    preGeneratedText: str | None = None
    jobId: str | None = None

class TTSRequest(BaseModel):
    text: str
    voice: str = "alba"

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
    import platform
    return {
        "status": "healthy",
        "server": "Lumina Audio Assistant",
        "version": "1.0.0",
        "platform": platform.system(),
        "gpu_available": torch.cuda.is_available(),
        "device": "cuda" if torch.cuda.is_available() else "cpu"
    }

@app.post("/api/shutdown")
async def shutdown():
    logger.info("Shutdown requested via API...")
    # Delay allows the response to reach the client before death
    def kill_process():
        time.sleep(1)
        import signal
        os.kill(os.getpid(), signal.SIGINT)
        
    import threading
    threading.Thread(target=kill_process, daemon=True).start()
    return {"status": "SHUTTING_DOWN"}

async def ensure_audio_cue():
    """Generates friendly startup cues if they don't exist."""
    # 1. Loading Cue
    cue_path = AUDIO_DIR / "cue.wav"
    if not cue_path.exists():
        logger.info("Generating friendly audio cue...")
        await _generate_static_audio(cue_path, "Sure thing! Let me get my voice ready for you...")
    
    # 2. Ready Cue
    ready_path = AUDIO_DIR / "ready.wav"
    if not ready_path.exists():
        logger.info("Generating ready audio cue...")
        await _generate_static_audio(ready_path, "Alright... let me explain to you...")

async def _generate_static_audio(path, text):
    """Helper to generate a static WAV file."""
    def _gen():
        tts = get_handler("tts")
        if not tts: return None
        return tts.generate_speech(text=text, voice="alba", use_cuda=torch.cuda.is_available())
        
    audio_data = await asyncio.get_event_loop().run_in_executor(executor, _gen)
    
    if audio_data is not None:
        import numpy as np
        if audio_data.dtype != np.int16:
            audio_data = (audio_data * 32767).astype(np.int16)
        with wave.open(str(path), 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(24000)
            wf.writeframes(audio_data.tobytes())
        logger.info(f"Generated static audio: {path}")

@app.post("/api/tts")
async def generate_tts_standalone(request: TTSRequest, check_only: bool = False):
    """Generates or checks for audio for a specific piece of text on-demand."""
    text_hash = hashlib.md5(f"{request.voice}_{request.text}".encode()).hexdigest()
    filename = f"tts_{text_hash}.wav"
    save_path = AUDIO_DIR / filename
    
    is_cached = save_path.exists()
    
    if check_only or is_cached:
        return {
            "is_cached": is_cached,
            "audioUrl": f"/api/audio/{filename}"
        }
    
    # Generate it (Full generation mode)
    def _run_tts():
        tts = get_handler("tts")
        audio_data = tts.generate_speech(text=request.text, voice=request.voice, use_cuda=torch.cuda.is_available())
        if audio_data is not None:
             import numpy as np
             if audio_data.dtype != np.int16:
                 audio_data = (audio_data * 32767).astype(np.int16)
             with wave.open(str(save_path), 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(24000)
                wf.writeframes(audio_data.tobytes())
             return True
        return False

    success = await asyncio.get_event_loop().run_in_executor(executor, _run_tts)
    if success:
        return {"audioUrl": f"/api/audio/{filename}"}
    else:
        raise HTTPException(status_code=500, detail="TTS Generation failed")

@app.get("/api/audio/{filename}")
async def get_audio_file(filename: str):
    """Serves generated audio files from the audio directory."""
    file_path = AUDIO_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(file_path)

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
        
        if request.preGeneratedText:
            logger.info("Using pre-generated text from cache...")
            full_text_response = request.preGeneratedText
        else:
            # Fallback for direct streaming calls (legacy)
            logger.info("No pre-generated text found. Calling LLM...")
            
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
        
        sentences = [s for s in re.split(r'(?<=[.!?])\s+', full_text_response) if s.strip()]
        tts = get_handler("tts")
        
        # 3. Parallel TTS Execution (Throttled)
        semaphore = asyncio.Semaphore(MAX_TTS_WORKERS)
        
        async def process_sentence_task(index, sentence_text):
            async with semaphore:
                logger.info(f"Parallel Worker: Processing Sentence {index} ({len(sentence_text)} chars)")
                loop = asyncio.get_event_loop()
                audio = await loop.run_in_executor(
                    executor,
                    lambda: tts.generate_speech(
                        sentence_text,
                        voice=request.voice,
                        use_cuda=request.useCuda
                    )
                )
                return index, audio

        # Create Tasks
        tasks = []
        for i, sentence in enumerate(sentences):
            tasks.append(process_sentence_task(i, sentence))

        # Run in Parallel (Await all)
        logger.info(f"Starting parallel generation for {len(tasks)} sentences...")
        results = await asyncio.gather(*tasks)
        
        # Sort results to maintain original text order
        results.sort(key=lambda x: x[0])
        
        # 4. Assembly into WAV
        wav_buffer = io.BytesIO()
        sample_rate = getattr(tts, 'sample_rate', 24000)
        
        with wave.open(wav_buffer, 'wb') as wf:
            wf.setnchannels(1) 
            wf.setsampwidth(2) # 16-bit PCM
            wf.setframerate(sample_rate)
            
            for _, audio_chunk in results:
                wf.writeframes(audio_chunk.tobytes())
                
        logger.info("Parallel generation completed.")
                    
        # Loop finished. wave.open context exit closes file and WRITES HEADER SIZE.
        
        # Reset pointer to start of file to read the whole valid WAV
        wav_buffer.seek(0)
        full_wav_data = wav_buffer.getvalue()
        
        # PERSISTENCE: Save to disk so we can serve it later (even after restart)
        if request.jobId:
             save_path = AUDIO_DIR / f"{request.jobId}.wav"
             with open(save_path, "wb") as f:
                 f.write(full_wav_data)
             logger.info(f"Saved persistent audio to {save_path}")
        
        logger.info(f"Generated complete WAV file size: {len(full_wav_data)} bytes")
        yield full_wav_data

    except Exception as e:
        logger.error(f"Stream Generator Critical Error: {e}")
        yield b""

# Helper for Threaded Execution
def handle_tts_generation(request, job_id):
    """
    Background task to generate TTS audio.
    Runs in a separate thread/process to avoid blocking the API response.
    """
    try:
        if not request.preGeneratedText:
            logger.warning(f"Job {job_id}: No text to speak.")
            return
            
        # Get handler
        tts = get_handler("tts")
        if not tts:
             logger.error(f"Job {job_id}: TTS Handler not found/initialized.")
             return
             
        logger.info(f"Job {job_id}: Start TTS (Voice: {request.voice})...")
        
        # Determine voice ID
        voice_id = request.voice
        # Logic for custom voice if needed (request.customVoiceId is not in model currently but handled logic elsewhere - stick to request.voice for now or map it)
        # Actually in Pydantic model 'customVoiceId' isn't defined in view. 
        # But 'voice' string is passed. If custom, it's a GUID. TTS handler handles it if in cache.
        
        # Call Generate Speech (Correct Method)
        # Signature: generate_speech(text, voice="alba", use_cuda=False)
        # Note: speed is handled by frontend, clone_audio not supported in simple handler yet
        
        audio_data = tts.generate_speech(
            text=request.preGeneratedText,
            voice=voice_id,
            use_cuda=torch.cuda.is_available() # Pass global cuda state or config?
        )
        
        if audio_data is None:
             logger.error(f"Job {job_id}: TTS returned None.")
             return

        # Save to Disk (WAV)
        save_path = AUDIO_DIR / f"{job_id}.wav"
        
        # Ensure 16-bit PCM
        import numpy as np
        if audio_data.dtype != np.int16:
             # Normalize float -1..1 to int16
             audio_data = (audio_data * 32767).astype(np.int16)
             
        with wave.open(str(save_path), 'wb') as wf:
            wf.setnchannels(1) # Mono
            wf.setsampwidth(2) # 16-bit
            wf.setframerate(24000) # PocketTTS rate
            wf.writeframes(audio_data.tobytes())
            
        file_size = save_path.stat().st_size
        logger.info(f"🎤 [TTS] Job {job_id}: Audio saved to {save_path} - {file_size} bytes")
        
    except Exception as e:
        logger.error(f"Job {job_id}: TTS Executor Failed - {e}")
        import traceback
        traceback.print_exc()

@app.post("/api/generate")
async def generate(request: GenerateRequest):
    logger.info(f"🎯 [GENERATE] Request received - LLM: {request.llmProvider}, Voice: {request.voice}, ShouldAudio: {request.shouldAudio}, Stream: {request.stream}")
    logger.info(f"🎯 [GENERATE] Text length: {len(request.text)}, Prompt length: {len(request.prompt)}")
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
    
    # Enforce Streaming Architecture
    # CACHE the request payload and return a stream URL
    
    # 1. Generate Text Here (Blocking)
    # This ensures we can return the text immediately to the frontend
    llm = get_handler("llm")
    
    key_to_use = None
    if request.llmProvider == "groq":
        key_to_use = request.apiKeyGroq or os.getenv("GROQ_API_KEY")
    elif request.llmProvider == "openai":
        key_to_use = request.apiKeyOpenai or os.getenv("OPENAI_API_KEY")
    elif request.llmProvider == "claude":
        key_to_use = request.apiKeyClaude or os.getenv("ANTHROPIC_API_KEY")
    else:
        key_to_use = request.apiKey or os.getenv("GEMINI_API_KEY")

    if key_to_use:
        key_to_use = key_to_use.strip()
    
    # Run LLM generation in thread pool to avoid blocking main loop
    # Define sync helper
    def _generate_text_sync():
        logger.info("Generating full text response immediately (Threaded)...")
        text_stream = llm.generate_answer_stream(
            text=request.text, prompt=request.prompt, screenshot_b64=request.screenshot,
            screenshots=request.screenshots, api_key=key_to_use,
            provider=request.llmProvider, tone=request.responseTone,
            history=request.history, custom_persona=request.customPersona
        )
        return "".join(text_stream)

    # Await in executor
    logger.info("🎯 [GENERATE] Calling LLM handler...")
    full_text_response = await asyncio.get_event_loop().run_in_executor(
        executor, _generate_text_sync
    )
    logger.info(f"🎯 [GENERATE] LLM response received - {len(full_text_response)} chars")
        
    # Store in request for the stream generator to use
    request.preGeneratedText = full_text_response

    # Cache Job
    job_id = f"job_{int(time.time()*1000)}"
    request.jobId = job_id  # Store job ID in request for saving file
    
    # Only cache if we plan to stream audio
    audio_url = ""
    if request.shouldAudio:
        # Cache with timestamp for TTL
        _request_cache[job_id] = {
            "request": request,
            "timestamp": time.time()
        }
        audio_url = f"/api/stream/{job_id}"
    
    logger.info(f"🎯 [GENERATE] Returning response - audioUrl: {audio_url}")
    return {
        "audioUrl": audio_url,
        "text": full_text_response,
        "duration": 0
    }

@app.post("/api/stt")
async def speech_to_text(file: UploadFile = File(...)):
    """🎯 v4.10.0: Transcribe voice using OpenAI Whisper"""
    try:
        logger.info(f"🎙️ [STT] Received audio file: {file.filename}")
        
        # Read file into memory
        audio_data = await file.read()
        
        # We need a file-like object with a proper name for OpenAI
        # Using temp storage avoids complex memory buffer naming issues
        temp_path = AUDIO_DIR / f"temp_stt_{int(time.time())}.wav"
        with open(temp_path, "wb") as f:
            f.write(audio_data)
            
        try:
            client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            with open(temp_path, "rb") as audio_file:
                transcript = client.audio.transcriptions.create(
                    model="whisper-1", 
                    file=audio_file,
                    response_format="text"
                )
            
            logger.info(f"🎙️ [STT] Transcribed text: {transcript[:50]}...")
            return {"success": True, "text": transcript}
            
        finally:
            if temp_path.exists():
                temp_path.unlink()
                
    except Exception as e:
        logger.error(f"🎙️ [STT] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Cache for Stream Jobs
_request_cache = {}

@app.head("/api/stream/{job_id}")
async def check_stream_audio(job_id: str):
    # Check Cache
    if job_id in _request_cache:
        return {} # 200 OK
        
    # Check Disk
    saved_path = AUDIO_DIR / f"{job_id}.wav"
    if saved_path.exists():
        return {} # 200 OK
        
    raise HTTPException(status_code=404, detail="Job not found")

@app.get("/api/stream/{job_id}")
async def stream_audio(job_id: str):
    # 1. Check if the file already exists on disk (Cachced/Persistent)
    saved_path = AUDIO_DIR / f"{job_id}.wav"
    if saved_path.exists():
        logger.info(f"🎯 [STREAM] Serving persistent audio from disk: {saved_path}")
        return FileResponse(saved_path, media_type="audio/wav")

    # 2. Check if the job is in memory cache
    if job_id not in _request_cache:
        logger.warning(f"🎯 [STREAM] Job {job_id} not found on disk or in cache")
        raise HTTPException(status_code=404, detail="Job expired or not found")
    
    cache_entry = _request_cache.get(job_id)
    request = cache_entry['request']
    
    logger.info(f"🎯 [STREAM] Starting generator for job {job_id}")
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
    print("\n" + "="*50)
    print("      LUMINA AI ENGINE: EXTENSIVE DEBUG MODE")
    print("="*50)
    print(f" VERSION: 4.5.3")
    print(f" ADDRESS: http://localhost:8080")
    print(f" DEVICE : {'CUDA (GPU)' if torch.cuda.is_available() else 'CPU'}")
    print("="*50 + "\n")
    
    # Disable reload to avoid infinite restart loops when writing audio files
    uvicorn.run("app:app", host="0.0.0.0", port=8080, reload=False)
