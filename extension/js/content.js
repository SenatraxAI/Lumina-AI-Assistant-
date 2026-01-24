// js/content.js
(function () {
    'use strict';
    if (window.__luminaInjected) return;
    window.__luminaInjected = true;

    const CONFIG = { serverUrl: 'http://localhost:8080', minSelectionLength: 10 };
    let state = {
        selectionCoords: null, selectedText: '', isLoading: false,
        audioElement: null, blobUrl: null,
        currentConversation: [], // Track conversation history
        activeModel: 'gemini', // 🎯 v4.8.4: Track the model used for the current thread
        pendingPrompts: new Set() // 🎯 v3.5.3: Prevent duplicate generations
    };
    let elements = {};

    console.log('🎓 Lumina Extension Loaded! v2.0 - Trigger Position Fix');

    function init() {
        console.log('🎓 [INIT] Starting Lumina initialization');
        ensureStyles();
        console.log('🎓 [INIT] Styles ensured');
        createFloatingTrigger();
        console.log('🎓 [INIT] Trigger created:', elements.trigger);
        createHistoryFAB();
        console.log('🎓 [INIT] History FAB created');
        attachEventListeners();
        console.log('🎓 [INIT] Event listeners attached');

        // Start periodic history cleanup
        setInterval(validateHistoryItems, 5 * 60 * 1000);
        validateHistoryItems();
    }

    const STYLES = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        #lumina-trigger {
            position: fixed; z-index: 2147483647; width: 54px; height: 54px;
            background: rgba(255, 159, 10, 0.95); border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; box-shadow: 0 10px 25px rgba(255, 159, 10, 0.4);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            opacity: 0; transform: scale(0.5) translateY(20px);
            pointer-events: none; color: #fff; border: none;
        }
        #lumina-trigger.lumina-visible { opacity: 1; transform: scale(1) translateY(0); pointer-events: auto; }
        .lumina-overlay {
            font-family: 'Inter', system-ui, sans-serif;
            position: absolute; z-index: 10000;
            background: rgba(25, 25, 30, 0.85);
            backdrop-filter: blur(25px) saturate(180%);
            -webkit-backdrop-filter: blur(25px) saturate(180%);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 20px; box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4);
            color: #fff; overflow: hidden; transition: opacity 0.4s, transform 0.4s;
            display: flex; flex-direction: column;
            min-width: 320px; min-height: 200px;
        }
        #lumina-query-widget { width: 380px; height: auto; opacity: 0; transform: translateY(20px) scale(0.95); display: none; }
        #lumina-query-widget.lumina-visible { opacity: 1; transform: translateY(0) scale(1); display: flex; }
        .lumina-header { padding: 16px 20px; background: rgba(255, 255, 255, 0.05); border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: space-between; cursor: move; flex-shrink: 0; }
        .lumina-header-title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 10px; }
        .lumina-header-title::before { content: ''; width: 10px; height: 10px; background: #FF9F0A; border-radius: 50%; box-shadow: 0 0 10px #FF9F0A; }
        .lumina-close-btn { background: none; border: none; color: #fff; cursor: pointer; font-size: 22px; padding: 0 5px; opacity: 0.6; }
        .lumina-close-btn:hover { opacity: 1; }
        .lumina-body { padding: 20px; flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .lumina-input-wrap { background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 15px; padding: 10px; margin-bottom: 15px; flex: 1; display: flex; }
        .lumina-textarea { width: 100%; background: transparent; border: none; color: #fff; font-size: 14px; outline: none; resize: none; min-height: 80px; flex: 1; }
        .lumina-controls { display: flex; gap: 10px; margin-bottom: 15px; flex-shrink: 0; }
        .lumina-select { flex: 1; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; color: #fff; padding: 8px; font-size: 13px; outline: none; }
        .lumina-select option { background: #1e293b; color: #fff; padding: 8px; }
        .lumina-btn-primary { width: 100%; background: linear-gradient(135deg, #FF9F0A, #FF4500); border: none; border-radius: 12px; color: #fff; padding: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; flex-shrink: 0; }
        .lumina-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(255, 69, 0, 0.4); }
        #lumina-player-container { position: absolute; bottom: 30px; right: 30px; width: 400px; height: 500px; opacity: 0; transform: translateY(30px) scale(0.9); display: none; }
        #lumina-player-container.visible { opacity: 1; transform: translateY(0) scale(1); display: flex; }
        .lumina-response-box { padding: 20px; font-size: 15px; line-height: 1.6; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; scroll-behavior: smooth; }
        .lumina-chat-msg { padding: 12px 16px; border-radius: 12px; font-size: 14px; max-width: 90%; word-wrap: break-word; line-height: 1.6; }
        .lumina-msg-user { background: rgba(255, 159, 10, 0.15); color: #FF9F0A; align-self: flex-end; border-bottom-right-radius: 2px; border: 1px solid rgba(255, 159, 10, 0.2); }
        .lumina-msg-ai { background: rgba(255, 255, 255, 0.05); color: rgba(255,255,255,0.9); align-self: flex-start; border-bottom-left-radius: 2px; border: 1px solid rgba(255, 255, 255, 0.1); }
        .lumina-msg-ai.first { font-size: 15px; max-width: 100%; border: none; background: none; padding: 0; line-height: 1.7; margin-bottom: 5px; }
        .lumina-msg-ai p { margin: 0 0 10px 0; }
        .lumina-msg-ai p:last-child { margin-bottom: 0; }
        .lumina-audio-controls { padding: 15px 20px; background: rgba(0,0,0,0.2); display: flex; align-items: center; gap: 15px; border-top: 1px solid rgba(255,255,255,0.05); transition: height 0.3s; overflow: hidden; flex-shrink: 0; }
        .lumina-audio-controls.hidden { height: 0; padding: 0; border-top: none; }
        .lumina-play-pill { width: 40px; height: 40px; border-radius: 50%; background: #FF9F0A; border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .lumina-progress-bg { flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; cursor: pointer; position: relative; }
        .lumina-progress-val { height: 100%; background: #FF9F0A; border-radius: 3px; width: 0%; }
        #lumina-history-fab { position: fixed; bottom: 30px; left: 30px; width: 48px; height: 48px; background: rgba(40, 40, 45, 0.8); backdrop-filter: blur(10px); border-radius: 15px; border: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 9999; font-size: 22px; transition: all 0.3s; }
        #lumina-history-fab.open { border-color: #FF9F0A; }
        #lumina-history-list { position: fixed; bottom: 90px; left: 30px; width: 320px; max-height: 400px; background: rgba(25, 25, 30, 0.95); backdrop-filter: blur(20px); border-radius: 15px; border: 1px solid rgba(255, 255, 255, 0.15); display: none; flex-direction: column; z-index: 10001; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        #lumina-history-list.visible { display: flex; animation: slideUp 0.3s forwards; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .lumina-history-header { padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.1); font-weight: 600; font-size: 13px; display: flex; justify-content: space-between; }
        .lumina-history-items { overflow-y: auto; padding: 10px; }
        .lumina-history-item { padding: 10px; border-radius: 10px; background: rgba(255,255,255,0.03); margin-bottom: 8px; cursor: pointer; transition: 0.2s; font-size: 13px; color: #fff; }
        .lumina-history-item:hover { background: rgba(255,255,255,0.08); }
        .lumina-history-q { font-weight: 600; margin-bottom: 4px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #fff; }
        .lumina-history-a { opacity: 0.6; font-size: 11px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; color: #e2e8f0; }
        .lumina-bubble-play { 
            background: none; border: none; color: #FF9F0A; cursor: pointer; 
            font-size: 18px; opacity: 0.6; padding: 4px; margin-top: 2px;
            transition: all 0.2s; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
            width: 24px; height: 24px;
        }
        .lumina-bubble-play:hover { opacity: 1; transform: scale(1.1); }
        .lumina-bubble-play.loading { position: relative; color: transparent; pointer-events: none; }
        .lumina-bubble-play.loading::after {
            content: ""; position: absolute; width: 14px; height: 14px;
            border: 2px solid #FF9F0A; border-top-color: transparent; border-radius: 50%;
            animation: lumina-spin 0.6s linear infinite;
        }
        @keyframes lumina-spin { to { transform: rotate(360deg); } }
        .lumina-toast { position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); color: #fff; padding: 10px 20px; border-radius: 20px; z-index: 100000; font-size: 14px; }
        .lumina-resize-handle {
            position: absolute; bottom: 0; right: 0; width: 15px; height: 15px;
            cursor: nwse-resize; z-index: 10001; opacity: 0.3;
            background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 60%, transparent 60%, transparent 70%, rgba(255,255,255,0.2) 70%);
        }
        .lumina-resize-handle:hover { opacity: 0.8; }
        .lumina-vision-toggle {
            cursor: pointer; font-size: 18px; opacity: 0.4; transition: all 0.2s;
            display: flex; align-items: center; justify-content: center;
            width: 32px; height: 32px; border-radius: 8px;
        }
        .lumina-vision-toggle.active { opacity: 1; color: #FF9F0A; background: rgba(255, 159, 10, 0.1); }
        .lumina-vision-toggle:hover { opacity: 0.8; transform: scale(1.1); }
        
        .lumina-shutter {
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: #fff; z-index: 2147483647; pointer-events: none; opacity: 0;
            transition: opacity 0.15s;
        }
        .lumina-shutter.flash { opacity: 0.8; }
        
        .lumina-capturing .lumina-overlay, 
        .lumina-capturing #lumina-trigger, 
        .lumina-capturing #lumina-history-fab { 
            display: none !important; 
        }

        .lumina-context-badge {
            padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 10px; text-transform: uppercase;
        }
        .badge-success { background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .badge-warning { background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
        .badge-info { background: rgba(59, 130, 246, 0.2); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); }
    `;

    function ensureStyles() {
        if (document.getElementById('lumina-core-styles')) return;
        const style = document.createElement('style');
        style.id = 'lumina-core-styles';
        style.textContent = STYLES;
        document.head.appendChild(style);
    }

    function createFloatingTrigger() {
        console.log('🎓 [CREATE_TRIGGER] Called');
        if (elements.trigger) {
            console.log('🎓 [CREATE_TRIGGER] Trigger already exists, skipping');
            return;
        }
        const trigger = document.createElement('div');
        trigger.id = 'lumina-trigger';
        trigger.innerHTML = '🎓';
        trigger.style.fontSize = '28px';
        console.log('🎓 [CREATE_TRIGGER] Appending to body');
        document.body.appendChild(trigger);
        elements.trigger = trigger;
        console.log('🎓 [CREATE_TRIGGER] Trigger element:', trigger);
        trigger.onclick = (e) => {
            console.log('🎓 [CLICK] Trigger clicked! Event:', e);
            e.stopPropagation();

            // Save trigger position BEFORE hiding (add scroll offset for absolute positioning)
            const rect = trigger.getBoundingClientRect();
            state.triggerPosition = {
                top: rect.bottom + window.scrollY + 10,
                left: rect.left + window.scrollX
            };
            console.log('🎓 [CLICK] Saved trigger position (with scroll):', state.triggerPosition);

            console.log('🎓 [CLICK] Hiding trigger');
            hideTrigger();
            console.log('🎓 [CLICK] Calling showQueryWidget');
            showQueryWidget();
        };
        console.log('🎓 [CREATE_TRIGGER] Click handler attached');
    }

    async function showQueryWidget(text = null) {
        console.log('🎓 [SHOW_WIDGET] Called, text:', text);
        if (document.getElementById('lumina-query-widget')) {
            console.log('🎓 [SHOW_WIDGET] Widget already exists, returning');
            return;
        }
        if (text) {
            state.selectedText = text;
            console.log('🎓 [SHOW_WIDGET] Set selectedText:', text);
        }

        console.log('🎓 [SHOW_WIDGET] Fetching API keys from storage...');
        try {
            const settings = await chrome.storage.sync.get(['apiKeyGemini', 'apiKeyGroq', 'apiKeyOpenai', 'apiKeyClaude']);
            console.log('🎓 [SHOW_WIDGET] Settings retrieved:', settings);

            let modelOptions = '';
            // 🎯 v4.8.3: Consistently use apiKeyGemini
            if (settings.apiKeyGroq) modelOptions += '<option value="groq">Groq (Text Only)</option>';
            if (settings.apiKeyGemini) modelOptions += '<option value="gemini">Gemini 2.5 Flash Lite (Vision ✓)</option>';
            if (settings.apiKeyClaude) modelOptions += '<option value="claude">Claude (Vision ✓)</option>';
            if (settings.apiKeyOpenai) modelOptions += '<option value="openai">GPT-4 (Vision ✓)</option>';

            // Fallback if user hasn't set keys yet
            if (!modelOptions) modelOptions = '<option value="gemini">Lumina (Default)</option>';
            console.log('🎓 [SHOW_WIDGET] Model options generated:', modelOptions);

            console.log('🎓 [SHOW_WIDGET] Creating widget element...');
            const widget = document.createElement('div');
            widget.id = 'lumina-query-widget';
            widget.className = 'lumina-overlay';
            widget.innerHTML = `
                <div class="lumina-header">
                    <div class="lumina-header-title">Ask Lumina</div>
                    <button class="lumina-close-btn">&times;</button>
                </div>
                <div class="lumina-body">
                    <div class="lumina-input-wrap">
                        <textarea class="lumina-textarea" placeholder="Ask anything..."></textarea>
                        <div class="lumina-vision-toggle" id="lumina-vis-tg" title="Toggle Vision (See Screen)">👁️</div>
                    </div>
                    
                    <div id="lumina-context-bar" style="font-size: 11px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; opacity: 0.9;">
                        <!-- Updated dynamically via updateContextStatus() -->
                    </div>

                    <div class="lumina-controls">
                        <select class="lumina-select" id="lumina-m-sel">${modelOptions}</select>
                        <select class="lumina-select" id="lumina-v-sel">
                            <option value="alba">Alba</option>
                            <option value="marius">Marius</option>
                            <option value="javert">Javert</option>
                            <option value="jean">Jean</option>
                            <option value="fantine">Fantine</option>
                            <option value="cosette">Cosette</option>
                            <option value="eponine">Eponine</option>
                            <option value="azelma">Azelma</option>
                        </select>
                    </div>
                    <button class="lumina-btn-primary" id="lumina-sub">Get Audio Answer</button>
                </div>
                <div class="lumina-resize-handle"></div>`;

            // 🎯 v4.9.2: Content Status logic
            const visTg = widget.querySelector('#lumina-vis-tg');
            const contextBar = widget.querySelector('#lumina-context-bar');

            function updateContextStatus() {
                const hasSelection = state.selectedText && state.selectedText.length > 0;
                const visionOn = visTg.classList.contains('active');

                let html = '';
                if (hasSelection) {
                    html += '<span class="lumina-context-badge badge-success">✓ Text Linked</span>';
                } else {
                    html += '<span class="lumina-context-badge badge-warning">⚠ No Selection</span>';
                }

                if (visionOn) {
                    html += '<span class="lumina-context-badge badge-info">👁 Vision Active</span>';
                }

                // Add helpful tip if both labels look blind
                if (!hasSelection && !visionOn) {
                    html += '<span style="opacity:0.6; font-size:10px;">(Site blocked selection. Enable 👁️?)</span>';
                }

                contextBar.innerHTML = html;
            }

            // Default: ON if no text selected, OFF if text selected
            if (!state.selectedText) visTg.classList.add('active');
            updateContextStatus(); // Initial update

            visTg.onclick = () => {
                visTg.classList.toggle('active');
                updateContextStatus(); // Update on toggle
                if (visTg.classList.contains('active')) {
                    showToast("Vision Enabled: Lumina will see your screen.");
                } else {
                    showToast("Vision Disabled: Pure text mode.");
                }
            };

            console.log('🎓 [SHOW_WIDGET] Appending widget to body...');
            document.body.appendChild(widget);
            elements.widget = widget;
            console.log('🎓 [SHOW_WIDGET] Widget appended, making draggable...');

            makeDraggable(widget, widget.querySelector('.lumina-header'));
            makeResizable(widget);
            console.log('🎓 [SHOW_WIDGET] Positioning widget...');







            // Use saved trigger position (now includes scroll offset for absolute positioning)
            if (state.triggerPosition) {
                widget.style.top = `${state.triggerPosition.top}px`;
                widget.style.left = `${Math.max(10, state.triggerPosition.left)}px`;
                console.log('🎓 [SHOW_WIDGET] Positioned at saved trigger location (absolute) - top:', state.triggerPosition.top, 'left:', state.triggerPosition.left);
                state.triggerPosition = null;
            } else {
                // Center in current viewport for shortcuts
                widget.style.top = `${window.scrollY + window.innerHeight * 0.25}px`;
                widget.style.left = 'calc(50% - 190px)';
                console.log('🎓 [SHOW_WIDGET] Positioned at center (shortcut)');
            }

            console.log('🎓 [SHOW_WIDGET] Adding visible class in 10ms...');
            setTimeout(() => {
                widget.classList.add('lumina-visible');
                console.log('🎓 [SHOW_WIDGET] Widget is now visible!');
            }, 10);

            const ta = widget.querySelector('.lumina-textarea');
            ta.focus();
            console.log('🎓 [SHOW_WIDGET] Textarea focused');

            widget.querySelector('.lumina-close-btn').onclick = () => {
                widget.remove();
                // 🎯 v4.8.9: Selection is now persistent for stability
            };
            widget.querySelector('#lumina-sub').onclick = () => handleSubmit(widget);
            ta.onkeydown = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    console.log('🎓 [WIDGET] Enter pressed, submitting...');
                    handleSubmit(widget);
                }
                if (e.key === 'Escape') widget.remove();
            };
        } catch (error) {
            console.error('🎓 [SHOW_WIDGET] ERROR:', error);
            showToast('Failed to open query widget');
        }
    }

    async function handleSubmit(widget) {
        console.log('🚀 [SUBMIT] Called');
        const ta = widget.querySelector('.lumina-textarea');
        const btn = widget.querySelector('#lumina-sub');
        const q = ta.value.trim();

        console.log('🚀 [SUBMIT] Query:', q, 'isLoading:', state.isLoading, 'Context:', state.selectedText ? 'FOUND' : 'EMPTY');
        if (!q) {
            showToast("Please type a question first!");
            return;
        }

        const visionEnabled = widget.querySelector('#lumina-vis-tg').classList.contains('active');

        // 🎯 v3.5.3: Deduplication check
        if (state.pendingPrompts.has(q)) {
            console.log('🚀 [SUBMIT] Blocked: Already generating this prompt');
            showToast("Already generating this answer...");
            return;
        }

        if (state.isLoading) {
            console.log('🚀 [SUBMIT] Aborted - overall state is loading');
            return;
        }

        state.isLoading = true;
        state.pendingPrompts.add(q);
        btn.innerText = "Processing..."; btn.disabled = true;
        console.log('🚀 [SUBMIT] Starting request...');
        try {
            const settings = await chrome.storage.sync.get(['serverUrl', 'apiKeyGemini', 'apiKeyGroq', 'apiKeyOpenai', 'apiKeyClaude']);
            let selectedModel = widget.querySelector('#lumina-m-sel').value;
            // Removed redundant visionEnabled declaration
            console.log('🚀 [SUBMIT] Settings:', settings);
            console.log('🚀 [SUBMIT] Selected model:', selectedModel, 'Vision:', visionEnabled);

            // 🎯 v4.8.5: Screenshot logic moved to conditional block
            let screenshot = null;
            if (visionEnabled) {
                console.log('📸 [SUBMIT] Vision enabled, hiding UI for clean capture...');
                document.body.classList.add('lumina-capturing');

                try {
                    // Small delay to ensure browser repaints without our UI
                    await new Promise(r => setTimeout(r, 100));

                    const captureRes = await new Promise(resolve => {
                        chrome.runtime.sendMessage({ action: 'captureTab' }, resolve);
                    });

                    document.body.classList.remove('lumina-capturing');
                    triggerShutterEffect();
                    if (captureRes && captureRes.success) {
                        screenshot = captureRes.screenshot.split(',')[1];
                        console.log('📸 [SUBMIT] Screenshot captured successfully');

                        // 🎯 v4.8.4 Dynamic Vision Routing (ONLY if model can't see)
                        if (selectedModel === 'groq') {
                            console.log('🔄 [SUBMIT] Groq cannot see. Searching for vision models...');
                            if (settings.apiKeyGemini) {
                                selectedModel = 'gemini';
                                showToast("Routing to Gemini for Vision...");
                            } else if (settings.apiKeyOpenai) {
                                selectedModel = 'openai';
                                showToast("Routing to GPT-4 for Vision...");
                            } else if (settings.apiKeyClaude) {
                                selectedModel = 'claude';
                                showToast("Routing to Claude for Vision...");
                            } else {
                                selectedModel = 'gemini';
                                showToast("Using default Vision engine...");
                            }
                        }
                    }
                } catch (err) {
                    console.warn('📸 [SUBMIT] Screenshot failed:', err);
                    document.body.classList.remove('lumina-capturing');
                }
            } else {
                console.log('📸 [SUBMIT] Vision disabled, sending pure text.');
            }

            state.activeModel = selectedModel; // 🎯 Save for follow-ups

            const requestBody = {
                text: state.selectedText || "", // 🎯 Removed "Context" placeholder
                prompt: q,
                screenshot: screenshot,
                voice: widget.querySelector('#lumina-v-sel').value,
                apiKey: settings.apiKeyGemini,
                apiKeyGroq: settings.apiKeyGroq,
                apiKeyOpenai: settings.apiKeyOpenai,
                apiKeyClaude: settings.apiKeyClaude,
                llmProvider: selectedModel,
                shouldAudio: true
            };
            console.log('🚀 [SUBMIT] Request body:', requestBody);

            const url = `${settings.serverUrl || CONFIG.serverUrl}/api/generate`;
            console.log('🚀 [SUBMIT] Fetching:', url);

            const res = await fetch(url, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            console.log('🚀 [SUBMIT] Response status:', res.status, res.statusText);

            const data = await res.json();
            console.log('🚀 [SUBMIT] Response data:', data);

            // 🎯 v4.8.9: Removed selection reset to keep context for follow-ups

            // Initialize conversation state with the new query and response
            state.currentConversation = [
                { role: 'user', content: q },
                { role: 'assistant', content: data.text, audioUrl: data.audioUrl }
            ];

            saveHistoryItem({
                question: q,
                answer: data.text,
                audioUrl: data.audioUrl,
                timestamp: Date.now(),
                conversation: [...state.currentConversation] // 🎯 Store the whole thread
            });
            showAudioPlayer(); // Render conversation
            widget.remove();
            console.log('🚀 [SUBMIT] Success!');
        } catch (e) {
            console.error('🚀 [SUBMIT] ERROR:', e);
            showToast("Error connecting to server");
            btn.innerText = "Retry";
            btn.disabled = false;
        }
        finally {
            state.isLoading = false;
            state.pendingPrompts.delete(q);
        }
    }

    function createAudioPlayer() {
        if (elements.audioPlayer) return;
        const player = document.createElement('div');
        player.id = 'lumina-player-container';
        player.className = 'lumina-overlay';
        player.innerHTML = `<div class="lumina-header" id="lumina-p-handle"><div class="lumina-header-title">Lumina AI</div><button class="lumina-close-btn">&times;</button></div><div class="lumina-response-box" id="lumina-text"></div><div class="lumina-audio-controls"><button class="lumina-play-pill" id="lumina-play"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></button><div class="lumina-progress-bg"><div class="lumina-progress-val" id="lumina-bar"></div></div><div style="font-size: 11px; opacity: 0.6;" id="lumina-time">0:00</div></div><div style="padding: 15px 20px; background: rgba(255,255,255,0.03); flex-shrink:0;"><div style="background: rgba(0,0,0,0.4); border-radius: 20px; display: flex; padding: 5px 15px; border: 1px solid rgba(255,255,255,0.1);"><input type="text" id="lumina-fu" placeholder="Follow-up..." style="flex:1; background:none; border:none; color:#fff; font-size:13px; outline:none; padding:8px 0;"></div></div><div class="lumina-resize-handle"></div>`;
        document.body.appendChild(player);
        elements.audioPlayer = player;
        makeDraggable(player, player.querySelector('#lumina-p-handle'));
        makeResizable(player);
        player.querySelector('.lumina-close-btn').onclick = () => { player.classList.remove('visible'); stopAudio(); };
        player.querySelector('#lumina-play').onclick = () => { if (state.audioElement?.paused) state.audioElement.play(); else state.audioElement?.pause(); };

        // 🎯 v3.5.2: Implement Seeking Logic
        const progressBg = player.querySelector('.lumina-progress-bg');
        progressBg.onclick = (e) => {
            if (!state.audioElement) return;
            const rect = progressBg.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            const percent = clickX / width;
            state.audioElement.currentTime = percent * state.audioElement.duration;
            console.log('🎵 [PROGRESS] Seek to:', percent * 100, '%');
        };

        player.querySelector('#lumina-fu').onkeydown = async (e) => {
            if (e.key === 'Enter') {
                const q = e.target.value.trim(); if (!q) return;

                // 🎯 v3.5.3: Deduplication check for follow-ups
                if (state.pendingPrompts.has(q)) {
                    showToast("Already asking this...");
                    return;
                }

                e.target.value = '';
                console.log('🚀 [PLAYER] Follow-up submitted:', q);
                state.pendingPrompts.add(q);

                // 1. Add user query to conversation and append to UI manually (to avoid re-render interruption)
                state.currentConversation.push({ role: 'user', content: q });
                appendMessageToUI({ role: 'user', content: q });

                // 2. Add loading indicator for AI
                const textEl = player.querySelector('#lumina-text');
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'lumina-chat-msg lumina-msg-assistant';
                loadingDiv.innerHTML = '<span style="opacity:0.5">Generating text...</span>';
                textEl.appendChild(loadingDiv);
                textEl.scrollTop = textEl.scrollHeight;

                const settings = await chrome.storage.sync.get(['serverUrl', 'apiKeyGemini', 'apiKeyGroq', 'apiKeyOpenai', 'apiKeyClaude']);
                const res = await fetch(`${settings.serverUrl || CONFIG.serverUrl}/api/generate`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: state.selectedText || "", // 🎯 Removed "Context" placeholder
                        prompt: q,
                        history: state.currentConversation.slice(0, -1), // Pass conversation except last user msg
                        apiKey: settings.apiKeyGemini,
                        apiKeyGroq: settings.apiKeyGroq,
                        apiKeyOpenai: settings.apiKeyOpenai,
                        apiKeyClaude: settings.apiKeyClaude,
                        llmProvider: state.activeModel || 'gemini', // 🎯 v4.8.4: Persist the thread's model
                        shouldAudio: false // 🎯 v3.0: Always false for follow-ups (on-demand)
                    })
                });
                const data = await res.json();

                // 3. Update conversation with AI response and append to UI
                state.currentConversation.push({ role: 'assistant', content: data.text });

                // Remove loading indicator
                if (loadingDiv.parentNode) loadingDiv.parentNode.removeChild(loadingDiv);
                appendMessageToUI({ role: 'assistant', content: data.text });
                updateLatestHistoryItem(state.currentConversation);
                state.pendingPrompts.delete(q);
            }
        };
    }

    function updateLatestHistoryItem() {
        const url = window.location.href;
        chrome.storage.local.get([url], (res) => {
            let items = res[url] || [];
            if (items.length > 0) {
                // Update the most recent item with the full conversation
                items[items.length - 1].conversation = [...state.currentConversation];
                chrome.storage.local.set({ [url]: items });
            }
        });
    }

    function appendMessageToUI(msg) {
        if (!elements.audioPlayer) return;
        const textEl = elements.audioPlayer.querySelector('#lumina-text');

        const div = document.createElement('div');
        div.className = `lumina-chat-msg lumina-msg-${msg.role}`;

        if (msg.role === 'assistant') {
            const inner = document.createElement('div');
            inner.style.cssText = 'display:flex; justify-content:space-between; align-items:flex-start; gap:10px;';
            const textSpan = document.createElement('span');
            const paragraphs = msg.content.split(/\n+/);
            paragraphs.forEach(p => { const pTag = document.createElement('p'); pTag.innerText = p; textSpan.appendChild(pTag); });

            const playBtn = document.createElement('button');
            playBtn.className = 'lumina-bubble-play';
            playBtn.innerHTML = '🔊';
            playBtn.title = 'Speak this message';
            playBtn.onclick = () => playOnDemandAudio(msg.content, playBtn, msg.audioUrl);
            inner.appendChild(textSpan);
            inner.appendChild(playBtn);
            div.appendChild(inner);
        } else {
            div.innerText = msg.content;
        }
        textEl.appendChild(div);
        textEl.scrollTop = textEl.scrollHeight;
    }

    function showAudioPlayer() {
        console.log('🎵 [SHOW_PLAYER] Called');
        if (!elements.audioPlayer) createAudioPlayer();

        const player = elements.audioPlayer;
        // Don't set display: block manually, let the .visible class handle display: flex

        // Position logic (keep as is)
        if (elements.widget && document.body.contains(elements.widget)) {
            const widgetRect = elements.widget.getBoundingClientRect();
            player.style.top = `${widgetRect.top + window.scrollY + widgetRect.height + 20}px`;
            player.style.left = `${widgetRect.left + window.scrollX}px`;
            player.style.bottom = 'auto'; player.style.right = 'auto';
        } else if (!player.style.top || player.style.top === 'auto' || player.style.top === '') {
            player.style.top = `${window.scrollY + window.innerHeight * 0.3}px`;
            player.style.left = 'calc(50% - 200px)';
            player.style.bottom = 'auto'; player.style.right = 'auto';
        }

        // Complete re-render of the conversation
        const textEl = player.querySelector('#lumina-text');
        textEl.innerHTML = '';
        state.currentConversation.forEach(msg => {
            appendMessageToUI(msg);
        });

        // Auto-scroll to bottom
        textEl.scrollTop = textEl.scrollHeight;

        player.classList.add('visible');

        // Only show global audio controls if audio is actually playing
        const controls = player.querySelector('.lumina-audio-controls');
        if (state.audioElement && !state.audioElement.paused) {
            controls.classList.remove('hidden');
        } else {
            controls.classList.add('hidden');
        }
    }

    async function playOnDemandAudio(text, btn) {
        if (btn.classList.contains('loading')) return;

        const settings = await chrome.storage.sync.get(['serverUrl', 'vVoice']);
        const serverUrl = settings.serverUrl || CONFIG.serverUrl;
        const voice = settings.vVoice || 'alba';

        btn.classList.add('loading');

        try {
            // 1. Quick Cache Check
            const checkRes = await fetch(`${serverUrl.replace(/\/$/, '')}/api/tts?check_only=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice })
            });
            const checkData = await checkRes.json();
            const fullUrl = checkData.audioUrl.startsWith('http') ? checkData.audioUrl : `${serverUrl.replace(/\/$/, '')}/${checkData.audioUrl.replace(/^\//, '')}`;

            if (checkData.is_cached) {
                console.log('🎵 [CACHE] Found! Skipping cues.');
                // 🎯 INSTANT PLAY (Skip cues)
                playAudioWithMixedContentFix(fullUrl, checkData.audioUrl);
                btn.classList.remove('loading');
                if (elements.audioPlayer) elements.audioPlayer.querySelector('.lumina-audio-controls').classList.remove('hidden');
            } else {
                console.log('🎵 [CACHE] Not found. Playing sequence cues.');
                // 🎯 NOT CACHED: Play cues while generating

                // 1. Loading Cue (Immediate)
                const cueUrl = `${serverUrl.replace(/\/$/, '')}/api/audio/cue.wav`;
                await playAudioWithMixedContentFix(cueUrl, 'cue.wav');

                // 2. Start real generation in parallel
                const genPromise = fetch(`${serverUrl.replace(/\/$/, '')}/api/tts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, voice })
                }).then(r => r.json());

                // Wait for generation to finish
                const data = await genPromise;

                // 3. Ready Cue (Sequential)
                const readyUrl = `${serverUrl.replace(/\/$/, '')}/api/audio/ready.wav`;
                await playAudioWithMixedContentFix(readyUrl, 'ready.wav');

                // 4. Final Audio (Small delay to let "ready" start)
                setTimeout(() => {
                    playAudioWithMixedContentFix(fullUrl, data.audioUrl);
                    btn.classList.remove('loading');
                    if (elements.audioPlayer) elements.audioPlayer.querySelector('.lumina-audio-controls').classList.remove('hidden');
                }, 1600);
            }
        } catch (e) {
            console.error('On-demand TTS error:', e);
            btn.classList.remove('loading');
            showToast("Error with audio");
        }
    }

    async function playAudioWithMixedContentFix(fullUrl, relativeUrl) {
        stopAudio();
        try {
            const res = await fetch(fullUrl);
            if (!res.ok) {
                if (res.status === 404) {
                    showToast("Audio file expired - removing from history");
                    if (relativeUrl) removeHistoryItemByAudioUrl(relativeUrl);
                    return;
                }
                throw new Error('Network error');
            }
            const blob = await res.blob();
            state.blobUrl = URL.createObjectURL(blob);
            state.audioElement = new Audio(state.blobUrl);
            state.audioElement.play();
            state.audioElement.ontimeupdate = () => {
                const perc = (state.audioElement.currentTime / (state.audioElement.duration || 1)) * 100;
                elements.audioPlayer.querySelector('#lumina-bar').style.width = `${perc}%`;
                const m = Math.floor(state.audioElement.currentTime / 60);
                const s = Math.floor(state.audioElement.currentTime % 60).toString().padStart(2, '0');
                elements.audioPlayer.querySelector('#lumina-time').innerText = `${m}:${s}`;
            };
            state.audioElement.onplay = () => { elements.audioPlayer.querySelector('#lumina-play').innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`; };
            state.audioElement.onpause = () => { elements.audioPlayer.querySelector('#lumina-play').innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`; };
        } catch (e) {
            console.error("Audio load error:", e);
            showToast("Audio unavailable - text shown");
        }
    }

    function stopAudio() {
        if (state.audioElement) { state.audioElement.pause(); state.audioElement = null; }
        if (state.blobUrl) { URL.revokeObjectURL(state.blobUrl); state.blobUrl = null; }
    }

    function createHistoryFAB() {
        if (document.getElementById('lumina-history-fab')) return;
        console.log('💡 [FAB] Creating History FAB');
        const fab = document.createElement('div'); fab.id = 'lumina-history-fab'; fab.innerHTML = '💡';
        fab.style.zIndex = "2147483647"; // Ensure highest z-index
        document.body.appendChild(fab); elements.fab = fab;

        const list = document.createElement('div'); list.id = 'lumina-history-list';
        list.style.zIndex = "2147483647";
        list.innerHTML = `<div class="lumina-history-header">Recent Questions <span style="cursor:pointer;padding:0 10px;font-size:18px" id="lumina-h-clear">&times;</span></div><div class="lumina-history-items"></div>`;
        document.body.appendChild(list); elements.historyList = list;

        fab.onclick = (e) => {
            e.stopPropagation();
            console.log('💡 [FAB] Toggle history');
            fab.classList.toggle('open');
            list.classList.toggle('visible');
            if (list.classList.contains('visible')) loadHistoryItems();
        };
        list.querySelector('#lumina-h-clear').onclick = (e) => {
            e.stopPropagation();
            if (confirm("Clear history?")) {
                chrome.storage.local.remove(window.location.href, () => {
                    console.log('💡 [FAB] History cleared');
                    state.currentConversation = []; // 🎯 v4.8.7: Reset in-memory state
                    loadHistoryItems();
                });
            }
        };
    }

    function loadHistoryItems() {
        const wrap = elements.historyList.querySelector('.lumina-history-items');
        chrome.storage.local.get([window.location.href], (res) => {
            const items = res[window.location.href] || [];
            wrap.innerHTML = items.length ? '' : '<div style="opacity:0.4; text-align:center; padding:20px;">No history yet</div>';
            items.reverse().forEach(item => {
                const div = document.createElement('div'); div.className = 'lumina-history-item';
                div.innerHTML = `<span class="lumina-history-q">${item.question}</span><span class="lumina-history-a">${item.answer}</span>`;
                div.onclick = () => {
                    chrome.storage.sync.get(['serverUrl'], (s) => {
                        // 🎯 Restore the whole conversation if it exists
                        if (item.conversation && item.conversation.length > 0) {
                            state.currentConversation = [...item.conversation];
                        } else {
                            // Fallback for old history items
                            state.currentConversation = [
                                { role: 'user', content: item.question },
                                { role: 'assistant', content: item.answer, audioUrl: item.audioUrl }
                            ];
                        }
                        showAudioPlayer();
                    });
                    elements.historyList.classList.remove('visible');
                    elements.fab.classList.remove('open');
                };
                wrap.appendChild(div);
            });
        });
    }

    function saveHistoryItem(item) {
        const url = window.location.href;
        chrome.storage.local.get([url], (res) => {
            const items = res[url] || []; items.push(item);
            if (items.length > 20) items.shift(); chrome.storage.local.set({ [url]: items });
        });
    }

    function removeHistoryItemByAudioUrl(audioUrl) {
        const url = window.location.href;
        chrome.storage.local.get([url], (res) => {
            let items = res[url] || [];
            const newItems = items.filter(item => item.audioUrl !== audioUrl);
            if (newItems.length !== items.length) {
                chrome.storage.local.set({ [url]: newItems }, () => {
                    console.log('💡 [HISTORY] Removed stale item with URL:', audioUrl);
                    if (elements.historyList && elements.historyList.classList.contains('visible')) {
                        loadHistoryItems();
                    }
                });
            }
        });
    }

    async function validateHistoryItems() {
        const url = window.location.href;
        const settings = await chrome.storage.sync.get(['serverUrl']);
        const serverUrl = settings.serverUrl || CONFIG.serverUrl;

        chrome.storage.local.get([url], async (res) => {
            let items = res[url] || [];
            if (items.length === 0) return;

            console.log(`💡 [HISTORY] Validating ${items.length} items...`);
            let changed = false;

            for (let i = items.length - 1; i >= 0; i--) {
                const item = items[i];
                if (item.audioUrl) {
                    const fullUrl = item.audioUrl.startsWith('http') ? item.audioUrl : `${serverUrl.replace(/\/$/, '')}/${item.audioUrl.replace(/^\//, '')}`;
                    try {
                        const check = await fetch(fullUrl, { method: 'HEAD' });
                        if (check.status === 404) {
                            console.log(`💡 [HISTORY] Auto-removing expired item: ${item.question}`);
                            items.splice(i, 1);
                            changed = true;
                        }
                    } catch (e) { }
                }
            }

            if (changed) {
                chrome.storage.local.set({ [url]: items }, () => {
                    if (elements.historyList && elements.historyList.classList.contains('visible')) {
                        loadHistoryItems();
                    }
                });
            }
        });
    }

    function handleTextSelection() {
        const sel = window.getSelection(); const text = sel.toString().trim();
        console.log('Text selected:', text.length, 'chars');
        if (text.length >= CONFIG.minSelectionLength) {
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            // Use viewport coordinates directly for position:fixed elements
            state.selectionCoords = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
            state.selectedText = text;
            console.log('Showing trigger at:', state.selectionCoords);
            showTrigger();
        } else if (text.length === 0) {
            // 🎯 v4.9.1: Only reset if the user click wasn't inside our UI
            // This prevents clicking the textarea from wiping the selection context
            if (!window.getSelection().anchorNode?.parentElement?.closest('.lumina-overlay, #lumina-trigger')) {
                state.selectedText = '';
                hideTrigger();
            }
        }
    }

    function showTrigger() {
        console.log('🎓 [SHOW_TRIGGER] Called');
        if (!elements.trigger) {
            console.error('🎓 [SHOW_TRIGGER] ERROR: Trigger element not found!');
            return;
        }
        // 🎯 v4.8.3: Safer positioning
        let top = state.selectionCoords.top - 65;
        let left = state.selectionCoords.left + state.selectionCoords.width / 2 - 27;

        // Bounds checking
        if (top < 10) top = state.selectionCoords.top + state.selectionCoords.height + 10;
        left = Math.max(10, Math.min(window.innerWidth - 64, left));

        console.log('🎓 [SHOW_TRIGGER] Positioning at top:', top, 'left:', left);
        elements.trigger.style.top = `${top}px`;
        elements.trigger.style.left = `${left}px`;
        elements.trigger.classList.add('lumina-visible');
        console.log('🎓 [SHOW_TRIGGER] Trigger shown! classList:', elements.trigger.classList, 'style:', elements.trigger.style.cssText);
    }

    function hideTrigger() {
        console.log('🎓 [HIDE_TRIGGER] Called');
        elements.trigger?.classList.remove('lumina-visible');
        console.log('🎓 [HIDE_TRIGGER] Trigger hidden');
    }

    function attachEventListeners() {
        document.addEventListener('mouseup', handleTextSelection);
        document.addEventListener('mousedown', (e) => {
            if (!e.target.closest('#lumina-trigger, .lumina-overlay, #lumina-history-fab, #lumina-history-list')) {
                hideTrigger();
                // 🎯 v4.8.9: Selection is now persistent
                if (elements.historyList) elements.historyList.classList.remove('visible');
                if (elements.fab) elements.fab.classList.remove('open');
            }
        });
        chrome.runtime.onMessage.addListener((msg) => {
            console.log('🎓 Message received:', msg);
            if (msg.action === 'handleContextMenu') showQueryWidget(msg.text);
            if (msg.action === 'handleShortcut') { state.selectionCoords = null; showQueryWidget(); }
        });
    }

    function makeDraggable(el, handle) {
        let x = 0, y = 0;
        handle.onmousedown = (e) => {
            e.preventDefault();
            x = e.clientX; y = e.clientY;
            document.onmousemove = (e) => {
                const dx = x - e.clientX; const dy = y - e.clientY;
                x = e.clientX; y = e.clientY;
                el.style.top = (el.offsetTop - dy) + "px";
                el.style.left = (el.offsetLeft - dx) + "px";
            };
            document.onmouseup = () => document.onmousemove = document.onmouseup = null;
        };
    }

    function makeResizable(el) {
        const handle = el.querySelector('.lumina-resize-handle');
        if (!handle) return;

        handle.onmousedown = function (e) {
            e.preventDefault();
            const startWidth = el.offsetWidth;
            const startHeight = el.offsetHeight;
            const startX = e.clientX;
            const startY = e.clientY;

            function onMouseMove(e) {
                const width = startWidth + (e.clientX - startX);
                const height = startHeight + (e.clientY - startY);
                el.style.width = Math.max(320, width) + 'px';
                el.style.height = Math.max(200, height) + 'px';
            }

            function onMouseUp() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };
    }

    function showToast(msg) {
        const t = document.createElement('div'); t.className = 'lumina-toast'; t.innerText = msg;
        document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
    }

    function triggerShutterEffect() {
        const shutter = document.createElement('div');
        shutter.className = 'lumina-shutter';
        document.body.appendChild(shutter);

        // Immediate flash
        requestAnimationFrame(() => {
            shutter.classList.add('flash');
            setTimeout(() => {
                shutter.classList.remove('flash');
                setTimeout(() => shutter.remove(), 200);
            }, 100);
        });
    }

    init();
})();
