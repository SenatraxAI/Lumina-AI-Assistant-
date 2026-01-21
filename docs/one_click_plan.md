# Plan: The "One-Click" Lumina distribution (Zero-Cost)

To satisfy the requirement of **"One-click on the extension starts the backend"** without paying for a cloud server, we must bypass Chrome's security sandbox using a technology called **Native Messaging**.

### The Problem
Normal Chrome extensions are "sandboxed"—they are strictly forbidden from launching files (like `app.py`) on your computer for security reasons.

### The "One-Click" Solution: The Lumina Bridge
We will create a small "Bridge" that sits between Chrome and Python.

---

## 🏗️ The Architecture

### 1. The GitHub Bundle
You will host a single repository with two folders:
*   `/extension`: The Chrome extension code.
*   `/server`: The Python backend.
*   `install.bat`: The "Magic" script.

### 2. The Native Messaging Host (The Secret Ingredient)
When the user runs `install.bat`, it will:
1.  **Auto-Setup**: Create a Python Virtual Environment and install dependencies.
2.  **Manifest Registry**: Tell Windows that an app called `com.lumina.bridge` exists.
3.  **The Trigger**: Now, when the user clicks the extension icon, the extension sends a "Hello" to the Bridge.
4.  **The Launch**: The Bridge (written in Python/Node) sees the message and immediately starts `python app.py` in the background if it isn't already running.

---

## 🚀 The User's "One-Click" Experience

1.  **Download & Install**: The user downloads your GitHub repo and double-clicks `install.bat`. 
2.  **Chrome Setup**: They drag the `/extension` folder into Chrome once.
3.  **Daily Use**: To use Lumina, they don't open any terminals. They just click the Lumina icon in Chrome.
    *   **Behind the scenes**: The extension detects the server is off $\rightarrow$ Sends a signal to the Bridge $\rightarrow$ The Bridge starts the server $\rightarrow$ Lumina is ready 2 seconds later.

---

## 💸 Cost Analysis (Total: $0)
*   **Hosting**: $0 (GitHub is free).
*   **Web Store**: $0 (Users "side-load" the code manually).
*   **Backend Server**: $0 (It runs on the user's own computer only when they need it).

---

## 🛡️ Future-Proofing
If you ever want to move away from "Broke Mode":
*   You can package the `/server` into a single `.exe` using **PyInstaller** so the user doesn't even need to install Python.

### Next Steps (Ask me to start whenever):
1.  Write the `host-manifest.json` for Chrome.
2.  Create the `bridge.py` script to handle the "Launch" command.
3.  Update `content.js` to send the "Startup Signal" to the bridge.

**Should we start drafting the Bridge logic?**
