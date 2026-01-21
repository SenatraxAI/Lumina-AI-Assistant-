const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Collect console messages
    const consoleMessages = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleMessages.push(`ERROR: ${msg.text()}`);
        }
    });

    // Collect page errors
    const pageErrors = [];
    page.on('pageerror', error => {
        pageErrors.push(error.message);
    });

    try {
        // Load the HTML file
        const filePath = path.join(__dirname, 'ask-lumina-redesign.html');
        await page.goto(`file://${filePath}`);

        // Wait for the page to load
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);

        // Check if main elements exist
        const modal = await page.$('.modal');
        const header = await page.$('.modal-header');
        const body = await page.$('.modal-body');
        const footer = await page.$('.modal-footer');
        const inputField = await page.$('.input-field');

        console.log('=== Page Load Test Results ===');
        console.log('Modal found:', !!modal);
        console.log('Header found:', !!header);
        console.log('Body found:', !!body);
        console.log('Footer found:', !!footer);
        console.log('Input field found:', !!inputField);

        if (consoleMessages.length > 0) {
            console.log('\n=== Console Errors ===');
            consoleMessages.forEach(msg => console.log(msg));
        } else {
            console.log('\nNo console errors detected.');
        }

        if (pageErrors.length > 0) {
            console.log('\n=== Page Errors ===');
            pageErrors.forEach(err => console.log(err));
        } else {
            console.log('No page errors detected.');
        }

        console.log('\n=== Test Complete ===');
        console.log('Page loaded successfully!');

    } catch (error) {
        console.error('Test failed:', error.message);
    } finally {
        await browser.close();
    }
})();
