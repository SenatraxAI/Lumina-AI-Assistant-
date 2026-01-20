
try:
    from pocket_tts import TTSModel
    import inspect

    with open("server/model_info.txt", "w") as f:
        f.write("TTSModel imported successfully.\n")
        
        # Load model
        model = TTSModel.load_model()
        f.write("Model Loaded.\n\n")
        
        f.write("Public Methods/Attributes:\n")
        for name in dir(model):
            if not name.startswith('_'):
                try:
                    attr = getattr(model, name)
                    if callable(attr):
                        f.write(f"Method: {name}\n")
                    else:
                        f.write(f"Attr: {name}\n")
                except:
                    f.write(f"Error accessing: {name}\n")

except Exception as e:
    with open("server/model_info.txt", "w") as f:
        f.write(f"Error: {e}")
