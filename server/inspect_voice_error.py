
import sys
import os
import logging

# Configure basic logging to stdout
logging.basicConfig(level=logging.WARN)

print("--- DIAGNOSTIC START ---")
try:
    # Add current directory to path to find tts_handler
    sys.path.append(os.path.dirname(__file__))
    from tts_handler import TTSHandler
    print("TTSHandler imported.")
    
    handler = TTSHandler()
    print("TTSHandler initialized.")
    
    print("Attempting to load voice 'alba'...")
    try:
        # Access the internal model directly to reproduce the loop logic
        state = handler.model.get_state_for_audio_prompt('alba')
        print("SUCCESS: Voice 'alba' loaded correctly.")
    except Exception as e:
        print(f"FAILURE: Could not load 'alba'.")
        print(f"ERROR TYPE: {type(e).__name__}")
        print(f"ERROR MSG: {e}")
        import traceback
        traceback.print_exc()

except Exception as e:
    print(f"CRITICAL INIT FAILURE: {e}")
    import traceback
    traceback.print_exc()

print("--- DIAGNOSTIC END ---")
