# server/bridge.py
import sys
import json
import struct
import subprocess
import os
import signal

# Path to the real app
APP_PATH = os.path.join(os.path.dirname(__file__), "app.py")
VENV_PYTHON = os.path.join(os.path.dirname(__file__), "venv", "Scripts", "pythonw.exe")

# If venv doesn't exist yet, fallback to system pythonw
if os.path.exists(VENV_PYTHON):
    # Log startup for debugging
    with open(os.path.join(os.path.dirname(__file__), "bridge.log"), "a") as f:
        f.write(f"Bridge started with VENV: {VENV_PYTHON}\n")
else:
    VENV_PYTHON = "pythonw.exe"
    with open(os.path.join(os.path.dirname(__file__), "bridge.log"), "a") as f:
        f.write(f"Bridge fallback to global pythonw\n")

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
    backend_process = None

    while True:
        msg = get_message()
        if msg is None:
            break

        command = msg.get("command")

        if command == "START":
            if backend_process is None or backend_process.poll() is not None:
                # Use pythonw.exe for INVISIBLE operation
                backend_process = subprocess.Popen([VENV_PYTHON, APP_PATH], 
                                                 creationflags=subprocess.CREATE_NO_WINDOW)
                send_message({"status": "STARTED", "pid": backend_process.pid})
            else:
                send_message({"status": "ALREADY_RUNNING"})

        elif command == "STOP":
            if backend_process and backend_process.poll() is None:
                backend_process.terminate()
                backend_process = None
                send_message({"status": "STOPPED"})
            else:
                send_message({"status": "NOT_RUNNING"})

        elif command == "STATUS":
            is_running = backend_process is not None and backend_process.poll() is None
            send_message({"status": "RUNNING" if is_running else "STOPPED"})

if __name__ == "__main__":
    main()
