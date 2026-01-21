# Logic Breakdown: `Setup_Lumina.bat`

This is the technical plan for the "One-Click" installer. Its goal is to take a raw GitHub download and turn it into a fully functional local AI engine without the user ever touching a terminal.

---

## 🛠️ Step 1: Environment Sanity Check
Before doing anything, the script must verify the user's system:
1.  **Python Check**: Is `python` installed? 
    *   If no: Open the Python download page and exit.
    *   If yes: Proceed to check version (require 3.10+).
2.  **Chrome Check**: Verify Chrome is installed (look for registry keys).

## 📦 Step 2: The "Silent" Setup
To avoid cluttering the user's Global Python environment, we use a Virtual Environment (`venv`):
```batch
cd server
python -m venv venv
call venv\Scripts\activate
pip install -r requirements.txt --quiet
```
*   **Optimization**: We will use a "Progress Bar" or "Loading..." text so the user knows the PC is busy installing AI weights.

## 🔗 Step 3: Registration (The Magic Link)
This is where we tell Chrome that Lumina is a "Native Host."
1.  **Path Resolution**: The script finds the absolute path to `bridge.py`.
2.  **Manifest Creation**: It generates a `com.lumina.bridge.json` file.
3.  **Registry Injection**: It runs a `REG ADD` command to place the path in:
    `HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.lumina.bridge`
    *   *This is the only way Chrome is allowed to execute the Python backend.*

## 🚀 Step 4: First Launch & Hand-off
Once setup is complete:
1.  **Open Chrome**: Launch `chrome://extensions` automatically using `start chrome "chrome://extensions"`.
2.  **Instructions**: Display a large final message in the terminal:
    > "SETUP COMPLETE! 🏁\n1. Enable Developer Mode.\n2. Drag the 'extension' folder into this browser window.\n3. Click the Lumina icon to start your AI!"
3.  **Self-Destruct**: The installer closes itself.

---

## 🧠 Why this is "Zero-Cost Reliable"
*   **No Admin Rights Required**: By using `HKEY_CURRENT_USER`, the user doesn't even need to be an Administrator to "install" Lumina.
*   **Portability**: It doesn't matter where they downloaded the zip; the script will calculate all absolute paths on the fly.

### Next for planning:
Would you like to see how the **Native Bridge (`bridge.py`)** handles the communication, or should we design the **Chrome Popup Menu**?
