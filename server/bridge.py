import sys
import json
import struct
import subprocess
import os
import datetime

def log_debug(msg):
    with open(os.path.join(os.path.dirname(__file__), "bridge.log"), "a") as f:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        f.write(f"[{timestamp}] {msg}\n")

# Path to the real app
APP_PATH = os.path.join(os.path.dirname(__file__), "app.py")
VENV_PYTHON = os.path.join(os.path.dirname(__file__), "venv", "Scripts", "python.exe")

# If venv doesn't exist yet, fallback to system python
if not os.path.exists(VENV_PYTHON):
    VENV_PYTHON = "python.exe"

log_debug(f"Bridge started. Python: {VENV_PYTHON}")

def get_message():
    try:
        raw_length = sys.stdin.buffer.read(4)
        if not raw_length:
            return None
        message_length = struct.unpack('@I', raw_length)[0]
        log_debug(f"Received message length: {message_length}")
        message = sys.stdin.buffer.read(message_length).decode('utf-8')
        log_debug(f"Received message body: {message}")
        return json.loads(message)
    except Exception as e:
        log_debug(f"Error in get_message: {str(e)}")
        return None

def send_message(message):
    try:
        content = json.dumps(message).encode('utf-8')
        sys.stdout.buffer.write(struct.pack('@I', len(content)))
        sys.stdout.buffer.write(content)
        sys.stdout.buffer.flush()
        log_debug(f"Sent response: {message}")
    except Exception as e:
        log_debug(f"Error in send_message: {str(e)}")

def main():
    try:
        while True:
            msg = get_message()
            if msg is None:
                log_debug("Message is None, exiting loop.")
                break

            command = msg.get("command")
            log_debug(f"Executing command: {command}")

            if command == "START":
                # 🎯 v4.6.2 Detached Launcher
                ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
                LAUNCHER_PATH = os.path.normpath(os.path.join(ROOT_DIR, "Run_Lumina.bat"))
                log_debug(f"Launching detached: {LAUNCHER_PATH}")
                
                try:
                    subprocess.Popen(f'start "" "{LAUNCHER_PATH}"', shell=True)
                    send_message({"status": "STARTED"})
                except Exception as e:
                    log_debug(f"Launch error: {str(e)}")
                    send_message({"status": "ERROR", "error": str(e)})

            elif command == "STOP":
                log_debug("Attempting API shutdown...")
                try:
                    import urllib.request
                    req = urllib.request.Request("http://localhost:8080/api/shutdown", method="POST")
                    with urllib.request.urlopen(req, timeout=1) as response:
                        pass
                    log_debug("API shutdown request sent.")
                except Exception as e:
                    log_debug(f"API shutdown error: {str(e)}")

                send_message({"status": "STOPPED"})

            elif command == "STATUS":
                # 🎯 v4.6.3: Always report STOPPED if we just started the bridge.
                # popup.js handles the "Starting..." state and the HTTP health check.
                send_message({"status": "STOPPED"}) 

    except Exception as e:
        log_debug(f"BRIDGE_CRITICAL_ERROR: {str(e)}")

if __name__ == "__main__":
    main()
