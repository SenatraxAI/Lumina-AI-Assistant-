# server/bridge.py
import sys
import json
import struct
import subprocess
import os
import signal

# Path to the real app
APP_PATH = os.path.join(os.path.dirname(__file__), "app.py")
VENV_PYTHON = os.path.join(os.path.dirname(__file__), "venv", "Scripts", "python.exe")

# If venv doesn't exist yet, fallback to system python
if os.path.exists(VENV_PYTHON):
    # Log startup for debugging
    with open(os.path.join(os.path.dirname(__file__), "bridge.log"), "a") as f:
        f.write(f"Bridge started with VENV: {VENV_PYTHON}\n")
else:
    VENV_PYTHON = "python.exe"
    with open(os.path.join(os.path.dirname(__file__), "bridge.log"), "a") as f:
        f.write(f"Bridge fallback to global python\n")

def get_message():
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    message_length = struct.unpack('@I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)

def send_message(message):
    content = json.dumps(message).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('@I', len(content)))
    sys.stdout.buffer.write(content)
    sys.stdout.buffer.flush()

def main():
    try:
        backend_process = None

        while True:
            msg = get_message()
            if msg is None:
                break

            command = msg.get("command")

            if command == "START":
                # 🎯 v4.6.2 Detached Launcher
                # We use "start" to open Run_Lumina.bat in a completely new, independent window.
                # This prevents the terminal's output from corrupting the Native Messaging stream.
                ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
                LAUNCHER_PATH = os.path.normpath(os.path.join(ROOT_DIR, "Run_Lumina.bat"))
                
                try:
                    # 'start "" "path"' is the standard way to launch an independent process on Windows
                    subprocess.Popen(f'start "" "{LAUNCHER_PATH}"', shell=True)
                    send_message({"status": "STARTED"})
                except Exception as e:
                    send_message({"status": "ERROR", "error": str(e)})

            elif command == "STOP":
                # 🎯 v4.6.1: Try API shutdown first as it's more reliable for manual runs
                try:
                    import urllib.request
                    req = urllib.request.Request("http://localhost:8080/api/shutdown", method="POST")
                    with urllib.request.urlopen(req, timeout=1) as response:
                        pass
                except:
                    pass

                if backend_process and backend_process.poll() is None:
                    backend_process.terminate()
                    backend_process = None
                    send_message({"status": "STOPPED"})
                else:
                    send_message({"status": "STOPPED"}) # Always confirm stopped if we attempted API

            elif command == "STATUS":
                is_running = backend_process is not None and backend_process.poll() is None
                send_message({"status": "RUNNING" if is_running else "STOPPED"})
    except Exception as e:
        with open(os.path.join(os.path.dirname(__file__), "bridge.log"), "a") as f:
            f.write(f"BRIDGE_CRITICAL_ERROR: {str(e)}\n")

if __name__ == "__main__":
    main()
