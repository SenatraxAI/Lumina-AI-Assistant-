# Plan: The "Invisible Engine" & One-Click Install Strategy

This plan outlines how a user installs Lumina and how they control a hidden backend directly from the Chrome UI.

## 📥 1. The Installation (Getting it on Chrome)

Since we are avoiding the $5 Web Store fee, we use **the "Developer Side-Load" method**, but we make it easier with an installer.

### The Bundle (GitHub Repo):
The user downloads a ZIP containing:
1.  `/extension` folder.
2.  `/server` folder.
3.  `Setup_Lumina.bat` (The Installer).

### The "One-Click" Install Experience:
1.  **Run Installer**: The user double-clicks `Setup_Lumina.bat`.
    *   It installs Python deps and registers the "Native Bridge" (the link between Chrome and your PC).
2.  **Chrome Link**: The installer automatically opens `chrome://extensions`.
3.  **User Action**: The user toggles "Developer Mode" (one-time) and drags the `/extension` folder into the window.
    *   **Result**: Lumina is now a permanent icon in their browser.

---

## 👻 2. The Invisible Backend (No more Black Windows)

To make the backend invisible, we use a **"Detached Process"** strategy.

### How it runs:
When the extension "wakes up" the backend, it launches `pythonw.exe` (the "w" stands for windowless). 
*   **No terminal pop-up.**
*   **No taskbar icon.**
*   It runs silently in the background like a system service (e.g., Spotify or Antivirus).

---

## 🕹️ 3. Start/Stop Control (Managing the Ghost)

Since there is no window to close, the user needs a way to turn it off. We move the "Remote Control" into the **Chrome Extension Popup**.

### The Control Interface:
When the user clicks the Lumina icon in their extension bar, a small menu appears:

| Component | Function |
| :--- | :--- |
| **Status Indicator** | 🟢 Online / 🔴 Offline |
| **Power Button** | **[START SERVER]** / **[STOP SERVER]** |
| **Settings** | Shortcut to change voices or API keys |

### How the "Stop" works:
1.  User clicks **[STOP SERVER]** in the Chrome popup.
2.  Chrome sends a "Terminate" signal through the Native Bridge.
3.  The Bridge forcefully kills the `pythonw.exe` process.
4.  User sees the status change to 🔴 Offline.

---

## 🛠️ Summary of the Workflow

1.  **Installer** handles the dirty work (Paths, Registry, Python).
2.  **Native Bridge** allows Chrome to talk to the PC hardware.
3.  **Popup UI** gives the user a remote control for the "Ghost" engine.

### Next Steps for Planning:
*   Do you want to see the **Popup UI Design** (how the start/stop buttons will look)?
*   Or should we plan the **Installer Script** logic (how it finds Python on a stranger's PC)? 

**I am still strictly in planning mode.**
