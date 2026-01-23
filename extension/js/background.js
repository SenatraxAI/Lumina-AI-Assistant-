// js/background.js

// Background service worker for Lumina Audio Assistant
// Handles screenshot capture, messaging, and extension lifecycle

// Initialize on installation
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Lumina Audio Assistant installed:', details.reason);

    // Set default settings
    chrome.storage.sync.set({
        serverUrl: 'http://localhost:8080',
        autoRead: true,
        includeScreenshot: true
    });

    // Create context menu
    chrome.contextMenus.create({
        id: 'lumina-context-menu',
        title: 'Ask Lumina about this',
        contexts: ['selection']
    });
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
    console.log('🎓 Shortcut triggered:', command);
    if (command === 'trigger-lumina') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                console.log('Sending handleShortcut message to tab:', tabs[0].id);
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'handleShortcut'
                });
            }
        });
    }
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'lumina-context-menu') {
        // Send message to content script
        chrome.tabs.sendMessage(tab.id, {
            action: 'handleContextMenu',
            text: info.selectionText || ''
        });
    }
});

// 🎯 v4.8 Resident Mode: Bridge logic removed. 
// Communication is now direct-to-API for 100% reliability.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'captureTab') {
        chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ success: true, screenshot: dataUrl });
            }
        });
        return true;
    }
});
