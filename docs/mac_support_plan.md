# Plan: Lumina macOS Support 🍎

Supporting macOS requires shifting from `.bat` (Windows) to `.sh` (Shell) scripts and navigating Apple's unique directory structures and security policies.

## 🏗️ 1. The Installer (`Setup_Lumina.sh`)
Instead of a Batch file, we need a Bash script that Mac users can run in their terminal.

### Key differences:
*   **Permissions**: The script must be made executable (`chmod +x Setup_Lumina.sh`).
*   **Virtual Env**: Mac uses `bin/activate` instead of `Scripts/activate`.
*   **Brew Integration**: We should check for `Homebrew` to help users install Python if they don't have it.

---

## 🔗 2. Native Messaging on macOS
Mac and Windows handle Native Messaging manifests differently.

### Path differences:
*   **Windows**: Uses the Registry (`HKEY_CURRENT_USER\...`).
*   **macOS**: Uses a specific file system path:
    `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.lumina.bridge.json`

### Actionable Plan:
1.  **Auto-Copy**: The `.sh` script will automatically copy the manifest to that specific Library folder.
2.  **Path Resolution**: The script will update the `path` inside the JSON to point to an absolute Mac path (e.g., `/Users/Username/.../bridge.sh`).

---

## 💻 3. Apple Silicon (M1/M2/M3) Optimization
Most modern Macs use ARM-based chips. 

### Strategy:
*   **Torch/TTS**: We need to ensure the installer installs the `MPS` (Metal Performance Shaders) version of PyTorch if a Mac is detected. This allows the TTS to run fast on Mac GPUs.
*   **Pythonw**: macOS also supports `pythonw` for invisible processes, but we need to verify permission prompts (some Macs ask for "Accessibility" or "Automation" permissions).

---

## 👻 4. The "Invisible" Mac Service
*   **Process Management**: On Mac, we can use `nohup` or `disown` in our bridge script to ensure the backend detaches completely from the terminal.
*   **Activity Monitor**: The backend will show up in "Activity Monitor" instead of "Task Manager."

---

## 🚀 The "Two-Click" Mac Setup
1.  User downloads ZIP.
2.  User opens Terminal and types: `sh Setup_Lumina.sh`.
3.  Drag extension to Chrome. Done.

**Should we start drafting the Mac-compatible `bridge.sh` and the `Setup_Lumina.sh` installer?** (Still Planning!)
