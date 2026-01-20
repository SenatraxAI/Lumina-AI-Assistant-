
try:
    from pocket_tts import TTSModel
    import inspect
    
    print("Inspecting generate_audio parameters...")
    sig = inspect.signature(TTSModel.generate_audio)
    
    print(f"Signature: {sig}")
    print("-" * 20)
    for name, param in sig.parameters.items():
        print(f"PARAM: {name}")
        print(f"  Kind: {param.kind}")
        print(f"  Default: {param.default}") 
        print("-" * 20)

except Exception as e:
    print(f"Error: {e}")
