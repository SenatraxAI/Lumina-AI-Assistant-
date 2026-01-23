document.addEventListener('DOMContentLoaded', async () => {
    // --- Elements ---
    const serverUrlInput = document.getElementById('server-url');
    const defaultVoiceSelect = document.getElementById('default-voice');
    const autoReadToggle = document.getElementById('auto-read');
    const includeScreenshotToggle = document.getElementById('include-screenshot');
    const llmProviderSelect = document.getElementById('llm-provider');
    const responseToneSelect = document.getElementById('response-tone');
    const customPersonaGroup = document.getElementById('group-custom-persona');
    const customPersonaInput = document.getElementById('custom-persona');
    const useCudaToggle = document.getElementById('use-cuda');

    // API Keys
    const keyGroups = {
        gemini: document.getElementById('group-gemini'),
        groq: document.getElementById('group-groq'),
        openai: document.getElementById('group-openai'),
        claude: document.getElementById('group-claude')
    };
    const keyInputs = {
        gemini: document.getElementById('api-key-gemini'),
        groq: document.getElementById('api-key-groq'),
        openai: document.getElementById('api-key-openai'),
        claude: document.getElementById('api-key-claude')
    };

    // Buttons / Toggles
    const advancedCard = document.getElementById('advanced-settings-card');
    const advancedHeader = advancedCard.querySelector('.toggle-header');
    const saveSettingsBtn = document.getElementById('save-settings');
    const testConnectionBtn = document.getElementById('test-connection');

    // 🎯 v4.0 Engine Control
    const engineStatusEl = document.getElementById('engine-status');
    const toggleEngineBtn = document.getElementById('toggle-engine');

    // Voice Cloning
    const uploadBtn = document.getElementById('upload-voice-btn');
    const fileInput = document.getElementById('voice-file-input');
    const cloneStatus = document.getElementById('clone-status');

    // --- State Loading ---
    const settings = await chrome.storage.sync.get([
        'serverUrl',
        'defaultVoice',
        'autoRead',
        'includeScreenshot',
        'llmProvider',
        'responseTone',
        'customPersona',
        'apiKeyGemini',
        'apiKeyGroq',
        'apiKeyOpenai',
        'apiKeyClaude',
        'useCuda'
    ]);

    // Populate UI
    serverUrlInput.value = settings.serverUrl || 'http://localhost:8080';
    defaultVoiceSelect.value = settings.defaultVoice || 'alba';
    autoReadToggle.checked = settings.autoRead !== false;
    includeScreenshotToggle.checked = settings.includeScreenshot !== false;
    llmProviderSelect.value = settings.llmProvider || 'gemini';
    responseToneSelect.value = settings.responseTone || 'helpful';
    customPersonaInput.value = settings.customPersona || '';
    useCudaToggle.checked = settings.useCuda === true;

    // Initial Persona State
    if (responseToneSelect.value === 'custom') {
        customPersonaGroup.classList.remove('hidden');
    } else {
        customPersonaGroup.classList.add('hidden');
    }

    keyInputs.gemini.value = settings.apiKeyGemini || '';
    keyInputs.groq.value = settings.apiKeyGroq || '';
    keyInputs.openai.value = settings.apiKeyOpenai || '';
    keyInputs.claude.value = settings.apiKeyClaude || '';

    // Initial UI State
    updateApiKeyVisibility(llmProviderSelect.value);

    // --- Interaction Logic ---

    // 1. Collapsible Advanced Section
    advancedHeader.addEventListener('click', () => {
        advancedCard.classList.toggle('collapsed');
    });

    // 2. LLM Provider Toggle
    llmProviderSelect.addEventListener('change', (e) => {
        updateApiKeyVisibility(e.target.value);
    });

    responseToneSelect.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            customPersonaGroup.classList.remove('hidden');
        } else {
            customPersonaGroup.classList.add('hidden');
        }
    });

    function updateApiKeyVisibility(provider) {
        // Hide all
        Object.values(keyGroups).forEach(g => g.classList.add('hidden'));
        // Show selected
        if (keyGroups[provider]) {
            keyGroups[provider].classList.remove('hidden');
        }
    }

    // 3. Save Settings
    saveSettingsBtn.addEventListener('click', () => {
        const newSettings = {
            serverUrl: serverUrlInput.value,
            defaultVoice: defaultVoiceSelect.value,
            autoRead: autoReadToggle.checked,
            includeScreenshot: includeScreenshotToggle.checked,
            llmProvider: llmProviderSelect.value,
            responseTone: responseToneSelect.value,
            apiKeyGemini: keyInputs.gemini.value,
            apiKeyGroq: keyInputs.groq.value,
            apiKeyOpenai: keyInputs.openai.value,
            apiKeyClaude: keyInputs.claude.value,
            useCuda: useCudaToggle.checked
        };

        chrome.storage.sync.set(newSettings, () => {
            feedback(saveSettingsBtn, 'Saved!', '#10b981');
            // Notify background/content scripts if needed (optional)
        });
    });

    // 🎯 v4.8: State to handle manual starting feedback
    let isStartingManual = false;
    let startingTimeout = null;

    // 4. v4.8 Resident Engine Logic
    async function updateEngineStatus() {
        const DEFAULT_URL = 'http://localhost:8080';
        let serverUrl = serverUrlInput.value || DEFAULT_URL;
        if (serverUrl.endsWith('/')) serverUrl = serverUrl.slice(0, -1);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1200);
            const healthRes = await fetch(`${serverUrl}/api/health`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (healthRes.ok) {
                isStartingManual = false;
                if (startingTimeout) clearTimeout(startingTimeout);

                engineStatusEl.className = 'status-indicator running';
                engineStatusEl.innerText = '🟢 Engine Active';
                toggleEngineBtn.innerText = 'Stop Engine';
                toggleEngineBtn.classList.add('active');
                toggleEngineBtn.disabled = false;
                return;
            }
        } catch (e) {
            // Server offline
        }

        if (isStartingManual) {
            engineStatusEl.className = 'status-indicator starting';
            engineStatusEl.innerText = '🟡 Starting...';
            toggleEngineBtn.disabled = true;
        } else {
            engineStatusEl.className = 'status-indicator stopped';
            engineStatusEl.innerText = '🔴 Engine Offline';
            toggleEngineBtn.innerText = 'Launch Engine';
            toggleEngineBtn.classList.remove('active');
            toggleEngineBtn.disabled = false;
        }
    }

    toggleEngineBtn.addEventListener('click', async () => {
        const isActive = engineStatusEl.classList.contains('running');
        const DEFAULT_URL = 'http://localhost:8080';
        let serverUrl = serverUrlInput.value || DEFAULT_URL;
        if (serverUrl.endsWith('/')) serverUrl = serverUrl.slice(0, -1);

        if (!isActive) {
            // Launch Context
            isStartingManual = true;
            if (startingTimeout) clearTimeout(startingTimeout);
            startingTimeout = setTimeout(() => {
                isStartingManual = false;
                updateEngineStatus();
            }, 30000);

            feedback(toggleEngineBtn, 'Please run "Lumina AI Engine" from Desktop', '#ff9800', true);
            setTimeout(() => { toggleEngineBtn.disabled = false; updateEngineStatus(); }, 3000);
            return;
        }

        // Stop Context (Direct API Shutdown)
        engineStatusEl.className = 'status-indicator starting';
        engineStatusEl.innerText = '🟡 Stopping...';
        toggleEngineBtn.disabled = true;
        isStartingManual = false;

        try {
            await fetch(`${serverUrl}/api/shutdown`, { method: 'POST' });
        } catch (e) { }

        // Wait for server to die
        setTimeout(() => {
            updateEngineStatus();
        }, 3000);
    });

    // Initial status check
    updateEngineStatus();
    // Poll status every 5 seconds while popup is open
    const statusInterval = setInterval(updateEngineStatus, 5000);
    window.addEventListener('unload', () => clearInterval(statusInterval));

    // 5. Test Connection
    testConnectionBtn.addEventListener('click', async () => {
        let url = serverUrlInput.value.trim();
        if (url.endsWith('/')) url = url.slice(0, -1);

        feedback(testConnectionBtn, 'Testing...', undefined, true);

        try {
            const response = await fetch(`${url}/api/health`);
            if (response.ok) {
                const data = await response.json();
                alert(`Connected! Status: ${data.status}`);
            } else {
                throw new Error(`Status ${response.status}`);
            }
        } catch (error) {
            alert(`Connection failed: ${error.message}\nEnsure backend is running at ${url}`);
        } finally {
            testConnectionBtn.textContent = 'Test Server Connection';
            testConnectionBtn.disabled = false;
        }
    });

    // --- Helpers ---

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]); // remove prefix
            reader.onerror = error => reject(error);
        });
    }

    function feedback(btn, text, color, disable = false) {
        const originalText = btn.textContent;
        const originalBg = btn.style.background;

        btn.textContent = text;
        if (color) btn.style.background = color;
        if (disable) btn.disabled = true;

        if (!disable) {
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = originalBg;
            }, 1500);
        }
    }
});
