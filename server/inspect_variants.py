
try:
    import pocket_tts
    from pathlib import Path
    
    # Based on source: Path(__file__).parents[1] / "config/{variant}.yaml"
    # pocket_tts package likely has __init__.py in the root, so one parent up?
    # Let's check pocket_tts.__file__ location first.
    
    pkg_path = Path(pocket_tts.__file__).parent
    print(f"Package Path: {pkg_path}")
    
    # Try finding config dir
    config_dir = pkg_path / "config"
    if not config_dir.exists():
        # Try parent?
         config_dir = pkg_path.parent / "config"
    
    print(f"Config Dir: {config_dir}")
    
    if config_dir.exists():
        print("Variants found:")
        for f in config_dir.glob("*.yaml"):
            print(f" - {f.stem}")
    else:
        print("Config dir not found.")

except Exception as e:
    print(f"Error: {e}")
