# Lumina: The "Zero Cost" Launch Guide 💸

If you're broke, you can still let people use Lumina by leveraging your own hardware and free hosting platforms.

## 1. The "Home Hosting" Strategy (Ngrok)
Make your own computer the server. This is free and fast.

### Steps:
1.  **Get Ngrok**: Download it from [ngrok.com](https://ngrok.com/).
2.  **Start Lumina**: Run your `python server/app.py` as usual.
3.  **Open the Tunnel**: In a new terminal, run:
    ```bash
    ngrok http 8000
    ```
4.  **The Secret URL**: Ngrok will give you an `https://...` URL.
5.  **Configure**: Copy that URL and paste it into the **Lumina Extension Settings** (under Server URL).

> [!CAUTION]
> **Warning**: Your computer must stay on for the extension to work. If you turn off your PC, the extension becomes a paperweight for anyone else using it.

---

## 2. The "Free Cloud" Strategy (Hugging Face)
Hugging Face Spaces provides free hosting for AI apps.

### Benefits:
*   Always on (doesn't depend on your PC).
*   Free HTTPS.
*   Professional-looking URL.

### Challenges:
*   **CPU only**: Free tier doesn't have a GPU, so audio generation will be significantly slower (approx. 10–20 seconds).
*   **Setup**: Requires a small `Dockerfile` or `app.py` change to work in their environment.

---

## 3. Sharing Without the $5 Fee (GitHub)
Don't pay Google for the Web Store. Use "Side-Loading."

### How to share:
1.  **Upload to GitHub**: Put your `lumina-extension` folder in a public GitHub repo.
2.  **Installation Instructions**: Tell your friends/users to:
    *   Download the repo as a ZIP and extract it.
    *   Open `chrome://extensions`.
    *   Enable **Developer Mode**.
    *   Click **Load Unpacked** and select the folder.

---

## 4. Keeping it Free & Secure
*   **No Hardcoded Keys**: NEVER put your API keys in the GitHub code. Make sure users enter their own keys in the extension settings.
*   **Use Free LLMs**: Point users toward **Gemini 2.5 Flash Lite** or **Groq**—both have excellent free tiers.

---

### Suggested First Step:
Would you like me to create a `run_public.bat` file for you? It will automatically start your Python server **and** your Ngrok tunnel with one click.
