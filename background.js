// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Flow AI Media Downloader installed');
  // Enable side panel globally
  chrome.sidePanel.setPanelOptions({
    path: 'sidepanel/index.html',
    enabled: true
  }).catch((error) => console.error(error));
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// ==================== ERROR HANDLING UTILITIES ====================

/**
 * Valid Google Flow platform URL patterns
 */
const VALID_PLATFORMS = [
  'flow.google.com',
  'aistudio.google.com',
  'labs.google'
];

/**
 * Find a valid tab with Google Flow platform
 * @returns {Promise<chrome.tabs.Tab|null>} Valid tab or null
 */
async function getValidTab() {
  const tabs = await chrome.tabs.query({ active: true });
  const validTab = tabs.find(t =>
    t.url && t.id && VALID_PLATFORMS.some(p => t.url.includes(p))
  );
  return validTab || null;
}

/**
 * Send message to content script with retry logic
 * @param {number} tabId - Tab ID to send message to
 * @param {Object} message - Message to send
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<Object>} Response from content script
 */
async function sendToContentScriptWithRetry(tabId, message, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response || { success: true });
          }
        });
      });
    } catch (e) {
      console.log(`Message send attempt ${attempt}/${maxRetries} failed:`, e.message);
      if (attempt === maxRetries) {
        return { success: false, error: e.message };
      }
      // Exponential backoff
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Safe wrapper for tab operations
 * @param {Function} operation - Async operation to perform
 * @param {*} fallback - Fallback value on error
 * @returns {Promise<*>} Result or fallback
*/
async function safeTabOperation(operation, fallback = { success: false, error: 'Operation failed' }) {
  try {
    return await operation();
  } catch (e) {
    console.error('Tab operation error:', e);
    return fallback;
  }
}

// ==================== DOWNLOAD QUEUE MANAGEMENT ====================

const downloadQueue = [];
const MAX_CONCURRENT_DOWNLOADS = 3;
let activeDownloads = 0;
const downloadStats = {
  total: 0,
  completed: 0,
  failed: 0,
  retried: 0
};

/**
 * Add download to queue
 * @param {Object} task - Download task
 * @returns {Promise<Object>} Download result
 */
async function enqueueDownload(task) {
  return new Promise((resolve, reject) => {
    downloadQueue.push({
      task,
      resolve,
      reject,
      attempts: 0,
      maxAttempts: 3
    });
    downloadStats.total++;
    processDownloadQueue();
  });
}

/**
 * Process download queue with concurrency control
 */
async function processDownloadQueue() {
  while (downloadQueue.length > 0 && activeDownloads < MAX_CONCURRENT_DOWNLOADS) {
    const item = downloadQueue.shift();
    activeDownloads++;

    try {
      const result = await executeDownloadWithRetry(item);
      downloadStats.completed++;
      item.resolve(result);
    } catch (e) {
      downloadStats.failed++;
      item.reject(e);
    } finally {
      activeDownloads--;
      // Continue processing queue
      if (downloadQueue.length > 0) {
        processDownloadQueue();
      }
    }
  }
}

/**
 * Execute download with retry logic
 * @param {Object} item - Queue item with task and attempt info
 * @returns {Promise<Object>} Download result
 */
async function executeDownloadWithRetry(item) {
  const { task, maxAttempts } = item;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    item.attempts = attempt;

    try {
      const result = await executeDownload(task);
      return result;
    } catch (e) {
      console.log(`Download attempt ${attempt}/${maxAttempts} failed:`, e.message);

      if (attempt === maxAttempts) {
        throw e;
      }

      downloadStats.retried++;
      // Exponential backoff: 1s, 2s, 4s
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * Execute single download with timeout
 * @param {Object} task - Download task
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<Object>} Download result
 */
async function executeDownload(task, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Download timeout'));
    }, timeout);

    chrome.downloads.download({
      url: task.url,
      filename: task.filename,
      saveAs: false
    }, (downloadId) => {
      clearTimeout(timeoutId);

      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (downloadId) {
        resolve({ success: true, downloadId });
      } else {
        reject(new Error('Download failed - no ID returned'));
      }
    });
  });
}

/**
 * Get download queue statistics
 * @returns {Object} Download stats
 */
function getDownloadStats() {
  return {
    ...downloadStats,
    queued: downloadQueue.length,
    active: activeDownloads
  };
}

/**
 * Clear download statistics
 */
function resetDownloadStats() {
  downloadStats.total = 0;
  downloadStats.completed = 0;
  downloadStats.failed = 0;
  downloadStats.retried = 0;
}


// Listen for messages from content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  switch (message.type) {
    case 'DETECT_MEDIA':
      // Forward to active tab's content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'SCAN_MEDIA' }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('DETECT_MEDIA failed:', chrome.runtime.lastError.message);
              sendResponse({ success: false, error: chrome.runtime.lastError.message, media: [] });
              return;
            }
            sendResponse(response);
          });
        } else {
          sendResponse({ success: false, error: 'No active tab found', media: [] });
        }
      });
      return true; // Keep message channel open for async response

    case 'START_BATCH':
      // Forward batch start command to the currently active tab
      chrome.tabs.query({ active: true }, (tabs) => {
        const targetTab = tabs.find(t => t.url && (t.url.includes('flow.google.com') || t.url.includes('aistudio.google.com') || t.url.includes('labs.google')));
        if (targetTab) {
          chrome.tabs.sendMessage(targetTab.id, {
            type: 'START_BATCH_PROCESS',
            data: message.data
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending START_BATCH_PROCESS:', chrome.runtime.lastError);
            }
            sendResponse(response);
          });
        } else {
          console.error('No suitable active tab found for batch processing');
          sendResponse({ success: false, error: 'No active AI Studio tab found' });
        }
      });
      return true;

    case 'STOP_BATCH':
      chrome.tabs.query({ active: true }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { type: 'STOP_BATCH_PROCESS' });
        });
      });
      return true;

    case 'START_HARVEST_MODE':
      // Forward harvest mode command to the active tab
      chrome.tabs.query({ active: true }, (tabs) => {
        const targetTab = tabs.find(t => t.url && (t.url.includes('flow.google.com') || t.url.includes('aistudio.google.com') || t.url.includes('labs.google')));
        if (targetTab) {
          chrome.tabs.sendMessage(targetTab.id, {
            type: 'START_HARVEST_MODE',
            data: message.data
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending START_HARVEST_MODE:', chrome.runtime.lastError);
            }
            sendResponse(response);
          });
        } else {
          console.error('No suitable active tab found for harvest mode');
          sendResponse({ success: false, error: 'No active AI Studio tab found' });
        }
      });
      return true;

    case 'STOP_HARVEST_MODE':
      chrome.tabs.query({ active: true }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { type: 'STOP_HARVEST_MODE' });
        });
      });
      return true;

    case 'DOWNLOAD_WITH_RESOLUTION':
      // Forward to content script for resolution-aware download
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'DOWNLOAD_WITH_RESOLUTION',
            data: message.data
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('DOWNLOAD_WITH_RESOLUTION failed:', chrome.runtime.lastError.message);
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
              return;
            }
            sendResponse(response);
          });
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      });
      return true;

    case 'DOWNLOAD_MEDIA':
      handleDownload(message, sendResponse);
      return true;

    case 'BATCH_PROGRESS':
      updateBatchProgress(message.currentIndex);
      break;

    case 'LOG_ACTIVITY':
      // Forward log to side panel
      chrome.runtime.sendMessage({
        type: 'UPDATE_LOG',
        log: message.log
      });
      break;

    case 'HEARTBEAT':
      // Connection health check - respond immediately
      sendResponse({ alive: true, timestamp: Date.now() });
      return true;

    case 'DOWNLOAD_STATS':
      // Return download queue statistics
      sendResponse(getDownloadStats());
      return true;

    case 'RESET_DOWNLOAD_STATS':
      // Reset download statistics
      resetDownloadStats();
      sendResponse({ success: true });
      return true;

    default:
      console.log('Unknown message type:', message.type);
  }

  return false;
});

// Handle media download with optional AI filename generation and metadata embedding
async function handleDownload(message, sendResponse) {
  let filename = message.filename || 'flow_media.png';
  let prompt = message.prompt || '';

  if (message.aiFilenames && message.apiKey && prompt) {
    try {
      const aiName = await generateAIFilename(prompt, message.apiKey);
      if (aiName) {
        const ext = filename.split('.').pop();
        filename = `${message.folderName || 'flow_media'}/${aiName}.${ext}`;
      }
    } catch (error) {
      console.error('AI Filename generation failed:', error);
    }
  } else if (message.folderName) {
    if (!filename.includes('/')) {
      filename = `${message.folderName}/${filename}`;
    }
  }

  try {
    // If we have a prompt and it's a PNG, try to embed metadata
    const isPng = filename.toLowerCase().endsWith('.png') || message.url.includes('.png') || (message.url.startsWith('blob:') && !message.filename?.endsWith('.mp4'));

    let downloadUrl = message.url;

    if (prompt && isPng) {
      try {
        const response = await fetch(message.url);
        const arrayBuffer = await response.arrayBuffer();
        const newBuffer = injectPNGMetadata(arrayBuffer, 'Prompt', prompt);

        // Convert ArrayBuffer to Base64 (Service-worker friendly)
        const base64 = bufferToBase64(newBuffer);
        downloadUrl = `data:image/png;base64,${base64}`;
      } catch (metadataError) {
        console.error('Metadata embedding failed, using original URL:', metadataError);
        // Continue with original URL
      }
    }

    // Use download queue for reliable downloading
    const result = await enqueueDownload({
      url: downloadUrl,
      filename: filename
    });

    sendResponse(result);
  } catch (error) {
    console.error('Download failed:', error);

    // Fallback: try direct download without queue
    try {
      chrome.downloads.download({
        url: message.url,
        filename: filename,
        saveAs: false
      }, (downloadId) => {
        sendResponse({ success: !!downloadId, downloadId, fallback: true });
      });
    } catch (fallbackError) {
      sendResponse({ success: false, error: error.message });
    }
  }
}

// Helper to convert buffer to base64 in service worker
function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Inject a tEXt chunk into a PNG buffer
function injectPNGMetadata(buffer, key, value) {
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  // PNG Signature is 8 bytes
  // Find first chunk (usually IHDR)
  let pos = 8;

  // Create the tEXt chunk
  const keyEncoded = new TextEncoder().encode(key);
  const valueEncoded = new TextEncoder().encode(value);
  const chunkData = new Uint8Array(keyEncoded.length + 1 + valueEncoded.length);
  chunkData.set(keyEncoded, 0);
  chunkData[keyEncoded.length] = 0; // Null separator
  chunkData.set(valueEncoded, keyEncoded.length + 1);

  const type = new TextEncoder().encode('tEXt');
  const chunkLength = chunkData.length;
  const newChunk = new Uint8Array(12 + chunkLength);

  // Length (4 bytes)
  new DataView(newChunk.buffer).setUint32(0, chunkLength);
  // Type (4 bytes)
  newChunk.set(type, 4);
  // Data
  newChunk.set(chunkData, 8);

  // CRC (4 bytes) - Simplified CRC calculation or just copy if possible
  // For simplicity and speed in this context, we can omit strict CRC check if the browser allows 
  // OR implement a minimal CRC32. Let's do a simple CRC32 to be safe.
  const crc = crc32(newChunk.slice(4, 8 + chunkLength));
  new DataView(newChunk.buffer).setUint32(8 + chunkLength, crc);

  // Find injection point (after IHDR, which is usually the first 8+12+13 bytes)
  // IHDR length is always 13. 8 (sig) + 4 (len) + 4 (type) + 13 (data) + 4 (crc) = 33
  const ihdrEnd = 33;

  const result = new Uint8Array(uint8.length + newChunk.length);
  result.set(uint8.slice(0, ihdrEnd), 0);
  result.set(newChunk, ihdrEnd);
  result.set(uint8.slice(ihdrEnd), ihdrEnd + newChunk.length);

  return result.buffer;
}

// Minimal CRC32 implementation
function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate descriptive filename using GLM 4.7 API
async function generateAIFilename(prompt, apiKey) {
  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'glm-4',
        messages: [
          {
            role: 'system',
            content: 'You are a filename generator. Given a prompt for an AI image, generate a short (3-5 words), descriptive, kebab-case filename. Output ONLY the filename, no extension, no spaces, no special characters other than hyphens.'
          },
          {
            role: 'user',
            content: `Prompt: ${prompt}`
          }
        ],
        max_tokens: 20,
        temperature: 0.7
      })
    });

    if (response.ok) {
      const data = await response.json();
      const filename = data.choices[0].message.content.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      return filename;
    }
  } catch (error) {
    console.error('GLM API Error:', error);
  }
  return null;
}

// Update batch progress in storage
async function updateBatchProgress(index) {
  const settings = await chrome.storage.local.get(['activeBatch']);
  if (settings.activeBatch) {
    settings.activeBatch.currentIndex = index;
    settings.activeBatch.isRunning = true;
    await chrome.storage.local.set({ activeBatch: settings.activeBatch });
  }
}
