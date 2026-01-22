#!/bin/bash
# server/bridge.sh (macOS version)

# Path to the real app
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_PATH="$DIR/app.py"
VENV_PYTHON="$DIR/venv/bin/pythonw"

# Fallback if venv doesn't exist
if [ ! -f "$VENV_PYTHON" ]; then
    VENV_PYTHON="python3"
fi

# Function to read native message
get_message() {
    # Read 4 bytes for length (Native Messaging protocol)
    len_raw=$(dd bs=1 count=4 2>/dev/null | perl -e 'print unpack("L", <>);')
    if [ -z "$len_raw" ]; then return; fi
    # Read the JSON message
    msg=$(dd bs=1 count=$len_raw 2>/dev/null)
    echo "$msg"
}

# Function to send native message
send_message() {
    msg_json="$1"
    len=$(echo -n "$msg_json" | wc -c)
    # Write 4 bytes length
    perl -e "print pack('L', $len);"
    # Write JSON
    echo -n "$msg_json"
}

BACKEND_PID=""

while true; do
    MSG=$(get_message)
    if [ -z "$MSG" ]; then break; fi

    COMMAND=$(echo "$MSG" | perl -MJSON -e 'print decode_json(<>)->{command}')

    if [ "$COMMAND" == "START" ]; then
        if [ -z "$BACKEND_PID" ] || ! kill -0 $BACKEND_PID 2>/dev/null; then
            # Start in background using nohup to detach
            nohup "$VENV_PYTHON" "$APP_PATH" > /dev/null 2>&1 &
            BACKEND_PID=$!
            send_message "{\"status\": \"STARTED\", \"pid\": $BACKEND_PID}"
        else
            send_message "{\"status\": \"ALREADY_RUNNING\"}"
        fi

    elif [ "$COMMAND" == "STOP" ]; then
        if [ ! -z "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
            kill $BACKEND_PID
            BACKEND_PID=""
            send_message "{\"status\": \"STOPPED\"}"
        else
            send_message "{\"status\": \"NOT_RUNNING\"}"
        fi

    elif [ "$COMMAND" == "STATUS" ]; then
        if [ ! -z "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
            send_message "{"status": "RUNNING"}"
        else
            send_message "{"status": "STOPPED"}"
        fi
    fi
done
