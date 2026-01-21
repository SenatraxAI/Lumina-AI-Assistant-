// Run this in the browser console on any page with the Lumina extension active
// This will clear the custom voice and reset to default

chrome.storage.sync.get(['voice'], (result) => {
    console.log('Current voice setting:', result.voice);

    // Reset to default voice
    chrome.storage.sync.set({ voice: 'alba' }, () => {
        console.log('Voice reset to alba (default)');
        console.log('Please reload the extension or refresh the page');
    });
});
