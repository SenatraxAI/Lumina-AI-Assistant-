
try:
    from pocket_tts import TTSModel
    print("--- CLASS ATTRIBUTES ---")
    for d in dir(TTSModel):
        if not d.startswith("__"):
            print(d)
    
    print("\n--- INSTANCE ATTRIBUTES ---")
    model = TTSModel.load_model()
    for d in dir(model):
        if not d.startswith("__"):
            print(d)

except Exception as e:
    print(f"Error: {e}")
