# 🎓 Lumina AI: Text-First Voice Assistant

> **Elevate your reading with high-fidelity, on-demand AI explanations.**

Lumina is a premium Chrome extension that transforms static web content into a dynamic audio learning experience. Unlike traditional "read-aloud" tools, Lumina provides deep synthesis and multi-turn dialogue, focusing on a **Text-First, On-Demand** architecture that prioritizes immediate feedback and user agency.

---

## 🚀 Technical Highlights (The Resume Bits)
*   **Latency Masking Architecture**: Implements a two-stage sequential audio cue system ("Sure thing..." → "Alright...") to eliminate perceived synthesis gaps, creating a high-end, responsive feel.
*   **Contextual Multi-Turn Persistence**: Developed a history restoration system that persists entire dialogue threads and audio associations across sessions using `chrome.storage`.
*   **On-Demand TTS Streaming**: Engineered a lazy-loading audio system that only generates speech upon explicit user request, significantly reducing server overhead.
*   **Custom UI Framework**: Built a fully resizable, draggable, glassmorphic overlay using Vanilla JS and CSS Flexbox for zero-dependency performance.
*   **Smart Cache Logic**: Implemented MD5-based server-side caching to provide instant (zero-cue) playback for previously generated content.

---

## ✨ Features
*   **⚡ Instant Response**: Get the explanation as text immediately; listen whenever you're ready.
*   **🗣️ Curated Voices**: Powered by `Kyutai Pocket-TTS` with high-quality models (Alba, Marius, Jean).
*   **🧠 Intelligent Follow-ups**: Ask additional questions without stopping current audio playback.
*   **📐 Flexible Workspace**: Resize and move the query widget and player to fit your browsing style.
*   **interactive Audio**: Full progress-bar control with click-to-seek functionality.

---

## 📦 Project Structure
*   **`/extension`**: Chrome Extension (Manifest V3, Vanilla JS).
*   **`/server`**: Python Backend (FastAPI, PyTorch, Pocket-TTS).
*   **`/docs`**: Technical roadmaps, architectural plans, and deployment guides.

---

## 🛠️ Setup Instructions (Beginner Friendly)

### 1. Requirements
*   **Python 3.10+**
*   **Google Chrome**
*   An API Key for **Gemini** (Free), **Groq** (Free), or **OpenAI**.

### 2. Backend Setup
1.  Navigate to the server folder:
    ```bash
    cd server
    ```
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Start the engine:
    ```bash
    python app.py
    ```

### 3. Extension Setup
1.  Open Chrome and go to `chrome://extensions`.
2.  Turn on **Developer Mode** (top-right toggle).
3.  Click **Load Unpacked**.
4.  Select the `extension` folder from this repository.

### 4. Configuration
*   Click the Lumina 🎓 icon in your extension bar.
*   Enter your `Server URL` (default is `http://localhost:8080`).
*   Paste your **Gemini** or **Groq** API Key.
*   Click **Save Settings**.

---

## 🗺️ Roadmap
*   [ ] **One-Click Installer**: A `.bat` script for windowless background deployment.
*   [ ] **Native Messaging**: Control the backend power state directly from the Chrome UI.

---

## 🤝 Contributing
Contributions are welcome! Whether it's UI polish, bug fixes, or new voice models, feel free to open a PR.

## 🛡️ License
MIT License - Copyright (c) 2026 SenatraxAI.
