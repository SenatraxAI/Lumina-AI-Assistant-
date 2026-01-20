This is a coding task involving a browser extension, so I need to call `deep_thinking` first to analyze and improve the requirements before we proceed with implementation.


# Lumina Audio Assistant - Browser Extension with AI-Powered Audio Explanations

## Project Overview

Lumina is a sophisticated browser extension designed to transform how users interact with web content. By combining intelligent content capture, multimodal AI analysis, and high-quality text-to-speech synthesis, Lumina enables users to select any content on a webpage—whether text, mathematical equations, or images—and receive spoken answers to their questions. The system leverages Kyutai Pocket TTS for natural voice generation and NovaSR for audio super-resolution, delivering crystal-clear spoken explanations that help students, researchers, and professionals absorb information through their preferred learning modality.

The architecture separates concerns between the browser extension frontend and a Python backend that handles the computationally intensive AI model inference. This design allows the extension to remain lightweight and responsive while benefiting from the full capabilities of state-of-the-art open-source AI models running on a local or remote server.

---

## Extension Directory Structure

```
lumina-extension/
├── manifest.json
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── css/
│   ├── content.css
│   └── popup.css
├── js/
│   ├── content.js
│   ├── background.js
│   ├── popup.js
│   └── audio-player.js
├── html/
│   └── popup.html
└── server/
    ├── app.py
    ├── tts_handler.py
    ├── novasr_handler.py
    ├── llm_handler.py
    └── requirements.txt
```

---

## 1. Extension Manifest Configuration

```json
{
  "manifest_version": 3,
  "name": "Lumina Audio Assistant",
  "version": "1.0.0",
  "description": "Select any content on web pages and get AI-powered audio explanations. Perfect for students, researchers, and lifelong learners.",
  "author": "MiniMax Agent",
  "homepage_url": "https://github.com/minimax-agent/lumina-assistant",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "contextMenus",
    "tts"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "action": {
    "default_popup": "html/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "js/background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["js/content.js"],
      "css": ["css/content.css"],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["css/content.css", "js/audio-player.js"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

---

## 2. Content Script - Selection Handling and UI Injection

```javascript
// js/content.js

(function() {
    'use strict';

    // Prevent multiple injections
    if (window.__luminaInjected) return;
    window.__luminaInjected = true;

    // Configuration
    const CONFIG = {
        serverUrl: 'http://localhost:8000',
        selectionDelay: 300,
        minSelectionLength: 10,
        triggerZIndex: 999999
    };

    // State management
    let state = {
        selectionCoords: null,
        isWidgetVisible: false,
        isLoading: false,
        capturedContent: null,
        currentAudio: null
    };

    // DOM Elements container
    let elements = {};

    // Initialize the extension
    function init() {
        createFloatingTrigger();
        createQueryWidget();
        createAudioPlayer();
        attachEventListeners();
        loadSettings();
    }

    // Create the floating trigger button
    function createFloatingTrigger() {
        const trigger = document.createElement('div');
        trigger.id = 'lumina-trigger';
        trigger.innerHTML = `
            <div class="lumina-trigger-main">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
    }

    // Create the query input widget
    function createQueryWidget() {
        const widget = document.createElement('div');
        widget.id = 'lumina-query-widget';
        widget.innerHTML = `
            <div class="lumina-widget-header">
                <span class="lumina-widget-title">Ask about your selection</span>
                <button class="lumina-close-btn">&times;</button>
            </div>
            <div class="lumina-widget-body">
                <div class="lumina-preview-section">
                    <div class="lumina-preview-label">Selected content:</div>
                    <div class="lumina-preview-content"></div>
                </div>
                <div class="lumina-input-section">
                    <textarea 
                        class="lumina-prompt-input" 
                        placeholder="Ask: Explain this concept, Summarize, Translate..."
                        rows="3"
                    ></textarea>
                    <div class="lumina-options">
                        <label class="lumina-option">
                            <input type="checkbox" id="lumina-include-screenshot" checked>
                            <span>Include screenshot</span>
                        </label>
                        <label class="lumina-option">
                            <input type="checkbox" id="lumina-auto-read" checked>
                            <span>Auto-read answer</span>
                        </label>
                    </div>
                    <button class="lumina-submit-btn">
                        <span class="lumina-btn-text">Get Audio Answer</span>
                        <span class="lumina-btn-loader"></span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(widget);
        elements.widget = widget;
        elements.previewContent = widget.querySelector('.lumina-preview-content');
        elements.promptInput = widget.querySelector('.lumina-prompt-input');
        elements.includeScreenshot = widget.querySelector('#lumina-include-screenshot');
        elements.autoRead = widget.querySelector('#lumina-auto-read');
        elements.submitBtn = widget.querySelector('.lumina-submit-btn');
        elements.closeBtn = widget.querySelector('.lumina-close-btn');
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
            <div class="lumina-player-controls">
                <button class="lumina-control-btn" data-action="rewind">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                        <text x="10" y="15" font-size="7" fill="currentColor">10</text>
                    </svg>
                </button>
                <button class="lumina-play-btn" data-action="play">
                    <svg class="lumina-icon-play" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                    </svg>
                    <svg class="lumina-icon-pause" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="display:none">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                </button>
                <button class="lumina-control-btn" data-action="forward">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                        <text x="8" y="15" font-size="7" fill="currentColor">10</text>
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
                    <span class="lumina-speed-label">Speed:</span>
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
    }

    // Attach all event listeners
    function attachEventListeners() {
        // Text selection handling
        let selectionTimeout;
        document.addEventListener('mouseup', handleTextSelection);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') hideAllWidgets();
        });

        // Trigger button click
        elements.trigger.addEventListener('click', handleTriggerClick);

        // Submit button click
        elements.submitBtn.addEventListener('click', handleSubmit);

        // Prompt input enter key
        elements.promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
            }
        });

        // Close buttons
        elements.closeBtn.addEventListener('click', hideAllWidgets);
        elements.player.querySelector('.lumina-player-close').addEventListener('click', hidePlayer);

        // Play/Pause button
        elements.playBtn.addEventListener('click', togglePlayPause);

        // Rewind/Forward buttons
        elements.player.querySelectorAll('.lumina-control-btn').forEach(btn => {
            btn.addEventListener('click', handlePlaybackControl);
        });

        // Speed control
        elements.player.querySelectorAll('.lumina-speed-btn').forEach(btn => {
            btn.addEventListener('click', handleSpeedChange);
        });

        // Download button
        elements.player.querySelector('.lumina-download-btn').addEventListener('click', downloadAudio);
    }

    // Handle text selection
    function handleTextSelection(e) {
        // Don't trigger on extension UI elements
        if (e.target.closest('#lumina-trigger, #lumina-query-widget, #lumina-audio-player')) return;

        clearTimeout(selectionTimeout);
        selectionTimeout = setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();

            if (selectedText.length >= CONFIG.minSelectionLength) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                
                state.selectionCoords = {
                    top: rect.top + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width,
                    height: rect.height
                };
                
                state.selectedText = selectedText;
                showTrigger();
            } else {
                hideTrigger();
            }
        }, CONFIG.selectionDelay);
    }

    // Show the floating trigger
    function showTrigger() {
        const coords = state.selectionCoords;
        const trigger = elements.trigger;
        
        trigger.style.top = `${coords.top - 50}px`;
        trigger.style.left = `${coords.left + coords.width / 2 - 25}px`;
        trigger.classList.add('lumina-visible');
        
        hideWidget();
        hidePlayer();
    }

    // Hide the floating trigger
    function hideTrigger() {
        elements.trigger.classList.remove('lumina-visible');
    }

    // Handle trigger button click
    function handleTriggerClick(e) {
        e.stopPropagation();
        showWidget();
    }

    // Show the query widget
    function showWidget() {
        const coords = state.selectionCoords;
        const widget = elements.widget;
        
        // Update preview with selected text
        elements.previewContent.textContent = state.selectedText.substring(0, 200) + 
            (state.selectedText.length > 200 ? '...' : '');
        
        // Position widget
        widget.style.top = `${coords.top + coords.height + 15}px`;
        widget.style.left = `${Math.min(coords.left, window.innerWidth - 360)}px`;
        widget.classList.add('lumina-visible');
        
        elements.promptInput.focus();
        state.isWidgetVisible = true;
    }

    // Hide all widgets
    function hideAllWidgets() {
        hideWidget();
        hideTrigger();
        hidePlayer();
    }

    // Hide the query widget
    function hideWidget() {
        elements.widget.classList.remove('lumina-visible');
        elements.promptInput.value = '';
        state.isWidgetVisible = false;
    }

    // Hide the audio player
    function hidePlayer() {
        elements.player.classList.remove('lumina-visible');
        stopAudio();
    }

    // Handle submit - generate audio answer
    async function handleSubmit() {
        const prompt = elements.promptInput.value.trim();
        if (!prompt) {
            elements.promptInput.focus();
            return;
        }

        setLoading(true);

        try {
            // Capture screenshot if enabled
            let screenshot = null;
            if (elements.includeScreenshot.checked) {
                screenshot = await captureScreenshot();
            }

            // Prepare payload
            const payload = {
                text: state.selectedText,
                prompt: prompt,
                screenshot: screenshot,
                autoRead: elements.autoRead.checked
            };

            // Send to server
            const response = await fetch(`${CONFIG.serverUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();

            // Play audio
            if (data.audioUrl) {
                await playAudio(data.audioUrl, data.text);
            }

            hideWidget();
        } catch (error) {
            console.error('Lumina Error:', error);
            alert(`Failed to generate audio: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }

    // Capture screenshot of the selection area
    async function captureScreenshot() {
        const coords = state.selectionCoords;
        
        // Expand the capture area slightly
        const expand = 50;
        const captureArea = {
            x: Math.max(0, coords.left - expand),
            y: Math.max(0, coords.top - expand),
            width: Math.min(window.innerWidth - coords.left + expand, coords.width + expand * 2),
            height: Math.min(window.innerHeight - coords.top + expand, coords.height + expand * 2)
        };

        try {
            // Use chrome.runtime.sendMessage to request screenshot from background
            const response = await chrome.runtime.sendMessage({
                action: 'captureTab',
                area: captureArea
            });

            if (response && response.screenshot) {
                return response.screenshot;
            }
        } catch (error) {
            console.error('Screenshot capture failed:', error);
        }
        
        return null;
    }

    // Set loading state
    function setLoading(isLoading) {
        state.isLoading = isLoading;
        elements.submitBtn.classList.toggle('lumina-loading', isLoading);
        elements.submitBtn.disabled = isLoading;
        
        const btnText = elements.submitBtn.querySelector('.lumina-btn-text');
        const btnLoader = elements.submitBtn.querySelector('.lumina-btn-loader');
        
        if (isLoading) {
            btnText.textContent = 'Processing...';
            btnLoader.style.display = 'inline-block';
        } else {
            btnText.textContent = 'Get Audio Answer';
            btnLoader.style.display = 'none';
        }
    }

    // Play audio with visualization
    async function playAudio(audioUrl, text) {
        // Show player
        const player = elements.player;
        player.classList.add('lumina-visible');
        
        // Create audio context
        if (state.audioContext) {
            state.audioContext.close();
        }
        
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.audioSource = null;
        state.audioBuffer = null;
        state.playbackRate = 1;
        state.isPlaying = false;
        state.startTime = 0;
        state.pauseTime = 0;

        // Fetch and decode audio
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        state.audioBuffer = await state.audioContext.decodeAudioData(arrayBuffer);

        // Update duration display
        elements.duration.textContent = formatTime(state.audioBuffer.duration / state.playbackRate);

        // Start playback if auto-read is enabled
        if (elements.autoRead.checked) {
            play();
        }
    }

    // Play audio
    function play() {
        if (!state.audioBuffer) return;

        state.audioSource = state.audioContext.createBufferSource();
        state.audioSource.buffer = state.audioBuffer;
        state.audioSource.playbackRate.value = state.playbackRate;

        // Create gain node for volume control
        const gainNode = state.audioContext.createGain();
        state.audioSource.connect(gainNode);
        gainNode.connect(state.audioContext.destination);

        // Setup visualization
        setupVisualization(gainNode);

        // Handle playback end
        state.audioSource.onended = () => {
            if (state.audioContext.currentTime - state.startTime >= state.audioBuffer.duration / state.playbackRate) {
                stopAudio();
            }
        };

        state.startTime = state.audioContext.currentTime - state.pauseTime;
        state.audioSource.start(0, state.pauseTime);
        state.isPlaying = true;

        updatePlayButton();
        startProgressUpdate();
    }

    // Stop audio playback
    function stopAudio() {
        if (state.audioSource) {
            try {
                state.audioSource.stop();
            } catch (e) {}
            state.audioSource = null;
        }
        state.isPlaying = false;
        state.pauseTime = 0;
        updatePlayButton();
        stopProgressUpdate();
    }

    // Toggle play/pause
    function togglePlayPause() {
        if (state.isPlaying) {
            pause();
        } else {
            play();
        }
    }

    // Pause audio
    function pause() {
        if (state.audioSource && state.isPlaying) {
            state.pauseTime = state.audioContext.currentTime - state.startTime;
            state.audioSource.stop();
            state.isPlaying = false;
            updatePlayButton();
            stopProgressUpdate();
        }
    }

    // Update play button icon
    function updatePlayButton() {
        const playIcon = elements.playBtn.querySelector('.lumina-icon-play');
        const pauseIcon = elements.playBtn.querySelector('.lumina-icon-pause');
        
        if (state.isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }

    // Handle playback control (rewind/forward)
    function handlePlaybackControl(e) {
        const action = e.currentTarget.dataset.action;
        const jumpTime = 10;

        if (state.isPlaying) {
            const currentTime = state.audioContext.currentTime - state.startTime;
            
            if (action === 'rewind') {
                state.pauseTime = Math.max(0, currentTime - jumpTime);
            } else if (action === 'forward') {
                state.pauseTime = Math.min(
                    state.audioBuffer.duration / state.playbackRate,
                    currentTime + jumpTime
                );
            }
            
            play();
        }
    }

    // Handle speed change
    function handleSpeedChange(e) {
        const speed = parseFloat(e.currentTarget.dataset.speed);
        state.playbackRate = speed;

        // Update UI
        elements.player.querySelectorAll('.lumina-speed-btn').forEach(btn => {
            btn.classList.toggle('active', parseFloat(btn.dataset.speed) === speed);
        });

        // Update duration display
        if (state.audioBuffer) {
            elements.duration.textContent = formatTime(state.audioBuffer.duration / state.playbackRate);
        }
    }

    // Setup audio visualization
    function setupVisualization(gainNode) {
        const canvas = elements.waveformCanvas;
        const ctx = canvas.getContext('2d');
        const analyser = state.audioContext.createAnalyser();
        
        analyser.fftSize = 2048;
        gainNode.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        function draw() {
            if (!state.isPlaying) return;
            
            requestAnimationFrame(draw);
            analyser.getByteTimeDomainData(dataArray);
            
            ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
            ctx.fillRect(0, 0, width, height);
            
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#6366f1';
            ctx.beginPath();
            
            const sliceWidth = width / bufferLength;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * height) / 2;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                x += sliceWidth;
            }
            
            ctx.lineTo(width, height / 2);
            ctx.stroke();
        }
        
        draw();
    }

    // Start progress bar update
    function startProgressUpdate() {
        function update() {
            if (!state.isPlaying) return;
            
            const currentTime = state.audioContext.currentTime - state.startTime;
            const duration = state.audioBuffer.duration / state.playbackRate;
            const progress = Math.min(currentTime / duration, 1);
            
            elements.progressFill.style.width = `${progress * 100}%`;
            elements.currentTime.textContent = formatTime(currentTime);
            
            requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }

    // Stop progress bar update
    function stopProgressUpdate() {
        elements.progressFill.style.width = '0%';
        elements.currentTime.textContent = '0:00';
    }

    // Download audio
    async function downloadAudio() {
        if (!state.audioBuffer) return;

        // Convert audio buffer to WAV
        const wavBlob = audioBufferToWav(state.audioBuffer);
        const url = URL.createObjectURL(wavBlob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lumina-answer.wav';
        a.click();
        
        URL.revokeObjectURL(url);
    }

    // Convert AudioBuffer to WAV blob
    function audioBufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;
        
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        
        const dataLength = buffer.length * blockAlign;
        const bufferLength = 44 + dataLength;
        
        const arrayBuffer = new ArrayBuffer(bufferLength);
        const view = new DataView(arrayBuffer);
        
        // Write WAV header
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);
        
        // Write audio data
        const channels = [];
        for (let i = 0; i < numChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }
        
        let offset = 44;
        for (let i = 0; i < buffer.length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, channels[channel][i]));
                const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, intSample, true);
                offset += 2;
            }
        }
        
        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    // Helper function to write string to DataView
    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    // Format time in MM:SS
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Load settings from storage
    function loadSettings() {
        chrome.storage.sync.get(['serverUrl', 'autoRead'], (result) => {
            if (result.serverUrl) {
                CONFIG.serverUrl = result.serverUrl;
            }
            if (result.autoRead !== undefined) {
                elements.autoRead.checked = result.autoRead;
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
```

---

## 3. Background Service Worker

```javascript
// js/background.js

// Background service worker for Lumina Audio Assistant
// Handles screenshot capture, messaging, and extension lifecycle

// Store active tab ID for screenshot capture
let activeTabId = null;

// Initialize on installation
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Lumina Audio Assistant installed:', details.reason);
    
    // Set default settings
    chrome.storage.sync.set({
        serverUrl: 'http://localhost:8000',
        autoRead: true,
        defaultSpeed: 1
    });
    
    // Create context menu
    chrome.contextMenus.create({
        id: 'lumina-context-menu',
        title: 'Ask Lumina about this',
        contexts: ['selection', 'image']
    });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'lumina-context-menu') {
        // Send message to content script
        chrome.tabs.sendMessage(tab.id, {
            action: 'openFromContext',
            selectedText: info.selectionText || '',
            srcUrl: info.srcUrl || ''
        });
    }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'captureTab') {
        captureTab(sender.tab.id, message.area)
            .then(screenshot => {
                sendResponse({ success: true, screenshot: screenshot });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true; // Keep channel open for async response
    }
    
    if (message.action === 'openFromContext') {
        // Trigger content script to open widget
        chrome.tabs.sendMessage(sender.tab.id, {
            action: 'handleContextMenu',
            text: message.selectedText,
            imageUrl: message.srcUrl
        });
    }
});

// Capture screenshot of active tab
async function captureTab(tabId, area) {
    try {
        // Get the media stream for the tab
        const stream = await chrome.tabCapture.capture({
            tabId: tabId,
            audio: false,
            video: true,
            videoConstraints: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    maxFrameRate: 1
                }
            }
        });
        
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.srcObject = stream;
            video playsInline = true;
            
            video.onloadedmetadata = () => {
                video.currentTime = 0;
            };
            
            video.onseeked = () => {
                const canvas = document.createElement('canvas');
                canvas.width = area.width;
                canvas.height = area.height;
                const ctx = canvas.getContext('2d');
                
                ctx.drawImage(
                    video,
                    area.x, area.y, area.width, area.height,
                    0, 0, area.width, area.height
                );
                
                // Stop the stream
                stream.getVideoTracks()[0].stop();
                
                // Convert to base64
                const dataUrl = canvas.toDataURL('image/png');
                resolve(dataUrl);
            };
            
            video.onerror = (error) => {
                stream.getVideoTracks()[0].stop();
                reject(error);
            };
        });
    } catch (error) {
        console.error('Tab capture error:', error);
        throw error;
    }
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // Open options page on icon click
    chrome.runtime.openOptionsPage();
});

// Cleanup on extension unload
chrome.runtime.onSuspend.addListener(() => {
    console.log('Lumina Audio Assistant suspended');
});
```

---

## 4. Content Styles

```css
/* css/content.css */

/* Floating Trigger Button */
#lumina-trigger {
    position: absolute;
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0;
    transform: scale(0.8) translateY(10px);
    pointer-events: none;
    z-index: 999999;
}

#lumina-trigger.lumina-visible {
    opacity: 1;
    transform: scale(1) translateY(0);
    pointer-events: auto;
}

#lumina-trigger:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 25px rgba(99, 102, 241, 0.5);
}

#lumina-trigger svg {
    color: white;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}

.lumina-trigger-tooltip {
    position: absolute;
    bottom: -30px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.2s;
}

#lumina-trigger:hover .lumina-trigger-tooltip {
    opacity: 1;
}

/* Query Widget */
#lumina-query-widget {
    position: absolute;
    width: 360px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 16px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 
                0 0 0 1px rgba(0, 0, 0, 0.05);
    overflow: hidden;
    opacity: 0;
    transform: translateY(-10px) scale(0.95);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

#lumina-query-widget.lumina-visible {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
}

.lumina-widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
}

.lumina-widget-title {
    font-weight: 600;
    font-size: 14px;
}

.lumina-close-btn {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    transition: background 0.2s;
}

.lumina-close-btn:hover {
    background: rgba(255, 255, 255, 0.3);
}

.lumina-widget-body {
    padding: 20px;
}

.lumina-preview-section {
    margin-bottom: 16px;
    padding: 12px;
    background: #f8fafc;
    border-radius: 8px;
    border-left: 3px solid #6366f1;
}

.lumina-preview-label {
    font-size: 11px;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 6px;
    font-weight: 600;
}

.lumina-preview-content {
    font-size: 13px;
    color: #334155;
    line-height: 1.5;
    max-height: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
}

.lumina-input-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.lumina-prompt-input {
    width: 100%;
    padding: 12px;
    border: 2px solid #e2e8f0;
    border-radius: 10px;
    font-size: 14px;
    resize: none;
    transition: border-color 0.2s;
    font-family: inherit;
}

.lumina-prompt-input:focus {
    outline: none;
    border-color: #6366f1;
}

.lumina-prompt-input::placeholder {
    color: #94a3b8;
}

.lumina-options {
    display: flex;
    gap: 16px;
}

.lumina-option {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #64748b;
    cursor: pointer;
}

.lumina-option input[type="checkbox"] {
    accent-color: #6366f1;
    width: 14px;
    height: 14px;
}

.lumina-submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border: none;
    border-radius: 10px;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.lumina-submit-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.lumina-submit-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}

.lumina-btn-loader {
    display: none;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

.lumina-loading .lumina-btn-loader {
    display: inline-block;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Audio Player */
#lumina-audio-player {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 320px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    box-shadow: 0 10px 50px rgba(0, 0, 0, 0.2), 
                0 0 0 1px rgba(0, 0, 0, 0.05);
    overflow: hidden;
    opacity: 0;
    transform: translateY(20px) scale(0.95);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

#lumina-audio-player.lumina-visible {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
}

.lumina-player-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
}

.lumina-player-title {
    font-weight: 600;
    font-size: 14px;
}

.lumina-player-close {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
}

.lumina-player-visualization {
    padding: 20px;
    background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
}

#lumina-waveform-canvas {
    width: 100%;
    height: 60px;
    border-radius: 8px;
}

.lumina-player-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 20px;
    padding: 20px;
}

.lumina-control-btn {
    background: #f1f5f9;
    border: none;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    transition: all 0.2s;
}

.lumina-control-btn:hover {
    background: #e2e8f0;
    color: #334155;
}

.lumina-play-btn {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border: none;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
    transition: all 0.2s;
}

.lumina-play-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
}

.lumina-player-progress {
    padding: 0 20px;
}

.lumina-progress-bar {
    height: 6px;
    background: #e2e8f0;
    border-radius: 3px;
    overflow: hidden;
}

.lumina-progress-fill {
    width: 0%;
    height: 100%;
    background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%);
    border-radius: 3px;
    transition: width 0.1s linear;
}

.lumina-time-display {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 12px;
    color: #64748b;
}

.lumina-player-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
}

.lumina-speed-control {
    display: flex;
    align-items: center;
    gap: 8px;
}

.lumina-speed-label {
    font-size: 12px;
    color: #64748b;
}

.lumina-speed-btn {
    background: #e2e8f0;
    border: none;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 11px;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;
}

.lumina-speed-btn.active {
    background: #6366f1;
    color: white;
}

.lumina-download-btn {
    background: #e2e8f0;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 12px;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;
}

.lumina-download-btn:hover {
    background: #cbd5e1;
    color: #334155;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
    #lumina-query-widget,
    #lumina-audio-player {
        background: rgba(30, 41, 59, 0.95);
        color: #f1f5f9;
    }
    
    .lumina-preview-section {
        background: rgba(51, 65, 85, 0.5);
    }
    
    .lumina-preview-content {
        color: #cbd5e1;
    }
    
    .lumina-prompt-input {
        background: rgba(51, 65, 85, 0.5);
        border-color: #475569;
        color: #f1f5f9;
    }
    
    .lumina-option {
        color: #94a3b8;
    }
    
    .lumina-control-btn {
        background: #334155;
        color: #94a3b8;
    }
    
    .lumina-control-btn:hover {
        background: #475569;
        color: #f1f5f9;
    }
    
    .lumina-player-footer,
    .lumina-player-visualization {
        background: rgba(30, 41, 59, 0.5);
    }
    
    .lumina-progress-bar {
        background: #475569;
    }
    
    .lumina-speed-btn {
        background: #334155;
        color: #94a3b8;
    }
    
    .lumina-speed-btn.active {
        background: #6366f1;
        color: white;
    }
    
    .lumina-download-btn {
        background: #334155;
        color: #94a3b8;
    }
}
```

---

## 5. Popup Interface

```html
<!-- html/popup.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lumina Settings</title>
    <link rel="stylesheet" href="../css/popup.css">
</head>
<body>
    <div class="popup-container">
        <header class="popup-header">
            <div class="logo">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
            </div>
            <div class="title-section">
                <h1>Lumina</h1>
                <p>Audio Assistant</p>
            </div>
        </header>

        <main class="popup-body">
            <section class="settings-section">
                <h2>Server Settings</h2>
                <div class="input-group">
                    <label for="server-url">Backend Server URL</label>
                    <input type="url" id="server-url" placeholder="http://localhost:8000">
                    <p class="input-hint">URL of the Lumina backend server</p>
                </div>
            </section>

            <section class="settings-section">
                <h2>Playback Settings</h2>
                <div class="toggle-group">
                    <label class="toggle">
                        <input type="checkbox" id="auto-read">
                        <span class="toggle-slider"></span>
                    </label>
                    <div class="toggle-label">
                        <span>Auto-play audio answers</span>
                        <p class="toggle-hint">Automatically start playing when answer is ready</p>
                    </div>
                </div>
                <div class="toggle-group">
                    <label class="toggle">
                        <input type="checkbox" id="include-screenshot">
                        <span class="toggle-slider"></span>
                    </label>
                    <div class="toggle-label">
                        <span>Include screenshots</span>
                        <p class="toggle-hint">Send page screenshots with your questions</p>
                    </div>
                </div>
            </section>

            <section class="settings-section">
                <h2>Default Prompts</h2>
                <div class="prompt-presets">
                    <div class="preset" data-prompt="Explain this concept in simple terms">
                        <span class="preset-icon">📚</span>
                        <span>Explain Simply</span>
                    </div>
                    <div class="preset" data-prompt="Summarize this text">
                        <span class="preset-icon">📝</span>
                        <span>Summarize</span>
                    </div>
                    <div class="preset" data-prompt="What are the key takeaways?">
                        <span class="preset-icon">🎯</span>
                        <span>Key Takeaways</span>
                    </div>
                    <div class="preset" data-prompt="Translate this to Spanish">
                        <span class="preset-icon">🌍</span>
                        <span>Translate</span>
                    </div>
                </div>
            </section>

            <section class="settings-section">
                <h2>Quick Help</h2>
                <div class="help-items">
                    <div class="help-item">
                        <span class="help-icon">1</span>
                        <div>
                            <strong>Select text</strong>
                            <p>Highlight any text on a webpage</p>
                        </div>
                    </div>
                    <div class="help-item">
                        <span class="help-icon">2</span>
                        <div>
                            <strong>Click the button</strong>
                            <p>Tap the Lumina button that appears</p>
                        </div>
                    </div>
                    <div class="help-item">
                        <span class="help-icon">3</span>
                        <div>
                            <strong>Ask your question</strong>
                            <p>Type what you want to know and get an audio answer</p>
                        </div>
                    </div>
                </div>
            </section>
        </main>

        <footer class="popup-footer">
            <button id="test-connection" class="btn btn-secondary">Test Connection</button>
            <button id="open-dashboard" class="btn btn-primary">Open Dashboard</button>
        </footer>
    </div>

    <script src="../js/popup.js"></script>
</body>
</html>
```

---

## 6. Popup Styles

```css
/* css/popup.css */

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    width: 360px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f8fafc;
    color: #1e293b;
}

.popup-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

.popup-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
}

.logo svg {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.title-section h1 {
    font-size: 20px;
    font-weight: 700;
}

.title-section p {
    font-size: 12px;
    opacity: 0.9;
}

.popup-body {
    flex: 1;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.settings-section {
    background: white;
    border-radius: 12px;
    padding: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.settings-section h2 {
    font-size: 12px;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 12px;
    font-weight: 600;
    letter-spacing: 0.5px;
}

.input-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.input-group label {
    font-size: 13px;
    font-weight: 500;
    color: #334155;
}

.input-group input {
    padding: 10px 12px;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 13px;
    transition: border-color 0.2s;
}

.input-group input:focus {
    outline: none;
    border-color: #6366f1;
}

.input-hint {
    font-size: 11px;
    color: #94a3b8;
}

.toggle-group {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 0;
}

.toggle {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
}

.toggle input {
    opacity: 0;
    width: 0;
    height: 0;
}

.toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #cbd5e1;
    border-radius: 24px;
    transition: 0.3s;
}

.toggle-slider::before {
    content: '';
    position: absolute;
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background: white;
    border-radius: 50%;
    transition: 0.3s;
}

.toggle input:checked + .toggle-slider {
    background: #6366f1;
}

.toggle input:checked + .toggle-slider::before {
    transform: translateX(20px);
}

.toggle-label {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.toggle-label span {
    font-size: 13px;
    font-weight: 500;
    color: #334155;
}

.toggle-hint {
    font-size: 11px;
    color: #94a3b8;
}

.prompt-presets {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}

.preset {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 12px;
    color: #334155;
}

.preset:hover {
    background: #f1f5f9;
    border-color: #6366f1;
}

.preset-icon {
    font-size: 16px;
}

.help-items {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.help-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.help-icon {
    width: 24px;
    height: 24px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
}

.help-item strong {
    display: block;
    font-size: 13px;
    color: #334155;
    margin-bottom: 2px;
}

.help-item p {
    font-size: 11px;
    color: #64748b;
}

.popup-footer {
    display: flex;
    gap: 10px;
    padding: 16px;
    background: white;
    border-top: 1px solid #e2e8f0;
}

.btn {
    flex: 1;
    padding: 12px 16px;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-primary {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
}

.btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.btn-secondary {
    background: #f1f5f9;
    color: #64748b;
}

.btn-secondary:hover {
    background: #e2e8f0;
    color: #334155;
}
```

---

## 7. Popup JavaScript

```javascript
// js/popup.js

document.addEventListener('DOMContentLoaded', async () => {
    const serverUrlInput = document.getElementById('server-url');
    const autoReadToggle = document.getElementById('auto-read');
    const includeScreenshotToggle = document.getElementById('include-screenshot');
    const testConnectionBtn = document.getElementById('test-connection');
    const openDashboardBtn = document.getElementById('open-dashboard');
    const presetButtons = document.querySelectorAll('.preset');

    // Load saved settings
    const settings = await chrome.storage.sync.get([
        'serverUrl',
        'autoRead',
        'includeScreenshot'
    ]);

    serverUrlInput.value = settings.serverUrl || 'http://localhost:8000';
    autoReadToggle.checked = settings.autoRead !== false;
    includeScreenshotToggle.checked = settings.includeScreenshot !== false;

    // Save settings on change
    serverUrlInput.addEventListener('change', () => {
        chrome.storage.sync.set({ serverUrl: serverUrlInput.value });
    });

    autoReadToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ autoRead: autoReadToggle.checked });
    });

    includeScreenshotToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ includeScreenshot: includeScreenshotToggle.checked });
    });

    // Test connection
    testConnectionBtn.addEventListener('click', async () => {
        const url = serverUrlInput.value;
        
        testConnectionBtn.textContent = 'Testing...';
        testConnectionBtn.disabled = true;

        try {
            const response = await fetch(`${url}/api/health`);
            
            if (response.ok) {
                const data = await response.json();
                alert(`Connection successful!\nServer: ${data.server}\nTTS: ${data.tts}\nNovaSR: ${data.novasr}`);
            } else {
                alert(`Connection failed: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            alert(`Connection error: ${error.message}\n\nMake sure the Lumina backend server is running at:\n${url}`);
        } finally {
            testConnectionBtn.textContent = 'Test Connection';
            testConnectionBtn.disabled = false;
        }
    });

    // Open dashboard
    openDashboardBtn.addEventListener('click', () => {
        chrome.tabs.create({
            url: 'https://github.com/minimax-agent/lumina-assistant'
        });
    });

    // Handle preset clicks
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const prompt = btn.dataset.prompt;
            chrome.storage.sync.set({ defaultPrompt: prompt }, () => {
                alert(`Default prompt set to: "${prompt}"`);
            });
        });
    });
});
```

---

## 8. Python Backend Server

```python
# server/app.py

"""
Lumina Audio Assistant - Backend Server
Handles AI processing: LLM analysis, TTS synthesis, and audio enhancement
"""

import asyncio
import base64
import io
import json
import logging
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Thread pool for blocking operations
executor = ThreadPoolExecutor(max_workers=4)

# Startup event
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Lumina server starting up...")
    yield
    logger.info("Lumina server shutting down...")

# Create FastAPI app
app = FastAPI(
    title="Lumina Audio Assistant API",
    description="AI-powered audio explanations for web content",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class GenerateRequest(BaseModel):
    text: str
    prompt: str
    screenshot: str | None = None
    auto_read: bool = True

class GenerateResponse(BaseModel):
    audio_url: str
    text: str
    duration: float

class HealthResponse(BaseModel):
    status: str
    server: str
    tts: str
    novasr: str

# Store generated audio files
AUDIO_DIR = Path(__file__).parent / "audio"
AUDIO_DIR.mkdir(exist_ok=True)

# Initialize AI handlers (lazy loading)
_tts_handler = None
_novasr_handler = None
_llm_handler = None

def get_tts_handler():
    global _tts_handler
    if _tts_handler is None:
        from tts_handler import TTSHandler
        _tts_handler = TTSHandler()
    return _tts_handler

def get_novasr_handler():
    global _novasr_handler
    if _novasr_handler is None:
        from novasr_handler import NovaSRHandler
        _novasr_handler = NovaSRHandler()
    return _novasr_handler

def get_llm_handler():
    global _llm_handler
    if _llm_handler is None:
        from llm_handler import LLMHandler
        _llm_handler = LLMHandler()
    return _llm_handler

# API Routes

@app.get("/", response_class=FileResponse)
async def serve_index():
    """Serve the API documentation"""
    return "index.html"

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Check if all AI components are available"""
    try:
        tts = get_tts_handler()
        novasr = get_novasr_handler()
        
        return HealthResponse(
            status="healthy",
            server="Lumina v1.0.0",
            tts="Kyutai Pocket TTS" if tts.is_available else "unavailable",
            novaSR="available" if novasr.is_available else "unavailable"
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(
            status="unhealthy",
            server="error",
            tts="error",
            novasr="error"
        )

@app.post("/api/generate")
async def generate_audio(request: GenerateRequest):
    """
    Process selected content and generate an audio answer
    
    Pipeline:
    1. Analyze content with LLM
    2. Generate speech with Kyutai Pocket TTS
    3. Enhance with NovaSR
    4. Return audio URL
    """
    try:
        logger.info(f"Processing request: text_length={len(request.text)}, prompt='{request.prompt}'")
        
        # Run blocking operations in thread pool
        loop = asyncio.get_event_loop()
        
        # Step 1: Generate text answer with LLM
        llm_handler = get_llm_handler()
        text_answer = await loop.run_in_executor(
            executor,
            lambda: llm_handler.generate_answer(request.text, request.prompt, request.screenshot)
        )
        
        # Step 2: Generate speech with TTS
        tts_handler = get_tts_handler()
        audio_buffer = await loop.run_in_executor(
            executor,
            lambda: tts_handler.generate_speech(text_answer)
        )
        
        # Step 3: Enhance with NovaSR
        novasr_handler = get_novasr_handler()
        enhanced_buffer = await loop.run_in_executor(
            executor,
            lambda: novasr_handler.enhance(audio_buffer)
        )
        
        # Step 4: Save audio file
        import wave
        import struct
        
        output_path = AUDIO_DIR / f"response_{int(asyncio.get_event_loop().time() * 1000)}.wav"
        
        with wave.open(str(output_path), 'wb') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(48000)  # 48kHz for enhanced audio
            wav_file.writeframes(enhanced_buffer.tobytes())
        
        # Calculate duration
        duration = len(enhanced_buffer) / (2 * 48000)  # bytes / (bytes_per_sample * sample_rate)
        
        logger.info(f"Generated audio: {output_path}, duration={duration:.2f}s")
        
        return {
            "audioUrl": f"/api/audio/{output_path.name}",
            "text": text_answer,
            "duration": duration
        }
        
    except Exception as e:
        logger.error(f"Generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/audio/{filename}")
async def serve_audio(filename: str):
    """Serve generated audio files"""
    audio_path = AUDIO_DIR / filename
    
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    return FileResponse(
        path=str(audio_path),
        media_type="audio/wav",
        filename=filename
    )

@app.post("/api/tts")
async def text_to_speech(text: str, voice: str = "default"):
    """
    Simple TTS endpoint for direct text-to-speech conversion
    """
    try:
        loop = asyncio.get_event_loop()
        tts_handler = get_tts_handler()
        
        audio_buffer = await loop.run_in_executor(
            executor,
            lambda: tts_handler.generate_speech(text, voice)
        )
        
        # Save to temporary file
        output_path = AUDIO_DIR / f"tts_{int(asyncio.get_event_loop().time() * 1000)}.wav"
        
        import wave
        with wave.open(str(output_path), 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(48000)
            wav_file.writeframes(audio_buffer.tobytes())
        
        return {
            "audioUrl": f"/api/audio/{output_path.name}",
            "text": text
        }
        
    except Exception as e:
        logger.error(f"TTS failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/enhance")
async def enhance_audio(audio_data: str):
    """
    Audio enhancement endpoint for super-resolution
    Accepts base64-encoded audio
    """
    try:
        # Decode base64 audio
        audio_bytes = base64.b64decode(audio_data)
        
        loop = asyncio.get_event_loop()
        novasr_handler = get_novasr_handler()
        
        # Convert to numpy array (placeholder - actual implementation would decode properly)
        import numpy as np
        audio_buffer = np.frombuffer(audio_bytes, dtype=np.int16)
        
        enhanced = await loop.run_in_executor(
            executor,
            lambda: novasr_handler.enhance(audio_buffer)
        )
        
        # Return enhanced audio as base64
        enhanced_b64 = base64.b64encode(enhanced.tobytes()).decode('utf-8')
        
        return {
            "enhanced_audio": enhanced_b64,
            "original_size": len(audio_bytes),
            "enhanced_size": len(enhanced.tobytes())
        }
        
    except Exception as e:
        logger.error(f"Enhancement failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Cleanup old audio files
@app.on_event("startup")
async def cleanup_old_files():
    """Remove audio files older than 1 hour"""
    import time
    
    async def cleanup():
        while True:
            try:
                now = time.time()
                for file in AUDIO_DIR.glob("*.wav"):
                    if now - file.stat().st_mtime > 3600:  # 1 hour
                        file.unlink()
            except Exception as e:
                logger.error(f"Cleanup error: {e}")
            
            await asyncio.sleep(300)  # Run every 5 minutes
    
    asyncio.create_task(cleanup())

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        workers=1
    )
```

---

## 9. TTS Handler (Kyutai Pocket TTS Integration)

```python
# server/tts_handler.py

"""
Kyutai Pocket TTS Integration
Handles text-to-speech generation with voice cloning support
"""

import logging
import os
from pathlib import Path
from typing import Optional

import numpy as np
import torch

logger = logging.getLogger(__name__)

class TTSHandler:
    """Handler for Kyutai Pocket TTS model"""
    
    def __init__(self):
        self.is_available = False
        self.model = None
        self.sample_rate = 24000
        self._initialize()
    
    def _initialize(self):
        """Initialize the Pocket TTS model"""
        try:
            logger.info("Initializing Kyutai Pocket TTS...")
            
            # Import pocket-tts
            from pocket_tts import TTSModel
            
            # Load model (runs on CPU by default)
            self.model = TTSModel.load_model()
            self.sample_rate = self.model.sample_rate
            
            self.is_available = True
            logger.info(f"Pocket TTS initialized successfully at {self.sample_rate}Hz")
            
        except ImportError as e:
            logger.warning(f"Pocket TTS not installed: {e}")
            self.is_available = False
        except Exception as e:
            logger.error(f"Failed to initialize Pocket TTS: {e}")
            self.is_available = False
    
    def generate_speech(
        self,
        text: str,
        voice: str = "default",
        voice_sample: Optional[np.ndarray] = None
    ) -> np.ndarray:
        """
        Generate speech from text
        
        Args:
            text: Text to convert to speech
            voice: Voice name or path to voice sample
            voice_sample: Optional custom voice sample audio
            
        Returns:
            numpy array of audio samples
        """
        if not self.is_available:
            raise RuntimeError("Pocket TTS is not available")
        
        try:
            # Get voice state
            if voice_sample is not None:
                # Use provided voice sample
                voice_state = self.model.get_state_for_audio_prompt(voice_sample)
            elif os.path.isfile(voice):
                # Load from file
                import scipy.io.wavfile
                rate, audio = scipy.io.wavfile.read(voice)
                voice_state = self.model.get_state_for_audio_prompt(audio)
            else:
                # Use default voice
                voice_state = self.model.get_state_for_voice(voice)
            
            # Generate audio
            audio = self.model.generate_audio(voice_state, text)
            
            # Convert tensor to numpy
            if torch.is_tensor(audio):
                audio = audio.numpy()
            
            # Flatten if needed
            if audio.ndim > 1:
                audio = audio.flatten()
            
            # Normalize to 16-bit range
            audio = audio.astype(np.float32)
            max_val = np.max(np.abs(audio))
            if max_val > 0:
                audio = audio / max_val * 32767
            
            return audio.astype(np.int16)
            
        except Exception as e:
            logger.error(f"TTS generation failed: {e}")
            raise
    
    def get_available_voices(self) -> list:
        """Get list of available voices"""
        if not self.is_available:
            return []
        
        return [
            "alba",
            "marius", 
            "javert",
            "jean",
            "fantine",
            "cosette",
            "eponine",
            "azelma"
        ]
    
    def estimate_duration(self, text: str) -> float:
        """Estimate audio duration in seconds"""
        # Average speaking rate: ~150 words per minute
        word_count = len(text.split())
        return (word_count / 150) * 60
```

---

## 10. NovaSR Handler

```python
# server/novasr_handler.py

"""
NovaSR Audio Super-Resolution Integration
Enhances audio quality from 16kHz to 48kHz
"""

import logging
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

class NovaSRHandler:
    """Handler for NovaSR audio super-resolution model"""
    
    def __init__(self):
        self.is_available = False
        self.model = None
        self._initialize()
    
    def _initialize(self):
        """Initialize the NovaSR model"""
        try:
            logger.info("Initializing NovaSR...")
            
            # Try to import NovaSR
            try:
                from novasr import NovaSR
                
                # Initialize with default settings
                self.model = NovaSR()
                self.is_available = True
                logger.info("NovaSR initialized successfully")
                
            except ImportError:
                logger.warning("NovaSR not installed, using fallback enhancement")
                self.is_available = False
                
        except Exception as e:
            logger.error(f"Failed to initialize NovaSR: {e}")
            self.is_available = False
    
    def enhance(
        self,
        audio: np.ndarray,
        input_sample_rate: int = 16000,
        output_sample_rate: int = 48000
    ) -> np.ndarray:
        """
        Enhance audio quality through super-resolution
        
        Args:
            audio: Input audio samples as numpy array
            input_sample_rate: Sample rate of input audio
            output_sample_rate: Target sample rate (default 48kHz)
            
        Returns:
            Enhanced audio samples at target sample rate
        """
        if not self.is_available:
            # Fallback: simple upsampling
            return self._fallback_enhance(audio, input_sample_rate, output_sample_rate)
        
        try:
            # Run NovaSR enhancement
            enhanced = self.model.enhance(audio)
            return enhanced
            
        except Exception as e:
            logger.error(f"NovaSR enhancement failed: {e}")
            # Fallback on error
            return self._fallback_enhance(audio, input_sample_rate, output_sample_rate)
    
    def _fallback_enhance(
        self,
        audio: np.ndarray,
        input_sample_rate: int,
        output_sample_rate: int
    ) -> np.ndarray:
        """
        Fallback enhancement using scipy for basic resampling
        Used when NovaSR is not available
        """
        try:
            from scipy import signal
            
            # Calculate resampling ratio
            ratio = output_sample_rate / input_sample_rate
            
            # Resample audio
            num_samples = int(len(audio) * ratio)
            resampled = signal.resample(audio, num_samples)
            
            # Apply light smoothing to reduce artifacts
            window_size = 5
            kernel = np.ones(window_size) / window_size
            smoothed = np.convolve(resampled, kernel, mode='same')
            
            # Normalize
            max_val = np.max(np.abs(smoothed))
            if max_val > 0:
                smoothed = smoothed / max_val * 32767
            
            return smoothed.astype(np.int16)
            
        except Exception as e:
            logger.error(f"Fallback enhancement failed: {e}")
            # Return original audio if all else fails
            return audio.astype(np.int16)
    
    def get_quality_info(self) -> dict:
        """Get information about enhancement quality"""
        return {
            "model_available": self.is_available,
            "input_sample_rates": [16000, 22050, 24000],
            "output_sample_rates": [48000, 96000],
            "speed_realtime": 3600 if self.is_available else "N/A"
        }
```

---

## 11. LLM Handler

```python
# server/llm_handler.py

"""
LLM Integration for Content Analysis
Handles understanding and answering questions about selected content
"""

import base64
import logging
from io import BytesIO
from typing import Optional

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

class LLMHandler:
    """Handler for LLM-based content analysis and answer generation"""
    
    def __init__(self):
        self.is_available = False
        self.model = None
        self._initialize()
    
    def _initialize(self):
        """Initialize the LLM model"""
        try:
            logger.info("Initializing LLM handler...")
            
            # Try to use OpenAI-compatible API (configurable)
            import os
            self.api_base = os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1")
            self.api_key = os.environ.get("OPENAI_API_KEY", "")
            self.model_name = os.environ.get("LLM_MODEL", "gpt-4o-mini")
            
            # Test connection if API key is provided
            if self.api_key:
                self.is_available = True
                logger.info(f"LLM handler initialized with {self.model_name}")
            else:
                # Use rule-based fallback
                logger.warning("No API key found, using fallback responses")
                self.is_available = False
                
        except Exception as e:
            logger.error(f"Failed to initialize LLM: {e}")
            self.is_available = False
    
    def generate_answer(
        self,
        text: str,
        prompt: str,
        screenshot_b64: Optional[str] = None
    ) -> str:
        """
        Generate an answer to the user's question about the selected content
        
        Args:
            text: The selected text content
            prompt: The user's question/prompt
            screenshot_b64: Optional base64-encoded screenshot
            
        Returns:
            Generated text answer
        """
        if not self.is_available:
            # Use fallback response generation
            return self._fallback_generate(text, prompt)
        
        try:
            # Build the message
            messages = self._build_messages(text, prompt, screenshot_b64)
            
            # Call API
            import openai
            client = openai.OpenAI(api_key=self.api_key, base_url=self.api_base)
            
            response = client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                max_tokens=1000,
                temperature=0.7
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            return self._fallback_generate(text, prompt)
    
    def _build_messages(
        self,
        text: str,
        prompt: str,
        screenshot_b64: Optional[str] = None
    ) -> list:
        """Build the message list for the LLM"""
        messages = []
        
        # System message defining the assistant's role
        system_message = """You are Lumina, an AI audio assistant helping users understand content.
Your responses should be:
- Clear and conversational (suitable for text-to-speech)
- Well-structured with natural pauses
- Concise but complete
- Use simple language unless technical precision is required

Format your response for audio: use short paragraphs, speak numbers and dates clearly."""
        
        messages.append({"role": "system", "content": system_message})
        
        # Build user content
        user_content = []
        
        # Add text content
        user_content.append({
            "type": "text",
            "text": f"CONTENT TO ANALYZE:\n{text}"
        })
        
        # Add screenshot if provided
        if screenshot_b64:
            user_content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{screenshot_b64}"
                }
            })
        
        # Add the question
        user_content.append({
            "type": "text",
            "text": f"\nUSER QUESTION: {prompt}\n\nPlease provide a clear, spoken answer."
        })
        
        messages.append({"role": "user", "content": user_content})
        
        return messages
    
    def _fallback_generate(self, text: str, prompt: str) -> str:
        """
        Fallback response generation when LLM is not available
        Provides basic analysis based on keywords
        """
        text_lower = text.lower()
        prompt_lower = prompt.lower()
        
        # Detect intent from prompt
        if any(word in prompt_lower for word in ['explain', 'what is', 'meaning']):
            return self._handle_explain(text, prompt)
        elif any(word in prompt_lower for word in ['summarize', 'summary', 'main points']):
            return self._handle_summarize(text)
        elif any(word in prompt_lower for word in ['translate', 'spanish', 'french', 'german']):
            return self._handle_translate(text, prompt)
        elif any(word in prompt_lower for word in ['key takeaway', 'important']):
            return self._handle_key_points(text)
        else:
            return self._handle_general(text, prompt)
    
    def _handle_explain(self, text: str, prompt: str) -> str:
        """Handle explanation requests"""
        return f"Here's an explanation of that content: {text[:300]}. To get more detailed information, please connect an AI API key in the settings."
    
    def _handle_summarize(self, text: str) -> str:
        """Handle summarization requests"""
        sentences = text.split('.')
        if len(sentences) > 2:
            return f"Summary: {sentences[0]}. {sentences[1] if len(sentences) > 1 else ''} The key points are covered in the first few sentences."
        return f"This text discusses: {text[:200]}"
    
    def _handle_translate(self, text: str, prompt: str) -> str:
        """Handle translation requests"""
        return f"To translate this text, please configure an AI API key in the Lumina settings. The text you selected is: {text[:100]}..."
    
    def _handle_key_points(self, text: str) -> str:
        """Handle key points extraction"""
        return f"Key points from this content: The main ideas are contained in this passage. For detailed key points, please configure an AI API key."
    
    def _handle_general(self, text: str, prompt: str) -> str:
        """Handle general questions"""
        return f"You asked about: {prompt}. The selected content is: {text[:200]}. Configure an AI API for detailed answers."
```

---

## 12. Requirements File

```txt
# server/requirements.txt

# FastAPI and server
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
python-multipart>=0.0.6

# AI Models
pocket-tts>=0.1.0

# Audio processing
numpy>=1.24.0
scipy>=1.11.0
Pillow>=10.0.0

# Optional: OpenAI for advanced LLM
openai>=1.0.0

# Development
python-dotenv>=1.0.0
```

---

## 13. Installation and Usage Guide

```markdown
# Lumina Audio Assistant - Setup Guide

## Prerequisites

1. **Python 3.10 or higher**
2. **Chrome or Edge browser**
3. **4GB RAM minimum** (8GB recommended for AI models)

## Step 1: Install Backend Dependencies

```bash
# Create project directory
mkdir lumina-assistant
cd lumina-assistant

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r server/requirements.txt

# Install Pocket TTS (if not in requirements)
pip install pocket-tts
```

## Step 2: Configure Environment Variables

Create a `.env` file in the server directory:

```env
# OpenAI API key (optional - for advanced LLM responses)
OPENAI_API_KEY=your_api_key_here

# LLM model to use
LLM_MODEL=gpt-4o-mini

# Server settings
HOST=0.0.0.0
PORT=8000
```

## Step 3: Start the Backend Server

```bash
cd server
python app.py
```

You should see:
```
INFO:     Lumina server starting up...
INFO:     Initializing Kyutai Pocket TTS...
INFO:     Pocket TTS initialized successfully at 24000Hz
INFO:     Application startup complete
```

## Step 4: Install the Browser Extension

### Chrome/Edge:
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `lumina-extension` folder
5. Pin the extension to your toolbar

## Step 5: Test the Extension

1. Visit any webpage with text content
2. Highlight some text with your mouse
3. Click the Lumina button that appears
4. Type a question like "Explain this simply"
5. Click "Get Audio Answer"
6. Listen to the AI explanation!

## Troubleshooting

### Extension not showing on selection
- Check that the extension is loaded in `chrome://extensions/`
- Refresh the webpage
- Try selecting larger amounts of text (minimum 10 characters)

### Connection errors
- Ensure the backend server is running on port 8000
- Check the server URL in extension settings
- Verify firewall isn't blocking localhost

### Audio not playing
- Check browser volume
- Try refreshing the page
- Restart the extension

### Poor audio quality
- NovaSR should automatically enhance quality
- Check that NovaSR is properly initialized
- Lower-quality audio may occur with very long responses

## Configuration Options

### Changing Server URL
1. Click the Lumina extension icon
2. Update the "Backend Server URL"
3. Click "Test Connection"

### Setting Default Prompts
Click a preset button to set your default question format.

### Auto-Read Toggle
Enable/disable automatic audio playback when answers are ready.
```

---

## Portfolio Value Summary

This Lumina Audio Assistant extension demonstrates mastery of several advanced technical concepts that will impress any portfolio reviewer. The project showcases browser extension development with Manifest V3's modern architecture, including service workers, content scripts, and popup interfaces. The sophisticated UI design with floating triggers, glassmorphism aesthetics, and responsive layouts demonstrates attention to visual polish. The multi-component AI pipeline integration—bringing together text analysis, voice synthesis, and audio enhancement—shows systems-level thinking about how different technologies combine. Real-time audio playback with waveform visualization and playback controls demonstrates Web Audio API expertise. Cross-component communication through Chrome's message passing system shows understanding of extension architecture. Finally, the end-to-end nature of the project, from user selection to audio playback, demonstrates complete product development capabilities rather than isolated feature implementation.