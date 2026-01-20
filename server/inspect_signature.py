
try:
    from pocket_tts import TTSModel
    import inspect
    
    # Check class method signature first (unbound)
    print("Function Signature (Unbound):")
    try:
        sig = inspect.signature(TTSModel.generate_audio)
        print(sig)
    except Exception as e:
        print(f"Could not get unbound signature: {e}")

    # Load model and check bound method
    print("\nLoading model...")
    model = TTSModel.load_model()
    
    print("Function Signature (Bound):")
    try:
        sig = inspect.signature(model.generate_audio)
        print(sig)
    except Exception as e:
        print(f"Could not get bound signature: {e}")
        
    print("\nDocstring:")
    print(model.generate_audio.__doc__)

except Exception as e:
    print(f"Error: {e}")
