
try:
    from pocket_tts import TTSModel
    import inspect
    
    print("Inspecting TTSModel.load_model parameters...")
    sig = inspect.signature(TTSModel.load_model)
    print(f"Signature: {sig}")
    
    for name, param in sig.parameters.items():
        print(f"PARAM: {name}, Default: {param.default}")

except Exception as e:
    print(f"Error: {e}")
