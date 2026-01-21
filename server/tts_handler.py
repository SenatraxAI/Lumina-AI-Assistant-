# server/tts_handler.py

"""
Kyutai Pocket TTS Integration
Handles text-to-speech generation
"""

import logging
import os
from typing import Optional
import numpy as np
import torch

logger = logging.getLogger(__name__)

class TTSHandler:
    """Handler for Kyutai Pocket TTS model"""
    
    def __init__(self):
        self.is_available = False
        self.model = None
        self.sample_rate = 24000
        self.current_device = 'cpu'
        self._initialize()
    
    def _initialize(self):
        """Initialize the Pocket TTS model"""
        try:
            logger.info("Initializing Kyutai Pocket TTS...")
            
            # Use try/except for import as the package might not be in the environment yet
            try:
                from pocket_tts import TTSModel
                # Load model
                # Optimize quality: Using 15 steps for speed (User Request)
                # (Lower steps = faster generation, slightly lower quality)
                self.model = TTSModel.load_model(lsd_decode_steps=15)
                self.sample_rate = getattr(self.model, 'sample_rate', 24000)
                
                # Immediate CUDA Move (Cache Everything)
                if torch.cuda.is_available():
                    logger.info("CUDA detected. Moving model to GPU immediately...")
                    self.model.to('cuda')
                    self.current_device = 'cuda'
                else:
                    self.current_device = 'cpu'
                
                self.is_available = True
                
                # Pre-Cache Standard Voices using Safe Loader
                self.voice_cache = {}
                standard_voices = [
                    "alba", "marius", "javert", "jean", 
                    "fantine", "cosette", "eponine", "azelma"
                ]
                logger.info(f"Pre-caching voices (safe mode)...")
                
                for v in standard_voices:
                    try:
                        self._load_voice_safe(v)
                    except Exception as e:
                        logger.warning(f"Failed to cache voice '{v}': {e}")
                        pass
                        
                logger.info(f"Pocket TTS (Full) initialized at {self.sample_rate}Hz on {self.current_device} with {len(self.voice_cache)} cached voices.")
            except Exception as e:
                logger.warning(f"Pocket TTS could not be initialized: {e}. Using fallback mock.")
                self.is_available = False
            
        except Exception as e:
            logger.error(f"Failed to initialize Pocket TTS: {e}")
            self.is_available = False
    
    def generate_speech(
        self,
        text: str,
        voice: str = "alba",
        use_cuda: bool = False
    ) -> np.ndarray:
        """
        Generate speech from text
        """
        if not self.is_available:
            return self._generate_mock_audio()

        # Handle Device Switching
        target_device = 'cpu'
        if use_cuda:
            if torch.cuda.is_available():
                target_device = 'cuda'
                logger.info("Using CUDA acceleration for TTS")
            else:
                logger.warning("CUDA requested but not available. Using CPU.")

    def _load_voice_safe(self, voice: str) -> dict:
        """
        Safely load voice state, handling CUDA/CPU transitions to avoid
        RuntimeError: Expected all tensors to be on the same device.
        """
        if hasattr(self, 'voice_cache') and voice in self.voice_cache:
            return self.voice_cache[voice]
            
        logger.info(f"Loading new voice state for '{voice}'...")
        
        # KEY FIX: Force CPU for the loading step to avoid prompt tensor mismatch
        original_device = self.current_device
        if original_device == 'cuda':
             self.model.to('cpu')
             self.current_device = 'cpu'
             
        try:
             state = self.model.get_state_for_audio_prompt(voice)
        except Exception as e:
             # Try to restore before re-raising
             if original_device == 'cuda':
                 self.model.to('cuda')
                 self.current_device = 'cuda'
             raise e

        # If we were on CUDA, move everything back
        if original_device == 'cuda':
             self.model.to('cuda')
             self.current_device = 'cuda'
             
             # Move state tensors to CUDA too!
             for key, val in state.items():
                 if isinstance(val, torch.Tensor):
                     state[key] = val.to('cuda')
        
        # Cache it
        if hasattr(self, 'voice_cache'):
            self.voice_cache[voice] = state
            
        return state

    def generate_speech(
        self,
        text: str,
        voice: str = "alba",
        use_cuda: bool = False
    ) -> np.ndarray:
        """
        Generate speech from text
        """
        if not self.is_available:
            return self._generate_mock_audio()

        # Handle Device Switching
        target_device = 'cpu'
        if use_cuda:
            if torch.cuda.is_available():
                target_device = 'cuda'
                logger.info("Using CUDA acceleration for TTS")
            else:
                logger.warning("CUDA requested but not available. Using CPU.")

        if self.current_device != target_device:
            try:
                logger.info(f"Moving TTS model to {target_device}...")
                if hasattr(self.model, 'to'):
                    self.model.to(target_device)
                elif hasattr(self.model, 'model') and hasattr(self.model.model, 'to'):
                     # Wrapper handling
                     self.model.model.to(target_device)
                
                self.current_device = target_device
                logger.info(f"Model moved to {target_device}")
            except Exception as e:
                logger.error(f"Failed to move model to {target_device}: {e}")
        
        # Preprocess text
        import re
        text = re.sub(r'\.{2,}', '.', text)
        text = re.sub(r',{2,}', ',', text)
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        if len(text) > 5000:
            logger.info("Truncating text to 5000 chars")
            text = text[:5000]

        # Generate (Standard No-Clone)
        logger.info(f"Generating speech with voice: {voice}")
        
        try:
             # 1. Get Speaker State (Safe Load)
             try:
                 state = self._load_voice_safe(voice)
             except Exception:
                 # Fallback
                 logger.warning(f"Voice '{voice}' loading failed, trying fallback to 'alba'...")
                 try:
                     state = self._load_voice_safe("alba")
                 except Exception as e:
                     logger.error(f"Critical: Fallback voice 'alba' also failed: {e}")
                     raise

             # 2. Generate Audio
             try:
                 audio_out = self.model.generate_audio(state, text)
             except Exception as e:
                 logger.error(f"Generation with voice '{voice}' failed on {self.current_device}: {e}")
                 
                 # Emergency Fallback to CPU
                 logger.info("Emergency Fallback: Switching entire pipeline to CPU...")
                 try:
                     self.model.to('cpu')
                     self.current_device = 'cpu'
                     
                     # Need to ensure state is on CPU now
                     cpu_state = {}
                     for k, v in state.items():
                         if isinstance(v, torch.Tensor):
                             cpu_state[k] = v.to('cpu')
                         else:
                             cpu_state[k] = v
                             
                     audio_out = self.model.generate_audio(cpu_state, text)
                     
                 except Exception as final_e:
                    logger.error(f"Critical TTS Failure on CPU: {final_e}")
                    raise final_e
             
             # Handle output format
             if isinstance(audio_out, tuple):
                 audio = audio_out[0]
             else:
                 audio = audio_out
             
             
             # Normalize to 16-bit PCM
             if hasattr(audio, 'cpu'):
                 audio = audio.cpu()
             if hasattr(audio, 'numpy'):
                audio = audio.numpy()

             if audio.dtype != np.int16:
                max_val = np.max(np.abs(audio))
                if max_val > 0:
                    audio = (audio / max_val * 32767).astype(np.int16)
                else:
                    audio = audio.astype(np.int16)

             return audio
             
        except Exception as e:
            logger.error(f"TTS generation failed: {e}")
            raise

    def _generate_mock_audio(self):
        duration = 1.0
        t = np.linspace(0, duration, int(self.sample_rate * duration))
        audio = (np.sin(2 * np.pi * 440 * t) * 32767).astype(np.int16)
        return audio
