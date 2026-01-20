
try:
    from pocket_tts import TTSModel
    
    print("Loading model...")
    model = TTSModel.load_model()
    
    print("Testing get_state_for_audio_prompt with 'alba'...")
    try:
        # Try passing the name directly
        state = model.get_state_for_audio_prompt("alba")
        print(f"Success! State type: {type(state)}")
        if isinstance(state, dict):
            print(f"State keys: {list(state.keys())}")
    except Exception as e:
        print(f"Failed with string: {e}")
        
    print("\nTesting with 'marius'...")
    try:
        state = model.get_state_for_audio_prompt("marius")
        print(f"Success! State type: {type(state)}")
    except Exception as e:
        print(f"Failed with string: {e}")

except Exception as e:
    print(f"Error: {e}")
