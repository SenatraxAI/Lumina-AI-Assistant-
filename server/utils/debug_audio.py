
import torch
import wave
import os
import glob

print(f"Torch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"Device count: {torch.cuda.device_count()}")
    print(f"Device name: {torch.cuda.get_device_name(0)}")

# Check latest wav file
audio_files = glob.glob("server/audio/*.wav")
if audio_files:
    latest_file = max(audio_files, key=os.path.getctime)
    print(f"\nChecking text file: {latest_file}")
    try:
        with wave.open(latest_file, 'rb') as wf:
            print(f"Channels: {wf.getnchannels()}")
            print(f"Sample width: {wf.getsampwidth()}")
            print(f"Frame rate: {wf.getframerate()}")
            print(f"Frames: {wf.getnframes()}")
            print(f"Duration: {wf.getnframes() / wf.getframerate():.2f}s")
    except Exception as e:
        print(f"Error opening wav: {e}")
else:
    print("\nNo audio files found.")
