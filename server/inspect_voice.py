
try:
    from pocket_tts import TTSModel
    import inspect
    
    print("Inspecting get_state_for_audio_prompt...")
    
    # Check unbound
    try:
        sig = inspect.signature(TTSModel.get_state_for_audio_prompt)
        print(f"Signature: {sig}")
    except:
        pass
        
    print("-" * 20)
    
    # Load model to check bound if needed (and attributes)
    model = TTSModel.load_model()
    if hasattr(model, 'get_state_for_audio_prompt'):
        print("Method exists on instance.")
        print(model.get_state_for_audio_prompt.__doc__)
    else:
        print("Method NOT on instance.")

except Exception as e:
    print(f"Error: {e}")
