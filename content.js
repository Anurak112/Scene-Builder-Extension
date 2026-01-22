// Content script for Flow AI Media Downloader
// Version 5.0 - TURBO High-Volume Pipeline (1000+ media generation)
// Optimized for speed and efficiency

console.log('Flow AI v5.0 TURBO - High Volume Pipeline Initialized');

// ==================== STATE ====================
let batchProcessRunning = false;
let harvestModeRunning = false; // New: Harvest Mode state
let batchConfig = null;
let generatedMediaUrls = new Set();
let injectionQueue = [];
let stats = { injected: 0, downloaded: 0, failed: 0, startTime: 0 };
let downloadCounter = 0; // Global counter for uniqueness
let usedFilenames = new Set(); // Track all generated filenames to prevent duplicates
let isConnected = true; // Connection state tracking

// ==================== ERROR HANDLING UTILITIES ====================

/**
 * Safe execution wrapper with automatic retry for async operations
 * @param {Function} fn - Async function to execute
 * @param {*} fallback - Value to return on failure
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<*>} Result of function or fallback value
 */
async function safeExecute(fn, fallback = null, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (e) {
            const errorMsg = e?.message || String(e);
            log(`❌ Attempt ${attempt}/${retries} failed: ${errorMsg}`);
            if (attempt === retries) {
                log(`⚠️ All attempts exhausted, returning fallback`);
                return fallback;
            }
            // Exponential backoff: 500ms, 1000ms, 1500ms
            await sleep(500 * attempt);
        }
    }
    return fallback;
}

/**
 * Safe message sending with error handling
 * @param {Object} message - Message to send
 * @returns {Promise<Object>} Response or error object
 */
function sendMessageSafe(message) {
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    const error = chrome.runtime.lastError.message;
                    log(`⚠️ Message error: ${error}`);
                    isConnected = false;
                    resolve({ success: false, error });
                } else {
                    isConnected = true;
                    resolve(response || { success: true });
                }
            });
        } catch (e) {
            log(`⚠️ SendMessage exception: ${e.message}`);
            isConnected = false;
            resolve({ success: false, error: e.message });
        }
    });
}

/**
 * Check if an element is visible and interactable
 * @param {Element} el - DOM element to check
 * @returns {boolean} True if element is visible
 */
function isVisible(el) {
    if (!el) return false;
    try {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return (
            rect.width > 0 &&
            rect.height > 0 &&
            el.offsetParent !== null &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            parseFloat(style.opacity) > 0
        );
    } catch {
        return false;
    }
}

/**
 * Wait for an element to appear with timeout
 * @param {string} selector - CSS selector
 * @param {number} timeout - Max wait time in ms
 * @returns {Promise<Element|null>} Element or null if timeout
 */
async function waitForElement(selector, timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const el = document.querySelector(selector);
        if (el && isVisible(el)) return el;
        await sleep(100);
    }
    return null;
}

/**
 * Check connection to background script
 * @returns {Promise<boolean>} True if connected
 */
async function checkConnection() {
    try {
        const response = await sendMessageSafe({ type: 'HEARTBEAT' });
        isConnected = response.success !== false;
        return isConnected;
    } catch {
        isConnected = false;
        return false;
    }
}


// ==================== SMART FILENAME GENERATOR ====================
// Creates descriptive, unique filenames from prompts
function generateSmartFilename(prompt, options = {}) {
    const {
        resolution = '1K',
        extension = 'png',
        maxLength = 50,
        prefix = '',
        includeTimestamp = true
    } = options;

    // Step 1: Clean and extract keywords from prompt
    let baseName = cleanPromptForFilename(prompt, maxLength);

    // Step 2: Add optional prefix
    if (prefix) {
        baseName = `${prefix}_${baseName}`;
    }

    // Step 3: Add resolution
    baseName = `${baseName}_${resolution}`;

    // Step 4: Add timestamp if requested
    if (includeTimestamp) {
        const now = new Date();
        const timeStr = now.toISOString().replace(/[-:T]/g, '').substring(0, 14); // YYYYMMDDHHMMSS
        baseName = `${baseName}_${timeStr}`;
    }

    // Step 5: Ensure uniqueness by checking against used filenames
    let filename = `${baseName}.${extension}`;
    let counter = 1;

    while (usedFilenames.has(filename)) {
        filename = `${baseName}_${counter}.${extension}`;
        counter++;
    }

    // Track this filename
    usedFilenames.add(filename);
    downloadCounter++;

    return filename;
}

// Clean prompt text to create a valid, descriptive filename
function cleanPromptForFilename(prompt, maxLength = 50) {
    if (!prompt || typeof prompt !== 'string') {
        return `media_${Date.now()}`;
    }

    // Extract meaningful keywords (remove common filler words)
    const fillerWords = new Set([
        'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be', 'this',
        'that', 'it', 'which', 'who', 'what', 'when', 'where', 'how', 'why',
        'can', 'will', 'would', 'should', 'could', 'may', 'might', 'must',
        'create', 'generate', 'make', 'show', 'give', 'me', 'please', 'image'
    ]);

    // Clean the text
    let cleaned = prompt
        .toLowerCase()
        .trim()
        // Remove special characters, keep spaces and hyphens
        .replace(/[^a-z0-9\s-]/g, ' ')
        // Normalize spaces
        .replace(/\s+/g, ' ')
        // Split into words
        .split(' ')
        // Remove filler words
        .filter(word => word.length > 2 && !fillerWords.has(word))
        // Take first 6-8 meaningful words
        .slice(0, 8)
        // Join with underscores
        .join('_');

    // If too long, truncate intelligently
    if (cleaned.length > maxLength) {
        // Try to break at word boundary
        cleaned = cleaned.substring(0, maxLength);
        const lastUnderscore = cleaned.lastIndexOf('_');
        if (lastUnderscore > maxLength * 0.7) { // If we have a good break point
            cleaned = cleaned.substring(0, lastUnderscore);
        }
    }

    // Fallback if cleaning produced nothing useful
    if (!cleaned || cleaned.length < 3) {
        cleaned = `media_${downloadCounter + 1}`;
    }

    return cleaned;
}

// ==================== UNIFIED MEDIA DETECTION SYSTEM ====================
// This solves the core problem: knowing WHICH media was just generated

let mediaObserver = null;
let pendingDetection = null; // { active, resolve, reject, baselineUrls, timeout }

// Initialize MutationObserver to watch for new media elements
function initMediaObserver() {
    if (mediaObserver) return; // Already initialized

    mediaObserver = new MutationObserver((mutations) => {
        if (!pendingDetection || !pendingDetection.active) return;

        // Use debounced check for DOM stability
        checkForNewMediaDebounced();
    });

    // Observe the entire document for new images/videos
    mediaObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'srcset']
    });

    log('📡 Media observer initialized');
}

// Start watching for new media (call this BEFORE triggering generation)
function startMediaDetection(timeoutMs = 60000) {
    // Take snapshot of current media URLs
    const baseline = scanMedia();
    const baselineUrls = new Set(baseline.map(m => m.url));

    log(`🔍 Media detection started | Baseline: ${baselineUrls.size} media`);

    return new Promise((resolve, reject) => {
        // Set up detection state
        pendingDetection = {
            active: true,
            resolve,
            reject,
            baselineUrls,
            timeout: setTimeout(() => {
                if (pendingDetection && pendingDetection.active) {
                    pendingDetection.active = false;
                    log(`⏱️ Media detection timeout (${timeoutMs}ms)`);
                    resolve(null); // Timeout - no new media found
                }
            }, timeoutMs)
        };

        // Do an immediate check (in case media already rendered)
        setTimeout(() => checkForNewMedia(), 500);
    });
}

// Check if new media has appeared (with debouncing)
let checkDebounceTimer = null;
const STABILITY_THRESHOLD = 300; // ms to wait for DOM to stabilize

function checkForNewMediaDebounced() {
    if (checkDebounceTimer) clearTimeout(checkDebounceTimer);
    checkDebounceTimer = setTimeout(() => {
        checkForNewMedia();
    }, STABILITY_THRESHOLD);
}

function checkForNewMedia() {
    if (!pendingDetection || !pendingDetection.active) return;

    const currentMedia = scanMedia();

    // Find media that wasn't in the baseline (with improved deduplication)
    const newMedia = currentMedia.filter(m => {
        const sanitizedUrl = sanitizeMediaUrl(m.url);
        return !isDuplicate(sanitizedUrl, pendingDetection.baselineUrls);
    });

    if (newMedia.length > 0) {
        // Found new media! Take the most recent one (last in array)
        const latest = newMedia[newMedia.length - 1];

        // Validate it's a real media URL
        if (!isValidMediaUrl(latest.url)) {
            log(`   ⚠️ Skipping invalid media URL`);
            return;
        }

        log(`✨ New media detected: ${latest.type} (${latest.width}x${latest.height})`);

        // Complete the detection
        clearTimeout(pendingDetection.timeout);
        pendingDetection.active = false;
        pendingDetection.resolve(latest);
        pendingDetection = null;
    }
}

/**
 * Sanitize media URL by removing tracking parameters
 * @param {string} url - URL to sanitize
 * @returns {string|null} Sanitized URL or null
 */
function sanitizeMediaUrl(url) {
    if (!url || typeof url !== 'string') return null;

    try {
        // Remove common tracking parameters
        const urlObj = new URL(url);
        urlObj.searchParams.delete('t');
        urlObj.searchParams.delete('_');
        urlObj.searchParams.delete('token');
        return urlObj.toString();
    } catch {
        return url;
    }
}

/**
 * Check if URL is a valid media URL from Google platforms
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid media URL
 */
function isValidMediaUrl(url) {
    if (!url) return false;

    const validPatterns = [
        /storage\.googleapis\.com/,
        /googleusercontent\.com/,
        /lh[0-9]\.google/,
        /ggpht\.com/,
        /^blob:/
    ];

    const invalidPatterns = [
        /\/icons\//i,
        /\/logo/i,
        /favicon/i,
        /avatar/i,
        /profile/i,
        /\.svg$/i,
        /data:image\/svg/i
    ];

    // Must match at least one valid pattern
    const isValid = validPatterns.some(p => p.test(url));
    // Must not match any invalid pattern
    const isInvalid = invalidPatterns.some(p => p.test(url));

    return isValid && !isInvalid;
}

/**
 * Check if URL is a duplicate (considering URL variations)
 * @param {string} url - URL to check
 * @param {Set} existingUrls - Set of existing URLs
 * @returns {boolean} True if duplicate
 */
function isDuplicate(url, existingUrls) {
    if (!url) return true;

    const normalized = sanitizeMediaUrl(url);
    if (existingUrls.has(normalized)) return true;
    if (existingUrls.has(url)) return true;

    // Check for similar URLs (different size params but same base)
    const baseUrl = url.split('=')[0];
    for (const existing of existingUrls) {
        if (existing.split('=')[0] === baseUrl) return true;
    }

    return false;
}

// Stop media detection (cleanup)
function stopMediaDetection() {
    if (pendingDetection) {
        clearTimeout(pendingDetection.timeout);
        pendingDetection.active = false;
        pendingDetection = null;
    }
    if (checkDebounceTimer) {
        clearTimeout(checkDebounceTimer);
        checkDebounceTimer = null;
    }
}

// ==================== CACHED SELECTORS ====================
// Comprehensive selectors for Google Flow
const SELECTORS = {
    flow: {
        input: '[data-slate-editor="true"],[contenteditable="true"],textarea,[role="textbox"]',
        button: 'button[aria-label*="Generate" i],button[aria-label*="Create" i],button[aria-label*="Send" i],button[type="submit"],form button',
        media: 'video[src],video source[src],img[src*="storage.googleapis"],img[src*="googleusercontent"],img[src*="blob:"],div[class*="asset"] img,div[class*="asset"] video,div[class*="media"] img,div[class*="media"] video,img[src*="lh3.google"],img[src*="ggpht"]',
        loading: '[class*="loading"],[class*="spinner"],[class*="progress"],[aria-busy="true"],mat-spinner'
    },
    aiStudio: {
        input: 'ms-prompt-editor [contenteditable="true"],textarea,[contenteditable="true"]',
        button: 'button.run-button,button[aria-label*="Run" i],button[aria-label*="Generate" i]',
        media: 'ms-chat-turn img,img[src*="googleusercontent"],img[src*="blob:"],img[src*="storage.googleapis"]',
        loading: 'ms-spinner,mat-spinner,[class*="loading"]'
    }
};

// Platform detection (cached)
const PLATFORM = window.location.href.includes('aistudio.google') ? 'aiStudio' : 'flow';
const SEL = SELECTORS[PLATFORM];

// ==================== MESSAGE LISTENER ====================
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    switch (msg.type) {
        case 'SCAN_MEDIA':
            respond({ success: true, media: scanMedia() });
            return false;
        case 'START_BATCH_PROCESS':
            batchConfig = msg.data;
            batchProcessRunning = true;
            generatedMediaUrls.clear();
            stats = { injected: 0, downloaded: 0, failed: 0, startTime: Date.now() };
            runTurboPipeline(msg.data);
            respond({ success: true });
            return false;
        case 'STOP_BATCH_PROCESS':
            batchProcessRunning = false;
            const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
            log(`🛑 STOPPED | ✓${stats.injected} injected | ⬇${stats.downloaded} downloaded | ⏱${elapsed}s`);
            respond({ success: true });
            return false;
        case 'START_HARVEST_MODE':
            harvestModeRunning = true;
            stats = { injected: 0, downloaded: 0, failed: 0, startTime: Date.now() };
            runHarvestMode(msg.data);
            respond({ success: true });
            return false;
        case 'STOP_HARVEST_MODE':
            harvestModeRunning = false;
            const harvestElapsed = Math.round((Date.now() - stats.startTime) / 1000);
            log(`🛑 Harvest STOPPED | ⬇${stats.downloaded} downloaded | ⏱${harvestElapsed}s`);
            respond({ success: true });
            return false;
        case 'DOWNLOAD_WITH_RESOLUTION':
            downloadWithResolution(msg.data).then(result => respond(result));
            return true; // Keep channel open for async
    }
    return false;
});

// ==================== TURBO PIPELINE ====================
async function runTurboPipeline(config) {
    const isTurbo = config.automationSpeed?.includes('Turbo');
    const prompts = config.prompts.split('\n').filter(p => p.trim());
    const total = prompts.length * (config.repeatCount || 1);
    const startIdx = config.startIndex || 0;
    const op = config.operation || 'Generate + Download';

    log(`🚀 TURBO PIPELINE | ${total} items | Mode: ${op} | Speed: ${config.automationSpeed}`);

    // ===== PHASE 1: RAPID INJECTION =====
    if (op !== 'Download Only') {
        log('━━━ PHASE 1: RAPID INJECTION ━━━');

        let count = 0;
        for (let i = startIdx; i < prompts.length && batchProcessRunning; i++) {
            const prompt = prompts[i].trim();
            const shortPrompt = prompt.substring(0, 30) + (prompt.length > 30 ? '...' : '');

            for (let r = 0; r < (config.repeatCount || 1) && batchProcessRunning; r++) {
                count++;
                const repeatNum = r + 1;
                const totalRepeats = config.repeatCount || 1;

                // Detailed progress for each item
                log(`📝 [${count}/${total}] Prompt ${i + 1}/${prompts.length} | Repeat ${repeatNum}/${totalRepeats}`);
                log(`   "${shortPrompt}"`);

                chrome.runtime.sendMessage({
                    type: 'BATCH_PROGRESS',
                    current: count,
                    total: total,
                    promptNum: i + 1,
                    totalPrompts: prompts.length,
                    repeatNum: repeatNum,
                    totalRepeats: totalRepeats,
                    prompt: shortPrompt
                });

                // ===== START MEDIA DETECTION BEFORE INJECTION =====
                // This is critical: take baseline snapshot BEFORE the new image appears
                log(`   🔍 Starting media detection (baseline snapshot)...`);
                const detectionPromise = startMediaDetection(60000);

                // TURBO INJECT (after detection started)
                const success = await turboInject(prompt);
                if (success) {
                    stats.injected++;
                    log(`   ✅ Prompt injected successfully`);
                } else {
                    stats.failed++;
                    log(`   ⚠️ Injection failed, retrying...`);
                    // Quick retry once
                    await sleep(1000);
                    if (await turboInject(prompt)) {
                        stats.injected++;
                        log(`   ✅ Retry successful`);
                    } else {
                        log(`   ❌ Retry failed, skipping`);
                        stopMediaDetection(); // Cancel detection if injection failed
                        continue; // Skip to next prompt
                    }
                }

                // Wait for generation with countdown
                await waitGeneration(config.automationSpeed, count, total);

                // Immediate download if needed
                if (op === 'Generate + Download' && batchProcessRunning) {
                    log(`   ⬇ Downloading media...`);
                    await downloadLatestWithDetection(config, prompt, detectionPromise);
                } else {
                    // If not downloading, cancel the detection
                    stopMediaDetection();
                }
            }
        }
    }

    // ===== PHASE 2: BULK HARVEST =====
    if (op === 'Download Only' && batchProcessRunning) {
        log('━━━ PHASE 2: BULK HARVEST ━━━');
        await bulkHarvest(config);
    }

    // ===== COMPLETION =====
    batchProcessRunning = false;
    const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
    const rate = stats.injected > 0 ? (elapsed / stats.injected).toFixed(1) : 0;

    log(`✅ COMPLETE | ✓${stats.injected} | ⬇${stats.downloaded} | ❌${stats.failed} | ⏱${elapsed}s (${rate}s/item)`);

    chrome.runtime.sendMessage({ type: 'BATCH_COMPLETED' });

    if (config.enableVoiceNotifications !== false) {
        speak(`Completed ${stats.injected} generations in ${elapsed} seconds`);
    }
}

// ==================== TURBO INJECTION ====================
async function turboInject(prompt) {
    return safeExecute(async () => {
        // Find input using multiple strategies
        let input = findInputField();

        if (!input) {
            log('   ⚠️ No input field found');
            return false;
        }

        // Ensure input is visible
        if (!isVisible(input)) {
            log('   ⚠️ Input field not visible');
            return false;
        }

        // Focus and clear
        input.focus();
        await sleep(50);

        const isTextarea = input.tagName === 'TEXTAREA' || input.tagName === 'INPUT';

        if (isTextarea) {
            // Direct value set (fastest)
            input.value = prompt;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            // Contenteditable - use execCommand for speed
            input.innerHTML = '';
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, prompt);
            input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
        }

        await sleep(100);

        // Find and click button
        let btn = findGenerateButton();

        if (btn && !btn.disabled && isVisible(btn)) {
            btn.click();
            return true;
        }

        // Fallback: Enter key
        log('   ℹ️ Using Enter key fallback');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        return true;
    }, false, 2); // 2 retries for injection
}

/**
 * Find input field using multiple strategies
 * @returns {Element|null} Input element or null
 */
function findInputField() {
    // Strategy 1: Cached selector
    let input = document.querySelector(SEL.input);
    if (input && isVisible(input)) return input;

    // Strategy 2: Contenteditable with large dimensions
    const editables = document.querySelectorAll('[contenteditable="true"]');
    input = Array.from(editables).find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 200 && r.height > 30 && isVisible(el);
    });
    if (input) return input;

    // Strategy 3: Visible textarea
    const textareas = document.querySelectorAll('textarea');
    input = Array.from(textareas).find(el => !el.disabled && el.offsetWidth > 100 && isVisible(el));
    if (input) return input;

    // Strategy 4: Textarea near submit button
    const form = document.querySelector('form');
    if (form) {
        input = form.querySelector('textarea, [contenteditable="true"]');
        if (input && isVisible(input)) return input;
    }

    return null;
}

/**
 * Find generate/submit button using multiple strategies
 * @returns {Element|null} Button element or null
 */
function findGenerateButton() {
    // Strategy 1: Cached selector
    let btn = document.querySelector(SEL.button);
    if (btn && !btn.disabled && isVisible(btn)) return btn;

    // Strategy 2: Pattern-based search
    const buttonPatterns = [
        'button[aria-label*="Generate" i]',
        'button[aria-label*="Create" i]',
        'button[aria-label*="Send" i]',
        'button[aria-label*="Run" i]',
        'button[type="submit"]'
    ];

    for (const pattern of buttonPatterns) {
        btn = document.querySelector(pattern);
        if (btn && !btn.disabled && isVisible(btn)) return btn;
    }

    // Strategy 3: Text content search
    const buttons = document.querySelectorAll('button');
    btn = Array.from(buttons).find(b => {
        if (b.disabled || !isVisible(b)) return false;
        const txt = ((b.textContent || '') + (b.getAttribute('aria-label') || '') + (b.getAttribute('title') || '')).toLowerCase();
        return txt.includes('generate') || txt.includes('create') || txt.includes('run') || txt.includes('send');
    });
    if (btn) return btn;

    // Strategy 4: Find button near input field
    const inputField = findInputField();
    if (inputField) {
        const parent = inputField.closest('form, [role="form"], div[class*="input"], div[class*="prompt"]');
        if (parent) {
            const parentButtons = parent.querySelectorAll('button');
            btn = Array.from(parentButtons).find(b => !b.disabled && isVisible(b));
            if (btn) return btn;
        }
    }

    return null;
}


// ==================== GENERATION WAIT ====================
async function waitGeneration(speed, currentNum = 0, totalNum = 0) {
    const delays = {
        'Turbo (2-5s)': [2000, 5000],
        'Fast (7-20s)': [7000, 20000],
        'Normal (10-59s)': [10000, 59000],
        'Slow (30-90s)': [30000, 90000]
    };

    const [min, max] = delays[speed] || delays['Normal (10-59s)'];
    const targetWait = rand(min, max);
    const totalSeconds = Math.ceil(targetWait / 1000);

    log(`   ⏳ Waiting up to ${totalSeconds}s for generation...`);

    let elapsed = 0;
    const checkInterval = 1000; // Check every second
    let loadingDetectedAt = 0;
    let loadingGoneAt = 0;

    // Adaptive wait with DOM state monitoring
    for (let i = totalSeconds; i > 0 && batchProcessRunning; i--) {
        // Update countdown UI
        sendMessageSafe({
            type: 'COUNTDOWN_UPDATE',
            remaining: i,
            total: totalSeconds,
            currentNum: currentNum,
            totalNum: totalNum
        });

        // Check DOM loading state
        const isLoading = isGenerationInProgress();

        if (isLoading && !loadingDetectedAt) {
            loadingDetectedAt = elapsed;
            log(`   🔄 Generation started (loading indicator detected)`);
        }

        if (!isLoading && loadingDetectedAt && !loadingGoneAt) {
            loadingGoneAt = elapsed;
            log(`   ✅ Generation appears complete after ${elapsed}s`);

            // Wait a bit more for media to render, then exit early
            await sleep(1500);
            break;
        }

        await sleep(checkInterval);
        elapsed += 1;

        // Early exit for Turbo mode if we detect completion
        if (speed === 'Turbo (2-5s)' && loadingGoneAt && elapsed > loadingGoneAt + 1) {
            break;
        }
    }

    // Final loading check (max 3 attempts) if we haven't detected completion
    if (!loadingGoneAt) {
        log(`   🔍 Final check for generation completion...`);
        let loadingChecks = 0;
        for (let i = 0; i < 3 && batchProcessRunning; i++) {
            if (isGenerationInProgress()) {
                loadingChecks++;
                log(`   ⏳ Still generating... (check ${loadingChecks}/3)`);
                await sleep(3000);
            } else {
                if (loadingChecks > 0) {
                    log(`   ✅ Generation complete`);
                }
                break;
            }
        }
    }

    await sleep(800); // Small buffer for media to fully render
}

/**
 * Check if AI generation is currently in progress
 * @returns {boolean} True if loading indicators are visible
 */
function isGenerationInProgress() {
    // Multiple loading indicator patterns
    const loadingPatterns = [
        SEL.loading,
        '[aria-busy="true"]',
        '[class*="loading"]',
        '[class*="spinner"]',
        '[class*="progress"]',
        'mat-spinner',
        'ms-spinner',
        '[class*="generating"]'
    ];

    for (const pattern of loadingPatterns) {
        try {
            const el = document.querySelector(pattern);
            if (el && isVisible(el)) {
                return true;
            }
        } catch {
            // Invalid selector, skip
        }
    }

    return false;
}

// ==================== MEDIA SCANNING ====================
function scanMedia() {
    const elements = document.querySelectorAll(SEL.media);
    const media = [];
    const seen = new Set();

    elements.forEach((el, i) => {
        const url = el.src || el.currentSrc;
        if (!url || seen.has(url)) return;
        if (isExcluded(url)) return;

        const isVideo = el.tagName === 'VIDEO';
        const w = isVideo ? (el.videoWidth || el.offsetWidth) : (el.naturalWidth || el.offsetWidth);
        const h = isVideo ? (el.videoHeight || el.offsetHeight) : (el.naturalHeight || el.offsetHeight);

        if (w > 100 && h > 100) {
            seen.add(url);

            // Detect actual extension from URL
            const extension = detectMediaExtension(url, isVideo);

            media.push({
                type: isVideo ? 'video' : 'image',
                url, width: w, height: h, index: i,
                extension: extension
            });
        }
    });

    return media;
}

// Detect actual media extension from URL
function detectMediaExtension(url, isVideo) {
    // Try to extract extension from URL
    const urlLower = url.toLowerCase();

    // Check for common image extensions
    if (urlLower.includes('.jpg') || urlLower.includes('jpeg')) return 'jpg';
    if (urlLower.includes('.png')) return 'png';
    if (urlLower.includes('.webp')) return 'webp';
    if (urlLower.includes('.gif')) return 'gif';
    if (urlLower.includes('.bmp')) return 'bmp';

    // Check for common video extensions
    if (urlLower.includes('.mp4')) return 'mp4';
    if (urlLower.includes('.webm')) return 'webm';
    if (urlLower.includes('.mov')) return 'mov';
    if (urlLower.includes('.avi')) return 'avi';

    // Check URL patterns
    if (urlLower.includes('googleusercontent.com')) {
        // Google CDN usually serves images as PNG unless specified
        return 'png';
    }

    if (urlLower.startsWith('blob:')) {
        // Blob URLs - default based on type
        return isVideo ? 'mp4' : 'png';
    }

    // Default fallback
    return isVideo ? 'mp4' : 'jpg';
}

function isExcluded(url) {
    const exclude = ['/icons/', '/logo', 'favicon', 'avatar', 'profile', '.svg', 'data:image/svg'];
    return exclude.some(p => url.toLowerCase().includes(p));
}

// ==================== DOWNLOADING ====================
// Accepts detection promise that was started BEFORE prompt injection
async function downloadLatestWithDetection(config, prompt, detectionPromise) {
    log(`   🔍 Waiting for new media to appear...`);

    // Wait for new media to be detected (detection already started before injection)
    const newMedia = await detectionPromise;

    if (!newMedia) {
        log(`   ❌ No new media detected within timeout`);
        stats.failed++;
        return;
    }

    // Check if we've already downloaded this URL (shouldn't happen, but safety check)
    if (generatedMediaUrls.has(newMedia.url)) {
        log(`   ⚠️ Media already downloaded (duplicate URL)`);
        return;
    }

    // Mark as downloaded
    generatedMediaUrls.add(newMedia.url);
    stats.downloaded++;

    // Generate smart filename
    const filename = generateSmartFilename(prompt, {
        resolution: config.resolution || '1K',
        extension: newMedia.extension,
        maxLength: 40
    });

    log(`   ✅ Downloading: ${newMedia.type} (${newMedia.width}x${newMedia.height})`);
    log(`   📁 Filename: ${filename}`);

    // Send download request to background
    chrome.runtime.sendMessage({
        type: 'DOWNLOAD_MEDIA',
        url: newMedia.url,
        filename,
        prompt,
        aiFilenames: config.aiFilenames,
        apiKey: config.apiKey,
        folderName: config.folderName,
        embedMetadata: config.embedMetadata
    });

    // Short delay before next download
    await sleep(rand(500, 2000));
}

async function bulkHarvest(config) {
    // Quick scroll to load lazy content
    log('📜 Scanning page...');
    await quickScroll();

    const media = scanMedia();
    log(`📦 Harvesting ${media.length} items...`);

    for (let i = 0; i < media.length && batchProcessRunning; i++) {
        const item = media[i];
        if (generatedMediaUrls.has(item.url)) continue;

        generatedMediaUrls.add(item.url);
        stats.downloaded++;

        chrome.runtime.sendMessage({
            type: 'DOWNLOAD_MEDIA',
            url: item.url,
            filename: generateSmartFilename(`harvest_item_${i + 1}`, {
                resolution: '1K',
                extension: item.extension,
                prefix: 'harvest',
                maxLength: 30
            }),
            folderName: config.folderName,
            embedMetadata: config.embedMetadata
        });

        if (i % 20 === 0) log(`⬇ ${i + 1}/${media.length}`);
        await sleep(rand(300, 1000));
    }
}

async function quickScroll() {
    const step = window.innerHeight;
    let lastH = 0;

    for (let i = 0; i < 30 && batchProcessRunning; i++) {
        const h = document.documentElement.scrollHeight;
        if (h === lastH && i > 3) break;
        lastH = h;

        window.scrollBy(0, step);
        await sleep(400);
    }

    window.scrollTo(0, 0);
    await sleep(500);
}

// ==================== HARVEST MODE ====================
// Sequential video download at 1080p resolution via DOM interaction

async function runHarvestMode(config) {
    const folderName = config.folderName || 'harvest_videos';
    const speed = config.automationSpeed || 'Normal (10-59s)';

    log('🌾 ━━━ HARVEST MODE STARTED ━━━');
    log('📜 Scanning entire page for videos...');

    // Use scroll-and-collect approach to find ALL videos
    const allCards = await scrollAndCollectCards();
    const totalVideos = allCards.length;

    if (totalVideos === 0) {
        log('❌ No downloadable items found');
        log('💡 Make sure you are on the video library page');
        chrome.runtime.sendMessage({ type: 'HARVEST_COMPLETED', downloaded: 0 });
        return;
    }

    log(`📊 Found ${totalVideos} videos to harvest`);

    // Scroll to bottom to start downloading from there
    log('📍 Moving to bottom of page...');
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    await sleep(2000);

    // Download from bottom to top
    log('📥 Starting downloads (bottom to top)...');

    const reversedCards = [...allCards].reverse(); // Bottom to top

    for (let i = 0; i < reversedCards.length && harvestModeRunning; i++) {
        const card = reversedCards[i];
        const videoNum = i + 1;

        log(`🎬 [${videoNum}/${totalVideos}] Processing video...`);

        // Update progress
        chrome.runtime.sendMessage({
            type: 'HARVEST_PROGRESS',
            current: videoNum,
            total: totalVideos
        });

        // Download this video at 1080p
        const success = await downloadVideoAt1080p(card, folderName, videoNum);

        if (success) {
            stats.downloaded++;
            log(`   ✅ Download started for video ${videoNum}`);
        } else {
            stats.failed++;
            log(`   ⚠️ Failed to download video ${videoNum}`);
        }

        // Wait between downloads (countdown)
        if (i < reversedCards.length - 1 && harvestModeRunning) {
            await harvestWaitWithCountdown(speed, videoNum, totalVideos);
        }
    }

    // Complete
    harvestModeRunning = false;
    const elapsed = Math.round((Date.now() - stats.startTime) / 1000);

    log(`🌾 ━━━ HARVEST COMPLETE ━━━`);
    log(`📊 Downloaded: ${stats.downloaded} | Failed: ${stats.failed} | Time: ${elapsed}s`);

    chrome.runtime.sendMessage({
        type: 'HARVEST_COMPLETED',
        downloaded: stats.downloaded,
        failed: stats.failed,
        elapsed: elapsed
    });

    if (config.enableVoiceNotifications !== false) {
        speak(`Harvest complete. Downloaded ${stats.downloaded} videos in ${elapsed} seconds.`);
    }
}

// Scroll through page and collect all video cards
async function scrollAndCollectCards() {
    const seenElements = new Set();
    const collectedCards = [];

    log('   🔽 Scrolling to bottom to load all content...');

    // First, scroll to bottom to trigger all lazy-loading
    const step = Math.floor(window.innerHeight * 0.7);
    let lastHeight = 0;
    let stableCount = 0;

    // Scroll down slowly (5-10 seconds per step)
    for (let i = 0; i < 50 && harvestModeRunning; i++) {
        const currentHeight = document.documentElement.scrollHeight;

        // Collect visible cards at this position
        collectVisibleCards(seenElements, collectedCards);
        log(`   📍 Position ${i + 1}: Found ${collectedCards.length} cards so far`);

        // Check if we reached bottom
        const currentPos = window.pageYOffset;
        const maxScroll = currentHeight - window.innerHeight;

        if (currentPos >= maxScroll - 10) {
            if (currentHeight === lastHeight) {
                stableCount++;
                if (stableCount >= 2) break;
            } else {
                stableCount = 0;
            }
        }

        lastHeight = currentHeight;
        window.scrollBy({ top: step, behavior: 'smooth' });

        // Wait 5-10 seconds per scroll step
        const waitTime = rand(5000, 10000);
        log(`   ⏳ Waiting ${Math.ceil(waitTime / 1000)}s...`);
        await sleep(waitTime);
    }

    // Collect at bottom
    collectVisibleCards(seenElements, collectedCards);
    log(`   📍 At bottom: ${collectedCards.length} cards`);
    await sleep(3000);

    log('   🔼 Scrolling back to top...');

    // Scroll back up, collecting more cards (5-10 seconds per step)
    for (let i = 0; i < 50 && harvestModeRunning; i++) {
        const currentPos = window.pageYOffset;
        if (currentPos <= 0) break;

        collectVisibleCards(seenElements, collectedCards);
        log(`   📍 Scrolling up: ${collectedCards.length} cards`);

        window.scrollBy({ top: -step, behavior: 'smooth' });

        // Wait 5-10 seconds per scroll step
        const waitTime = rand(5000, 10000);
        log(`   ⏳ Waiting ${Math.ceil(waitTime / 1000)}s...`);
        await sleep(waitTime);
    }

    // Collect at top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await sleep(3000);
    collectVisibleCards(seenElements, collectedCards);

    log(`   🔍 Collected ${collectedCards.length} unique video cards`);

    // Sort by position (estimate based on collection order - first collected = higher on page)
    return collectedCards;
}

// Helper: collect all visible video cards at current scroll position
function collectVisibleCards(seenElements, collectedCards) {
    // Find download buttons on visible cards
    const downloadBtns = document.querySelectorAll(
        'button[aria-label*="download" i], [aria-label*="download" i], [class*="download"]'
    );

    for (const btn of downloadBtns) {
        const card = findParentCard(btn);
        if (card && !seenElements.has(card)) {
            const rect = card.getBoundingClientRect();
            // Only collect if it's visible (has size and in viewport)
            if (rect.width > 50 && rect.height > 50 && rect.top < window.innerHeight && rect.bottom > 0) {
                seenElements.add(card);
                collectedCards.push(card);
            }
        }
    }

    // Also check for video elements
    const videos = document.querySelectorAll('video');
    for (const video of videos) {
        const card = findParentCard(video);
        if (card && !seenElements.has(card)) {
            const rect = card.getBoundingClientRect();
            if (rect.width > 50 && rect.height > 50 && rect.top < window.innerHeight && rect.bottom > 0) {
                seenElements.add(card);
                collectedCards.push(card);
            }
        }
    }
}

// Scroll to top and wait for content to load - SLOW VERSION
async function harvestScrollToTop() {
    log('   🔼 Scrolling up slowly...');

    const totalHeight = document.documentElement.scrollHeight;
    const step = Math.floor(window.innerHeight * 0.8); // 80% of viewport
    let currentPos = window.pageYOffset;

    // Scroll up in visible steps
    while (currentPos > 0 && harvestModeRunning) {
        currentPos = Math.max(0, currentPos - step);
        window.scrollTo({ top: currentPos, behavior: 'smooth' });

        // Wait 2-4 seconds between each scroll step
        const waitTime = rand(2000, 4000);
        await sleep(waitTime);
    }

    // Final scroll to absolute top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await sleep(rand(2000, 3000));

    log('   📍 Reached top of page');
}

// Scroll to bottom of page - SLOW VERSION  
async function harvestScrollToBottom() {
    log('   🔽 Scrolling down slowly...');

    const step = Math.floor(window.innerHeight * 0.8); // 80% of viewport
    let lastHeight = 0;
    let stableCount = 0;

    // Scroll down in visible steps
    for (let i = 0; i < 100 && harvestModeRunning; i++) {
        const currentHeight = document.documentElement.scrollHeight;
        const currentPos = window.pageYOffset;
        const maxScroll = currentHeight - window.innerHeight;

        // Check if we've reached the bottom
        if (currentPos >= maxScroll - 10) {
            // Wait and check if more content loads
            if (currentHeight === lastHeight) {
                stableCount++;
                if (stableCount >= 2) break; // Page height stable, we're done
            } else {
                stableCount = 0;
            }
        }

        lastHeight = currentHeight;

        // Scroll down one step
        window.scrollBy({ top: step, behavior: 'smooth' });

        // Wait 2-4 seconds between each scroll step
        const waitTime = rand(2000, 4000);
        await sleep(waitTime);
    }

    // Final scroll to absolute bottom
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    await sleep(rand(2000, 3000));

    log('   📍 Reached bottom of page');
}

// Get all video card elements on the page
async function getVideoCards() {
    const cards = [];
    const seen = new Set();
    let s1 = 0, s2 = 0, s3 = 0, s4 = 0; // Debug counters

    // Strategy 1: Find all media cards by looking for download buttons
    const downloadBtns = document.querySelectorAll(
        'button[aria-label*="download" i], button[aria-label*="Download" i], ' +
        '[aria-label*="download" i], [class*="download"], button[title*="download" i]'
    );

    for (const btn of downloadBtns) {
        const card = findParentCard(btn);
        if (card && !seen.has(card)) {
            seen.add(card);
            const rect = card.getBoundingClientRect();
            if (rect.width > 50 && rect.height > 50) {
                cards.push({ card, rect });
                s1++;
            }
        }
    }

    // Strategy 2: Look for video elements
    const videos = document.querySelectorAll('video, video[src], [class*="video"] video');
    for (const video of videos) {
        const card = findParentCard(video);
        if (card && !seen.has(card)) {
            seen.add(card);
            const rect = card.getBoundingClientRect();
            if (rect.width > 50 && rect.height > 50) {
                cards.push({ card, rect });
                s2++;
            }
        }
    }

    // Strategy 3: Look for cards with video-related aria labels
    const videoLabels = document.querySelectorAll(
        '[aria-label*="video" i], [data-type*="video" i], ' +
        '[class*="veo"], [class*="generated-video"]'
    );
    for (const el of videoLabels) {
        const card = findParentCard(el) || el;
        if (!seen.has(card)) {
            seen.add(card);
            const rect = card.getBoundingClientRect();
            if (rect.width > 50 && rect.height > 50) {
                cards.push({ card, rect });
                s3++;
            }
        }
    }

    // Strategy 4: Look for grid container children (many video libraries use grids)
    const gridContainers = document.querySelectorAll(
        '[class*="grid"], [class*="list"], [class*="gallery"], ' +
        '[class*="results"], [role="grid"], [role="list"]'
    );

    for (const container of gridContainers) {
        if (container.children.length >= 5) {
            for (const child of container.children) {
                const hasMedia = child.querySelector('video, img, [class*="thumbnail"]');
                const hasDownload = child.querySelector('[aria-label*="download" i], [class*="download"]');

                if ((hasMedia || hasDownload) && !seen.has(child)) {
                    seen.add(child);
                    const rect = child.getBoundingClientRect();
                    if (rect.width > 100 && rect.height > 100) {
                        cards.push({ card: child, rect });
                        s4++;
                    }
                }
            }
        }
    }

    log(`   🔍 S1:${s1} S2:${s2} S3:${s3} S4:${s4} = Total: ${cards.length}`);

    // Sort by vertical position
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    cards.sort((a, b) => (a.rect.top + scrollTop) - (b.rect.top + scrollTop));

    return cards.map(c => c.card);
}

// Helper to find parent card container
function findParentCard(element) {
    return element.closest('[class*="card"]') ||
        element.closest('[class*="result"]') ||
        element.closest('[class*="asset"]') ||
        element.closest('[class*="item"]') ||
        element.closest('[class*="video"]') ||
        element.closest('[class*="media"]') ||
        element.closest('[class*="clip"]') ||
        element.parentElement?.parentElement?.parentElement?.parentElement ||
        element.parentElement?.parentElement?.parentElement;
}

// Download a single video at 1080p via DOM interaction
async function downloadVideoAt1080p(cardElement, folderName, videoNum) {
    try {
        // Step 1: Scroll card into view
        cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(500);

        // Step 2: Hover to reveal controls
        simulateHover(cardElement);
        await sleep(400);

        // Step 3: Find and click download button
        const downloadBtn = findDownloadButton(cardElement);

        if (!downloadBtn) {
            log('   ⚠️ Download button not found');
            return false;
        }

        log('   🔄 Clicking download button...');
        downloadBtn.click();
        await sleep(600);

        // Step 4: Find and click 1080p option (or fallback to 720p)
        const selected = await selectResolutionOption('1080');

        if (!selected) {
            // Fallback: try 720p
            log('   ⚠️ 1080p not found, trying 720p...');
            const fallback = await selectResolutionOption('720');
            if (!fallback) {
                log('   ❌ No resolution option found');
                // Click elsewhere to close menu
                document.body.click();
                return false;
            }
        }

        // Wait for download to initiate
        await sleep(1500);
        return true;

    } catch (e) {
        console.error('[FlowAI Harvest] Error:', e);
        log(`   ❌ Error: ${e.message}`);
        return false;
    }
}

// Find download button within a card
function findDownloadButton(card) {
    const selectors = [
        'button[aria-label*="download" i]',
        'button[aria-label*="Download" i]',
        '[aria-label*="download" i]',
        'button[title*="download" i]',
        '[class*="download"]',
        'button[data-tooltip*="download" i]'
    ];

    // Try direct selectors first
    for (const selector of selectors) {
        const btn = card.querySelector(selector);
        if (btn) return btn;
    }

    // Scan all buttons for download indicators
    const buttons = card.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        const title = (btn.getAttribute('title') || '').toLowerCase();
        const className = (btn.className || '').toLowerCase();
        const innerHTML = (btn.innerHTML || '').toLowerCase();

        if (label.includes('download') || title.includes('download') ||
            className.includes('download') || innerHTML.includes('file_download') ||
            innerHTML.includes('download')) {
            return btn;
        }
    }

    // Last resort: look for icon-based buttons (2nd or 3rd in toolbar)
    const toolbars = card.querySelectorAll('[class*="actions"], [class*="toolbar"], [class*="icons"]');
    for (const toolbar of toolbars) {
        const btns = toolbar.querySelectorAll('button');
        if (btns.length >= 2) {
            // Download is often 2nd button (after favorite/like)
            return btns[1];
        }
    }

    return null;
}

// Select resolution option from dropdown menu
async function selectResolutionOption(resolution) {
    // Wait for menu to appear
    await sleep(300);

    const menuSelectors = [
        '[role="menuitem"]',
        '[role="option"]',
        'mat-option',
        '[class*="menu-item"]',
        '[class*="option"]',
        '[class*="dropdown"] button',
        'button[class*="resolution"]'
    ];

    const menuItems = document.querySelectorAll(menuSelectors.join(','));

    for (const item of menuItems) {
        const text = (item.textContent || '').toLowerCase();

        // Check for resolution match (1080, 720, Upscaled, Original)
        if (resolution === '1080' && (text.includes('1080') || text.includes('upscale'))) {
            log(`   ✅ Clicking "${item.textContent.trim()}"...`);
            item.click();
            return true;
        }
        if (resolution === '720' && (text.includes('720') || text.includes('original'))) {
            log(`   ✅ Clicking "${item.textContent.trim()}"...`);
            item.click();
            return true;
        }
    }

    return false;
}

// Wait between downloads with countdown
async function harvestWaitWithCountdown(speed, currentNum, totalNum) {
    const delays = {
        'Turbo (2-5s)': [2000, 5000],
        'Fast (7-20s)': [7000, 20000],
        'Normal (10-59s)': [10000, 30000], // Reduced max for harvest
        'Slow (30-90s)': [30000, 60000]
    };

    const [min, max] = delays[speed] || delays['Normal (10-59s)'];
    const wait = rand(min, max);
    const totalSeconds = Math.ceil(wait / 1000);

    log(`   ⏳ Waiting ${totalSeconds}s before next download...`);

    // Countdown with updates
    for (let i = totalSeconds; i > 0 && harvestModeRunning; i--) {
        chrome.runtime.sendMessage({
            type: 'COUNTDOWN_UPDATE',
            remaining: i,
            total: totalSeconds,
            currentNum: currentNum,
            totalNum: totalNum
        });
        await sleep(1000);
    }
}


// Strategy: First try native UI download button, then fall back to URL modification
async function downloadWithResolution(data) {
    const { url, resolution, index, folderName } = data;

    log(`⬇ Downloading: ${resolution} resolution`);

    try {
        // STRATEGY 1: Try native Google Flow download button (down arrow)
        if (resolution !== '1K' && index !== undefined) {
            const nativeSuccess = await tryNativeDownload(index, resolution);
            if (nativeSuccess) {
                log(`✓ Native ${resolution} download triggered`);
                return { success: true, method: 'native' };
            }
        }

        // STRATEGY 2: Fall back to URL modification
        let downloadUrl = getResolutionUrl(url, resolution);
        const modified = downloadUrl !== url;

        if (modified) {
            console.log('[FlowAI] URL modified for', resolution, ':', downloadUrl);
        }


        // Send to background for download
        // Detect extension from URL (support jpg, png, webp, etc.)
        const detectedExt = detectMediaExtension(url, false);

        const filename = generateSmartFilename('manual_download', {
            resolution: resolution,
            extension: detectedExt,
            prefix: 'manual',
            maxLength: 30
        });

        chrome.runtime.sendMessage({
            type: 'DOWNLOAD_MEDIA',
            url: downloadUrl,
            filename,
            folderName,
            resolution
        });

        log(`✓ Downloaded at ${resolution}${modified ? ' (high-res URL)' : ''}`);
        return { success: true, url: downloadUrl };

    } catch (error) {
        log(`❌ Download failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Try Google Flow's native download button (down arrow icon)
// Flow: Hover over image → Download button appears → Click → Menu with 1K/2K/4K → Select
async function tryNativeDownload(index, resolution) {
    try {
        const elements = document.querySelectorAll(SEL.media);
        const mediaEl = elements[index];
        if (!mediaEl) {
            log('⚠️ Media element not found');
            return false;
        }

        // Find parent card/container that has the hover controls
        const card = mediaEl.closest('[class*="card"]') ||
            mediaEl.closest('[class*="result"]') ||
            mediaEl.closest('[class*="generated"]') ||
            mediaEl.closest('[class*="asset"]') ||
            mediaEl.closest('[class*="image"]') ||
            mediaEl.parentElement?.parentElement?.parentElement ||
            mediaEl.parentElement?.parentElement ||
            mediaEl.parentElement;

        if (!card) {
            log('⚠️ Card container not found');
            return false;
        }

        // Step 1: Simulate hover to reveal download button
        log('🔄 Hovering to reveal controls...');
        simulateHover(card);
        simulateHover(mediaEl);
        await sleep(400);

        // Step 2: Find and click the download button (down arrow icon)
        // Google Flow uses various button patterns - try multiple approaches
        const downloadBtnSelectors = [
            // Aria-label based
            'button[aria-label*="download" i]',
            'button[aria-label*="Download" i]',
            '[aria-label*="download" i]',
            '[aria-label*="save" i]',
            // Tooltip/title based
            'button[data-tooltip*="download" i]',
            '[title*="download" i]',
            '[title*="Download" i]',
            // Material Design buttons
            'mat-icon-button[aria-label*="download" i]',
            'button mat-icon',
            // Class-based
            '[class*="download"]',
            '[class*="Download"]'
        ];

        let downloadBtn = null;

        // First try within the card
        for (const selector of downloadBtnSelectors) {
            downloadBtn = card.querySelector(selector);
            if (downloadBtn) {
                console.log('[FlowAI] Found download button in card with selector:', selector);
                break;
            }
        }

        // If not found in card, look for button groups (icon row at top-right of image)
        if (!downloadBtn) {
            // Look for buttons in any icon group/toolbar within the card
            const iconButtons = card.querySelectorAll('button, [role="button"]');
            for (const btn of iconButtons) {
                const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                const title = (btn.getAttribute('title') || '').toLowerCase();
                const className = (btn.className || '').toLowerCase();
                const innerHTML = (btn.innerHTML || '').toLowerCase();

                // Check various indicators
                if (label.includes('download') || label.includes('save') ||
                    title.includes('download') || title.includes('save') ||
                    className.includes('download') ||
                    innerHTML.includes('download') || innerHTML.includes('file_download')) {
                    downloadBtn = btn;
                    console.log('[FlowAI] Found download button by scanning:', btn);
                    break;
                }
            }
        }

        // Last resort: look for any icon button that might be download (second or third button in a row)
        if (!downloadBtn) {
            const buttonRows = card.querySelectorAll('[class*="actions"], [class*="toolbar"], [class*="icons"]');
            for (const row of buttonRows) {
                const buttons = row.querySelectorAll('button');
                // Download is often the 2nd button (after heart/favorite)
                if (buttons.length >= 2) {
                    downloadBtn = buttons[1]; // Try the second button
                    console.log('[FlowAI] Guessing download button is 2nd in row');
                    break;
                }
            }
        }

        // Debug: log what we found
        if (!downloadBtn) {
            console.log('[FlowAI] Card HTML:', card.innerHTML.substring(0, 500));
            log('⚠️ Download button not found - check console for DOM');
            return false;
        }

        log('🔄 Clicking download button...');
        downloadBtn.click();
        await sleep(600);

        // Step 3: Find and click resolution option in menu
        // Menu options have text like "Download 1K", "Download 2K", "Download 4K"
        const targetText = `download ${resolution}`.toLowerCase();

        // Look for menu items globally (menus often render as overlays)
        const menuItemSelectors = [
            '[role="menuitem"]',
            '[role="option"]',
            'mat-option',
            '[class*="menu-item"]',
            '[class*="dropdown"] button',
            '[class*="menu"] button',
            'button[class*="option"]'
        ];

        const menuItems = document.querySelectorAll(menuItemSelectors.join(','));
        console.log('[FlowAI] Found', menuItems.length, 'menu items');

        for (const item of menuItems) {
            const text = item.textContent.toLowerCase().trim();
            console.log('[FlowAI] Menu item:', text);

            if (text.includes(targetText) || text === targetText) {
                log(`✓ Clicking "${item.textContent.trim()}"...`);
                item.click();

                // For 2K/4K, upscaling starts and auto-downloads
                if (resolution !== '1K') {
                    log('🔄 Upscaling... download will start automatically');
                }
                return true;
            }
        }

        // Fallback: try matching just the resolution number
        for (const item of menuItems) {
            const text = item.textContent.toLowerCase();
            if (text.includes(resolution.toLowerCase())) {
                log(`✓ Clicking "${item.textContent.trim()}"...`);
                item.click();
                return true;
            }
        }

        log('⚠️ Resolution menu option not found');
        return false;

    } catch (e) {
        console.error('[FlowAI] Native download error:', e);
        log(`❌ Native download failed: ${e.message}`);
        return false;
    }
}

// Simulate mouse hover events
function simulateHover(element) {
    if (!element) return;
    const events = ['mouseenter', 'mouseover', 'mousemove'];
    events.forEach(type => {
        element.dispatchEvent(new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window
        }));
    });
}

// Modify Google image URL to request specific resolution
// Uses documented Google URL parameters: =s{size}, =w{width}, =h{height}
// Reference: https://developers.google.com/photos/library/guides/access-media-items
function getResolutionUrl(url, resolution) {
    // Google image size parameter mapping
    const sizeParam = {
        '1K': 's1024',   // 1024px longest edge
        '2K': 's2048',   // 2048px longest edge  
        '4K': 's4096'    // 4096px longest edge (or s0 for original)
    };

    const param = sizeParam[resolution] || 's1024';

    // Handle googleusercontent.com URLs (most common for Google Flow)
    if (url.includes('googleusercontent.com') || url.includes('ggpht.com') || url.includes('lh3.google')) {
        // Remove any existing size/width/height parameters
        let cleanUrl = url
            .replace(/=s\d+(-[a-z0-9-]+)?$/i, '')
            .replace(/=w\d+(-h\d+)?(-[a-z0-9-]+)?$/i, '')
            .replace(/=h\d+(-[a-z0-9-]+)?$/i, '');

        // Append new size parameter
        return `${cleanUrl}=${param}`;
    }

    // For other URLs, return as-is (blob:, storage.googleapis.com, etc.)
    return url;
}

// ==================== UTILITIES ====================
function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function log(msg) {
    console.log(`[FlowAI] ${msg}`);
    chrome.runtime.sendMessage({
        type: 'LOG_ACTIVITY',
        log: { time: new Date().toTimeString().split(' ')[0], message: msg }
    });
}

function speak(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.0;
        window.speechSynthesis.speak(u);
    }
}

console.log('Flow AI v5.0 TURBO Ready - 1000+ media generation enabled');

// Initialize media observer for accurate media detection
initMediaObserver();
