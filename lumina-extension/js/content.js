// js/content.js

(function () {
    'use strict';

    // Prevent multiple injections
    if (window.__luminaInjected) return;
    window.__luminaInjected = true;

    // Configuration
    const CONFIG = {
        serverUrl: 'http://localhost:8080',
        minSelectionLength: 10,
    };

    // State management
    let state = {
        selectionCoords: null,
        selectedText: '',
        isLoading: false,
        clonedAudioB64: null,
        audioContext: null,
        audioSource: null,
        audioBuffer: null,
        playbackRate: 1,
        isPlaying: false,
        startTime: 0,
        pauseTime: 0,
        analyser: null,
        animationFrame: null,
        mediaRecorder: null,
        audioChunks: []
    };

    // DOM Elements container
    let elements = {};

    // Initialize the extension
    function init() {
        createFloatingTrigger();
        createAudioPlayer();
        attachEventListeners();
    }

    // Create the floating trigger button
    function createFloatingTrigger() {
        const trigger = document.createElement('div');
        trigger.id = 'lumina-trigger';
        trigger.innerHTML = `
            <div class="lumina-trigger-main">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
            </div>
            <div class="lumina-trigger-tooltip">Ask Lumina</div>
        `;
        document.body.appendChild(trigger);
        elements.trigger = trigger;

        trigger.addEventListener('click', (e) => {
            console.log('Lumina trigger clicked');
            e.stopPropagation();
            hideTrigger();
            showQueryWidget();
        });
    }

    // Create the query input widget
    function showQueryWidget() {
        console.log('Showing query widget', state.selectionCoords);
        if (document.getElementById('lumina-query-widget')) {
            console.log('Widget already exists');
            return;
        }

        const widget = document.createElement('div');
        widget.id = 'lumina-query-widget';

        widget.innerHTML = `
            <div class="lumina-widget-header">
                <span class="lumina-widget-title">Ask Lumina</span>
                <button class="lumina-close-btn">&times;</button>
            </div>
            <div class="lumina-widget-content" style="resize: both; overflow: auto; min-width: 320px; min-height: 200px;">
                <div class="lumina-voice-controls">
                    <select id="lumina-voice-select">
                        <option value="alba">Alba (Default)</option>
                        <option value="marius">Marius</option>
                        <option value="javert">Javert</option>
                        <option value="jean">Jean</option>
                        <option value="fantine">Fantine</option>
                        <option value="cosette">Cosette</option>
                        <option value="eponine">Eponine</option>
                        <option value="azelma">Azelma</option>
                    </select>
                </div>
                <div class="lumina-widget-body">
                    <div class="lumina-input-container">
                        <textarea placeholder="Ask anything about this content..." rows="3"></textarea>
                        <button class="lumina-mic-btn" title="Speak your question">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                <line x1="12" y1="19" x2="12" y2="23"></line>
                                <line x1="8" y1="23" x2="16" y2="23"></line>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="lumina-widget-footer">
                    <label class="lumina-checkbox">
                        <input type="checkbox" checked id="lumina-include-screenshot">
                        <span>Include Screenshot</span>
                    </label>
                    <span id="lumina-model-status" style="font-size: 0.8em; color: #aaa; margin-left: 10px;">Using Gemini (Vision)</span>
                    <button id="lumina-submit-btn">Get Audio Answer</button>
                </div>
            </div>
        `;

        document.body.appendChild(widget);
        elements.widget = widget;

        // Model Toggle Logic
        const checkbox = widget.querySelector('#lumina-include-screenshot');
        const statusLabel = widget.querySelector('#lumina-model-status');

        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                statusLabel.textContent = "Using Gemini (Vision)";
                statusLabel.style.color = "#aaa"; // Reset color
            } else {
                statusLabel.textContent = "Using Groq (Fast)";
                statusLabel.style.color = "#4caf50"; // Green for speed
            }
        });

        // Initialize Draggable
        const header = widget.querySelector('.lumina-widget-header');
        if (header) makeDraggable(widget, header);

        // Position widget (Center if no selection)
        if (state.selectionCoords) {
            const coords = state.selectionCoords;
            const top = coords.top + coords.height + 15;
            const left = Math.min(coords.left, window.innerWidth - 380);
            widget.style.top = `${top}px`;
            widget.style.left = `${Math.max(10, left)}px`;
        } else {
            // Universal mode default position (Center Screen)
            widget.style.top = '20%';
            widget.style.left = 'calc(50% - 190px)'; // 380px width
            widget.style.position = 'fixed';
        }

        widget.classList.add('lumina-visible');

        const textarea = widget.querySelector('textarea');
        textarea.focus();

        // Attach listeners
        widget.querySelector('.lumina-close-btn').onclick = closeQueryWidget;

        const submitBtn = widget.querySelector('#lumina-submit-btn');
        const micBtn = widget.querySelector('.lumina-mic-btn');

        submitBtn.onclick = () => handleSubmit(widget);
        micBtn.onclick = () => toggleVoiceInput(micBtn, textarea);

        textarea.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(widget);
            }
        };

        // Load default voice preference & custom voices
        chrome.storage.sync.get(['defaultVoice'], async (result) => {
            const voiceSelect = widget.querySelector('#lumina-voice-select');

            // Append Custom Voices if they exist locally
            const localData = await chrome.storage.local.get(['customVoices']);
            if (localData.customVoices) {
                localData.customVoices.forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v.id;
                    opt.textContent = v.name;
                    voiceSelect.appendChild(opt);
                });
            }

            if (result.defaultVoice) {
                voiceSelect.value = result.defaultVoice;
            }
        });
    }

    function closeQueryWidget() {
        const widget = document.getElementById('lumina-query-widget');
        if (widget) widget.remove();
        state.clonedAudioB64 = null;
    }

    async function startVoiceCloning(btn) {
        if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
            state.mediaRecorder.stop();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.mediaRecorder = new MediaRecorder(stream);
            state.audioChunks = [];

            state.mediaRecorder.ondataavailable = (e) => state.audioChunks.push(e.data);
            state.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(state.audioChunks, { type: 'audio/wav' });
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    state.clonedAudioB64 = reader.result.split(',')[1];
                    btn.innerHTML = '<span>Voice Cloned! ✅</span>';
                    btn.classList.add('cloned');
                };
                stream.getTracks().forEach(track => track.stop());
            };

            state.mediaRecorder.start();
            btn.innerHTML = '<span>Recording (5s)...</span>';
            setTimeout(() => {
                if (state.mediaRecorder && state.mediaRecorder.state === 'recording') {
                    state.mediaRecorder.stop();
                }
            }, 5000);

        } catch (err) {
            console.error('Mic access error:', err);
            alert('Could not access microphone.');
        }
    }

    function handleVoiceUpload(e, btn) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = () => {
                state.clonedAudioB64 = reader.result.split(',')[1];
                btn.innerHTML = '<span>Sample Uploaded! ✅</span>';
                btn.classList.add('cloned');
            };
        }
    }

    async function handleSubmit(widget) {
        const textarea = widget.querySelector('textarea');
        const submitBtn = widget.querySelector('#lumina-submit-btn');
        const voiceSelect = widget.querySelector('#lumina-voice-select');
        const includeScreenshot = widget.querySelector('#lumina-include-screenshot').checked;

        if (!textarea.value.trim() || state.isLoading) return;

        // Check for extension context invalidation
        if (!chrome.runtime?.id || !chrome.storage) {
            alert("Extension updated. Please refresh.");
            return;
        }

        state.isLoading = true;
        submitBtn.textContent = 'Processing...';
        submitBtn.disabled = true;

        try {
            const settings = await chrome.storage.sync.get([
                'serverUrl',
                'apiKey',
                'voice',
                'autoRead',
                'includeScreenshot',
                'llmProvider',
                'apiKeyOpenai',
                'apiKeyClaude',
                'apiKeyGroq',
                'responseTone',
                'useCuda'
            ]);

            const serverUrl = settings.serverUrl || CONFIG.serverUrl;

            // Logic: Force provider based on Screenshot Toggle
            // If Screenshot Check -> Vision Required -> Gemini
            // If No Screenshot -> Speed Required -> Groq
            const activeProvider = includeScreenshot ? 'gemini' : 'groq';

            // Prepare payload
            const payload = {
                text: state.selectedText || "No text selected (Universal Mode)",
                prompt: textarea.value.trim(),
                voice: voiceSelect.value || settings.voice || 'alba',
                autoRead: settings.autoRead !== false,
                apiKey: settings.apiKey,

                // Multi-LLM Fields (Overridden)
                llmProvider: activeProvider,
                apiKeyOpenai: settings.apiKeyOpenai,
                apiKeyClaude: settings.apiKeyClaude,
                apiKeyGroq: settings.apiKeyGroq,
                responseTone: settings.responseTone || 'helpful',

                // Performance
                useCuda: settings.useCuda === true,
                stream: true
            };

            // Handle Screenshots
            let screenshots = [];
            if (includeScreenshot) {
                submitBtn.textContent = 'Scanning...';
                // Simplified capture for now
                const shot = await captureScreenshot();
                if (shot) screenshots.push(shot);
                payload.screenshots = screenshots;
            }

            // Client-Side Validation: Check for Key Mismatch
            if (payload.llmProvider === 'groq') {
                if (!payload.apiKeyGroq || payload.apiKeyGroq.trim().length < 5) {
                    alert("Groq API Key is missing! Please go to extension settings.");
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Get Audio Answer';
                    state.isLoading = false;
                    return;
                }
                if (payload.apiKeyGroq.startsWith('AIza')) {
                    alert("CONFIGURATION ERROR:\nYou have saved a Google Gemini Key (AIza...) as your Groq Key.\n\nPlease open settings, clear the Groq field, and paste your actual Groq API Key (starts with 'gsk_').");
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Get Audio Answer';
                    state.isLoading = false;
                    return;
                }
            }

            submitBtn.textContent = 'Generating...';

            const response = await fetch(`${serverUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`Server error: ${response.status}`);

            const data = await response.json();

            // Save to history (replacing old SmartMarker logic)
            saveHistoryItem({
                text: state.selectedText,
                question: textarea.value.trim(),
                answer: data.text,
                audioUrl: data.audioUrl,
                timestamp: Date.now()
            });

            // Show audio player
            showAudioPlayer(data, serverUrl);

            // Close widget
            closeQueryWidget();

        } catch (error) {
            console.error('Lumina Error:', error);
            submitBtn.textContent = 'Error! Try again';
            state.isLoading = false;
            setTimeout(() => {
                submitBtn.textContent = 'Get Audio Answer';
                submitBtn.disabled = false;
            }, 3000);
        }
    }

    async function captureSmartScreenshots(coords) {
        // Simple case: no coords or small selection -> single screenshot
        if (!coords || coords.height < window.innerHeight) {
            const s = await captureScreenshot();
            return s ? [s] : [];
        }

        // Complex case: Scrolling Capture
        // Logic: Scroll to top of coords -> capture -> scroll down page by page -> capture
        const screenshots = [];
        const originalScrollY = window.scrollY;

        // Start from top of selection (with a bit of margin)
        let currentY = coords.top - 50;
        const endY = coords.top + coords.height;

        // Limit max screenshots to avoid infinite loops (max 5 pages)
        const MAX_PAGES = 5;
        let pages = 0;

        try {
            while (currentY < endY && pages < MAX_PAGES) {
                window.scrollTo(0, currentY);
                // Wait for render/scroll settle
                await new Promise(r => setTimeout(r, 200));

                const s = await captureScreenshot();
                if (s) screenshots.push(s);

                currentY += (window.innerHeight - 100); // Scroll down 1 viewport (minus overlap)
                pages++;
            }
        } finally {
            // Restore scroll
            window.scrollTo(0, originalScrollY);
        }

        console.log(`Smart Capture: Taken ${screenshots.length} screenshots covering ${Math.round(coords.height)}px`);
        return screenshots;
    }

    async function captureScreenshot() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'captureTab' }, (response) => {
                if (response && response.success) {
                    resolve(response.screenshot);
                } else {
                    console.error('Screenshot failed:', response?.error);
                    resolve(null);
                }
            });
        });
    }

    // Create the audio player overlay
    function createAudioPlayer() {
        const player = document.createElement('div');
        player.id = 'lumina-audio-player';
        player.innerHTML = `
            <div class="lumina-player-header">
                <span class="lumina-player-title">Audio Answer</span>
                <button class="lumina-player-close">&times;</button>
            </div>
            <div class="lumina-player-visualization">
                <canvas id="lumina-waveform-canvas"></canvas>
            </div>
            <div class="lumina-text-answer" style="display:none;"></div>
            <div class="lumina-player-controls">
                <button class="lumina-control-btn" data-action="rewind">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"></path>
                    </svg>
                </button>
                <button class="lumina-play-btn">
                    <svg class="lumina-icon-play" width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                    <svg class="lumina-icon-pause" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" style="display:none">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                </button>
                <button class="lumina-control-btn" data-action="forward">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M13 17l5-5-5-5M6 17l5-5-5-5"></path>
                    </svg>
                </button>
            </div>
            <div class="lumina-player-progress">
                <div class="lumina-progress-bar">
                    <div class="lumina-progress-fill"></div>
                </div>
                <div class="lumina-time-display">
                    <span class="lumina-current-time">0:00</span>
                    <span class="lumina-duration">0:00</span>
                </div>
            </div>
            <div class="lumina-player-footer">
                <div class="lumina-speed-control">
                    <button class="lumina-speed-btn active" data-speed="1">1x</button>
                    <button class="lumina-speed-btn" data-speed="1.5">1.5x</button>
                    <button class="lumina-speed-btn" data-speed="2">2x</button>
                </div>
                <button class="lumina-download-btn">Download</button>
            </div>
        `;
        document.body.appendChild(player);
        elements.player = player;
        elements.playBtn = player.querySelector('.lumina-play-btn');
        elements.waveformCanvas = player.querySelector('#lumina-waveform-canvas');
        elements.progressFill = player.querySelector('.lumina-progress-fill');
        elements.currentTime = player.querySelector('.lumina-current-time');
        elements.duration = player.querySelector('.lumina-duration');

        player.querySelector('.lumina-player-close').onclick = hidePlayer;
        elements.playBtn.onclick = togglePlayPause;

        player.querySelectorAll('.lumina-control-btn').forEach(btn => {
            btn.onclick = () => handlePlaybackControl(btn.dataset.action);
        });

        player.querySelectorAll('.lumina-speed-btn').forEach(btn => {
            btn.onclick = () => handleSpeedChange(parseFloat(btn.dataset.speed));
        });

        player.querySelector('.lumina-download-btn').onclick = downloadAudio;
    }

    async function showAudioPlayer(data, serverUrl) {
        state.isLoading = false;

        // Lazy load player and verify
        if (!elements.player) {
            console.log('Lumina: Lazy-loading Audio Player...');
            createAudioPlayer();
        }

        if (!elements.player) {
            console.error('Lumina: Failed to create audio player!');
            return;
        }

        elements.player.classList.add('lumina-visible');

        // Initialize Draggable
        const header = elements.player.querySelector('.lumina-player-header');
        if (header) makeDraggable(elements.player, header);

        // Show text answer
        const textDisplay = elements.player.querySelector('.lumina-text-answer');
        if (data.text) {
            textDisplay.textContent = data.text;
            textDisplay.style.display = 'block';
        }
        textDisplay.innerHTML = '<span class="lumina-pulse">Listening... (Streaming)</span>';
        textDisplay.style.display = 'block';

        // Load audio
        // Ensure serverUrl doesn't end with slash and audioUrl starts with slash
        const baseUrl = serverUrl.replace(/\/$/, '');
        const path = data.audioUrl.startsWith('/') ? data.audioUrl : `/${data.audioUrl}`;
        const audioUrl = `${baseUrl}${path}`;

        await playAudio(audioUrl, true);
    }

    function hidePlayer() {
        elements.player.classList.remove('lumina-visible');
        stopAudio();
    }

    async function playAudio(audioUrl, isStream = false) {
        stopAudio(); // Stop any existing playback

        console.log("Playing Audio (Mode: Fetch-Blob):", audioUrl);

        try {
            // Fetch audio data first to bypass Mixed Content blocking (HTTPS site -> HTTP localhost)
            // Extension background scripts/content scripts can often bypass this via fetch if CSP allows,
            // whereas <audio src="http://..."> is strictly blocked by the browser.
            const response = await fetch(audioUrl);
            if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            console.log("Audio Blob created:", blobUrl);

            state.audioElement = new Audio();
            state.audioElement.crossOrigin = "anonymous";
            state.audioElement.src = blobUrl;

            state.isPlaying = false;
            state.duration = 0;

            // Visualizer Setup
            setupVisualizerForElement(state.audioElement);

            state.audioElement.addEventListener('loadedmetadata', () => {
                state.duration = state.audioElement.duration;
                elements.duration.textContent = formatTime(state.duration);
                state.audioElement.play().catch(e => console.error("Autoplay blocked:", e));
            });

            state.audioElement.addEventListener('timeupdate', () => {
                if (state.audioElement.duration && isFinite(state.audioElement.duration)) {
                    elements.duration.textContent = formatTime(state.audioElement.duration);
                }
                updateProgressUI();
            });

            state.audioElement.addEventListener('ended', () => {
                state.isPlaying = false;
                updatePlayButton();
                // Revoke URL to free memory, but maybe delay slightly or keep if replay needed
                // URL.revokeObjectURL(blobUrl); 
            });

            state.audioElement.addEventListener('play', () => {
                state.isPlaying = true;
                updatePlayButton();
                setupVisualization();
                startProgressUpdate();
            });

            state.audioElement.addEventListener('error', (e) => {
                console.error("Playback Failed", e);
                const textDisplay = elements.player.querySelector('.lumina-text-answer');
                textDisplay.textContent = "Error playing audio blob.";
            });

            state.audioElement.addEventListener('pause', () => {
                state.isPlaying = false;
                updatePlayButton();
            });

            state.audioElement.playbackRate = state.playbackRate;

        } catch (error) {
            console.error("Audio Fetch Error:", error);
            const textDisplay = elements.player.querySelector('.lumina-text-answer');
            textDisplay.textContent = "Error loading audio: " + error.message;
        }
    }



    function setupVisualizerForElement(audio) {
        if (!state.audioContext) {
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        try {
            if (state.audioContext.state === 'suspended') state.audioContext.resume();
            if (state.mediaElementSource) {
                try { state.mediaElementSource.disconnect(); } catch (e) { }
            }
            state.mediaElementSource = state.audioContext.createMediaElementSource(audio);
            state.analyser = state.audioContext.createAnalyser();
            state.mediaElementSource.connect(state.analyser);
            state.analyser.connect(state.audioContext.destination);
        } catch (e) { console.warn("Vis warn", e); }
    }

    function play() {
        if (state.audioElement) state.audioElement.play();
    }

    function pause() {
        if (state.audioElement) state.audioElement.pause();
    }

    function stopAudio() {
        if (state.audioElement) {
            state.audioElement.pause();
            state.audioElement.currentTime = 0;
            state.audioElement = null; // Detach
        }
        state.isPlaying = false;
        updatePlayButton();
    }

    function togglePlayPause() {
        if (state.isPlaying) pause(); else play();
    }

    function updatePlayButton() {
        const playIcon = elements.playBtn.querySelector('.lumina-icon-play');
        const pauseIcon = elements.playBtn.querySelector('.lumina-icon-pause');
        playIcon.style.display = state.isPlaying ? 'none' : 'block';
        pauseIcon.style.display = state.isPlaying ? 'block' : 'none';
    }

    function handlePlaybackControl(action) {
        if (!state.audioElement) return;
        const current = state.audioElement.currentTime;
        state.audioElement.currentTime = action === 'rewind' ? Math.max(0, current - 5) : Math.min(state.audioElement.duration || 100, current + 5);
    }

    function handleSpeedChange(speed) {
        state.playbackRate = speed;
        elements.player.querySelectorAll('.lumina-speed-btn').forEach(btn => {
            btn.classList.toggle('active', parseFloat(btn.dataset.speed) === speed);
        });
        if (state.audioElement) {
            state.audioElement.playbackRate = speed;
            elements.duration.textContent = formatTime((state.audioElement.duration || 0));
        }
    }

    function setupVisualization() {
        if (!state.analyser) {
            const canvas = elements.waveformCanvas;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear if no analyser
            return;
        }

        const canvas = elements.waveformCanvas;
        const ctx = canvas.getContext('2d');
        const bufferLength = state.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const width = canvas.width = canvas.offsetWidth;
        const height = canvas.height = canvas.offsetHeight;
        function draw() {
            if (!state.isPlaying) return;
            state.animationFrame = requestAnimationFrame(draw);
            state.analyser.getByteTimeDomainData(dataArray);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(0, 0, width, height);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#6366f1';
            ctx.beginPath();
            let sliceWidth = width / bufferLength, x = 0;
            for (let i = 0; i < bufferLength; i++) {
                let v = dataArray[i] / 128.0, y = (v * height) / 2;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                x += sliceWidth;
            }
            ctx.lineTo(width, height / 2);
            ctx.stroke();
        }
        draw();
    }

    function startProgressUpdate() {
        function update() {
            if (!state.isPlaying) return;
            updateProgressUI();
            requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }

    function updateProgressUI() {
        if (!state.audioElement) return;
        const current = state.audioElement.currentTime;
        const duration = state.audioElement.duration;

        if (duration) {
            const progress = Math.min(current / duration, 1);
            elements.progressFill.style.width = `${progress * 100}%`;
            elements.currentTime.textContent = formatTime(current);
        }
    }

    function formatTime(s) {
        const m = Math.floor(s / 60);
        const s_ = Math.floor(s % 60);
        return `${m}:${s_.toString().padStart(2, '0')}`;
    }

    function downloadAudio() {
        if (state.audioElement && state.audioElement.src) {
            const a = document.createElement('a');
            a.href = state.audioElement.src;
            a.download = `lumina_audio_${Date.now()}.wav`; // Blob URL will download correctly
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            alert('No audio to download');
        }
    }

    function handleTextSelection() {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        console.log('Selection changed:', text.length, 'chars');
        if (text.length >= CONFIG.minSelectionLength) {
            const rect = selection.getRangeAt(0).getBoundingClientRect();
            state.selectionCoords = {
                top: rect.top + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width,
                height: rect.height
            };
            console.log('Coords set:', state.selectionCoords);
            state.selectedText = text;
            showTrigger();
        }
    }

    function showTrigger() {
        const trigger = elements.trigger;
        trigger.style.top = `${state.selectionCoords.top - 60}px`;
        trigger.style.left = `${state.selectionCoords.left + state.selectionCoords.width / 2 - 25}px`;
        trigger.classList.add('lumina-visible');
    }

    function hideTrigger() {
        elements.trigger.classList.remove('lumina-visible');
    }

    function attachEventListeners() {
        document.addEventListener('mouseup', handleTextSelection);
        document.addEventListener('mousedown', (e) => {
            // 1. Close Trigger/Widget if clicking outside
            if (!e.target.closest('#lumina-trigger, #lumina-query-widget, #lumina-audio-player, #lumina-history-fab, .lumina-smart-marker')) {
                hideTrigger();
            }

            // 2. Close History FAB if clicking outside of it
            // We only need to check if we are outside the FAB, because the FAB includes the dropdown inside it
            if (!e.target.closest('#lumina-history-fab') && elements.fab) {
                elements.fab.classList.remove('open');
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideTrigger();
                closeQueryWidget();
                hidePlayer();
            }
        });
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg.action === 'handleContextMenu') {
                state.selectedText = msg.text;
                // Position center screen if no coords
                state.selectionCoords = {
                    top: window.scrollY + window.innerHeight / 3,
                    left: window.scrollX + window.innerWidth / 2 - 180,
                    width: 0,
                    height: 0
                };
                showQueryWidget();
            } else if (msg.action === 'handleShortcut') {
                // Try to get selection, fallback to clipboard or empty
                const selectionObj = window.getSelection();
                const selectionText = selectionObj.toString().trim();

                if (selectionText) {
                    state.selectedText = selectionText;
                    try {
                        const range = selectionObj.getRangeAt(0);
                        const rect = range.getBoundingClientRect();
                        state.selectionCoords = {
                            top: rect.top + window.scrollY,
                            left: rect.left + window.scrollX,
                            width: rect.width,
                            height: rect.height
                        };
                    } catch (e) {
                        // Selection exists but no range (e.g. input field)
                        // Use center fallback will happens in showQueryWidget if coords are null? 
                        // No, we must set them here or showQueryWidget needs to handle null
                        state.selectionCoords = null;
                    }
                } else {
                    state.selectedText = ""; // Clean for universal mode
                    state.selectionCoords = null; // Let showQueryWidget handle centering
                }

                showQueryWidget();
            }
        });

        // Initialize History FAB (Already called in init, but ensuring listeners are good)
    }

    // --- New Features Implementation ---

    // 1. Voice Input
    function toggleVoiceInput(btn, textarea) {
        if (!('webkitSpeechRecognition' in window)) {
            alert('Voice input is not supported in this browser.');
            return;
        }

        if (state.isListening) {
            state.recognition.stop();
            state.isListening = false;
            btn.classList.remove('listening');
            return;
        }

        const recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            state.isListening = true;
            btn.classList.add('listening');
            textarea.placeholder = "Listening...";
        };

        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            textarea.value += (textarea.value ? ' ' : '') + text;
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            state.isListening = false;
            btn.classList.remove('listening');
            textarea.placeholder = "Error. Try typing.";
        };

        recognition.onend = () => {
            state.isListening = false;
            btn.classList.remove('listening');
            textarea.placeholder = "Ask anything about this content...";
        };

        state.recognition = recognition;
        recognition.start();
    }

    // 2. Session History (Floating Action Button)
    function createHistoryFAB() {
        if (document.getElementById('lumina-history-fab')) return;

        const fab = document.createElement('div');
        fab.id = 'lumina-history-fab';
        fab.innerHTML = `
            <div class="lumina-fab-icon">💡</div>
            <div class="lumina-history-dropdown">
                <div class="lumina-history-header">
                    <span>Recent Questions</span>
                    <button class="lumina-clear-history" title="Clear All">&times;</button>
                </div>
                <div class="lumina-history-list">
                    <div class="lumina-history-empty">No questions yet</div>
                </div>
            </div>
        `;

        fab.onclick = (e) => {
            // Prevent toggling if clicking INSIDE dropdown
            if (e.target.closest('.lumina-history-dropdown')) return;

            // Otherwise toggle (clicking the main button area)
            fab.classList.toggle('open');
            if (fab.classList.contains('open')) {
                loadHistoryList();
            }
        };

        // Clear history button
        fab.querySelector('.lumina-clear-history').onclick = (e) => {
            e.stopPropagation();
            if (confirm('Clear all history for this page?')) {
                const url = window.location.href;
                chrome.storage.local.remove(url, () => {
                    loadHistoryList();
                });
            }
        };

        document.body.appendChild(fab);
        elements.fab = fab;
    }

    function createSmartMarker(coords, question, data) {
        // Save data but DO NOT render on-page marker
        const markerId = `marker_${Date.now()}`;
        const markerData = {
            id: markerId,
            question: question,
            answer: data.text,
            audioUrl: data.audioUrl,
            timestamp: Date.now()
        };
        saveMarker(markerData);

        // Pulse the FAB to indicate saved
        const fab = document.getElementById('lumina-history-fab');
        if (fab) {
            fab.classList.add('pulse');
            setTimeout(() => fab.classList.remove('pulse'), 1000);
        }
    }

    function saveMarker(data) {
        const url = window.location.href;
        chrome.storage.local.get([url], (result) => {
            const markers = result[url] || [];
            if (markers.length > 50) markers.shift();
            markers.unshift(data); // Add to top
            chrome.storage.local.set({ [url]: markers });
        });
    }

    function loadHistoryList() {
        const list = elements.fab.querySelector('.lumina-history-list');
        const url = window.location.href;

        chrome.storage.local.get([url], (result) => {
            const markers = result[url] || [];
            console.log("History Load: Found", markers.length, "items for url:", url);
            list.innerHTML = '';

            if (markers.length === 0) {
                list.innerHTML = '<div class="lumina-history-empty">No questions yet</div>';
                return;
            }

            markers.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'lumina-history-item';
                itemEl.innerHTML = `
                    <div class="lumina-history-text">
                        <strong>${item.question}</strong>
                        <span class="lumina-history-time">${new Date(item.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <button class="lumina-history-delete" title="Delete">&times;</button>
                `;

                // Click to play
                chrome.storage.sync.get(['serverUrl'], (res) => {
                    const serverUrl = res.serverUrl || 'http://localhost:8080';
                    itemEl.onclick = () => {
                        showAudioPlayer({ text: item.answer, audioUrl: item.audioUrl }, serverUrl);
                    };
                });

                // Delete individual
                itemEl.querySelector('.lumina-history-delete').onclick = (e) => {
                    e.stopPropagation();
                    deleteHistoryItem(item.id);
                };

                list.appendChild(itemEl);
            });
        });
    }

    function deleteHistoryItem(id) {
        const url = window.location.href;
        chrome.storage.local.get([url], (result) => {
            let markers = result[url] || [];
            markers = markers.filter(m => m.id !== id);
            chrome.storage.local.set({ [url]: markers }, () => {
                loadHistoryList(); // Refresh list
            });
        });
    }

    function saveHistoryItem(item) {
        const url = window.location.href;
        chrome.storage.local.get([url], (result) => {
            const items = result[url] || [];
            item.id = Date.now().toString(); // unique ID
            items.push(item);
            // Limit to last 20 items per page
            if (items.length > 20) items.shift();

            chrome.storage.local.set({ [url]: items }, () => {
                // Pulse FAB if visible
                if (elements.fab) {
                    elements.fab.classList.add('pulse');
                    setTimeout(() => elements.fab.classList.remove('pulse'), 2000);
                }
            });
        });
    }

    // --- Draggable Logic ---
    function makeDraggable(element, handle) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        handle.style.cursor = 'move';

        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = element.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            // Fix position
            element.style.position = 'fixed';
            element.style.left = `${initialLeft}px`;
            element.style.top = `${initialTop}px`;
            element.style.transform = 'none'; // Clear centering
            element.style.right = 'auto';
            element.style.bottom = 'auto';
            element.style.resize = 'both'; // Enable resize
            element.style.overflow = 'auto'; // For resize content

            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            element.style.left = `${initialLeft + dx}px`;
            element.style.top = `${initialTop + dy}px`;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            document.body.style.userSelect = '';
        });
    }

    // Main Init
    function init() {
        if (window.luminaInitialized) return;
        window.luminaInitialized = true;

        // Correct function calls
        // Removed undefined calls: injectStyles, createTriggerButton
        createFloatingTrigger();
        createHistoryFAB();
        attachEventListeners();

        // Note: Query Widget is lazy-loaded on trigger click or shortcut
    }

    // Run Init (Simple)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
