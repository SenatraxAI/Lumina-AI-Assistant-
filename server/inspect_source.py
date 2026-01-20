
try:
    from pocket_tts import TTSModel
    import inspect
    
    print(f"File: {inspect.getfile(TTSModel)}")
    print("-" * 20)
    print(inspect.getsource(TTSModel.load_model))

except Exception as e:
    print(f"Error: {e}")
