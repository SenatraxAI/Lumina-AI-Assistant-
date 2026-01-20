try:
    from pocket_tts import TTSModel
    print("TTSModel public attributes:")
    print([x for x in dir(TTSModel) if not x.startswith('_')])
    
    print("\nInstance properties:")
    model = TTSModel.load_model()
    print([x for x in dir(model) if not x.startswith('_')])
    
    if hasattr(model, 'voice_states'):
        print("\nvoice_states contents keys:", list(model.voice_states.keys()))

except Exception as e:
    print(e)
