
import requests
import time
import os
import sys

# Configuration
API_URL = "http://127.0.0.1:8080"
AUDIO_DIR = os.path.join(os.path.dirname(__file__), "audio")

def test_workflow():
    print(f"Testing API at {API_URL}...")
    
    # 1. Payload (Mimic Extension)
    payload = {
        "text": "Rocket Raccoon is a genetically engineered superhero.",
        "prompt": "Who is this?",
        "voice": "alba",
        "shouldAudio": True,
        "llmProvider": "groq", # Testing Groq path
        "responseTone": "concise"
    }
    
    try:
        # 2. Call Generate
        print("Sending /api/generate request...")
        start_time = time.time()
        response = requests.post(f"{API_URL}/api/generate", json=payload)
        
        if response.status_code != 200:
            print(f"FAILED: Status {response.status_code}")
            print(response.text)
            return
            
        data = response.json()
        print(f"Success! Response time: {time.time() - start_time:.2f}s")
        print(f"Review: {data.get('text')[:50]}...")
        
        audio_url = data.get("audioUrl")
        job_id = data.get("jobId", "") 
        # Attempt to extract job_id from url if not in top level
        if not job_id and audio_url:
            job_id = audio_url.split("/")[-1]

        print(f"Audio URL: {audio_url}")
        print(f"Job ID: {job_id}")
        
        if not audio_url:
             print("FAILED: No audioUrl returned.")
             return

        # 3. Wait for Audio File (TTS is background thread)
        wav_path = os.path.join(AUDIO_DIR, f"{job_id}.wav")
        print(f"Waiting for audio file: {wav_path}")
        
        max_retries = 10
        found = False
        for i in range(max_retries):
            if os.path.exists(wav_path):
                size = os.path.getsize(wav_path)
                if size > 1000: # Ensure not empty
                    print(f"Audio File Found! Size: {size} bytes")
                    found = True
                    break
            time.sleep(1) # Wait 1s
            print(f"Waiting... ({i+1}/{max_retries})")
            
        if found:
            print("✅ TEST PASSED: Full workflow (Text -> Audio) works.")
            # Optional: Cleanup
            # os.remove(wav_path)
        else:
            print("❌ TEST FAILED: Audio file never created (Check server logs for AttributeError).")

    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_workflow()
