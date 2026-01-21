# Chrome Extension UI Tech Stack & Template
## Complete UI System for Immediate Feature Development

---

## 📋 PROJECT OVERVIEW

**Extension Type**: Chrome Extension (Manifest V3)  
**Primary Function**: AI Media Downloader with Batch Processing  
**UI Location**: Chrome Side Panel  
**Target Platforms**: Google Flow AI, Google AI Studio  

---

## 🛠️ CORE TECH STACK

### 1. **Extension Architecture**
- **Manifest Version**: 3
- **Core Components**:
  - `manifest.json` - Extension configuration
  - `background.js` - Service Worker (background tasks, downloads, API calls)
  - `content.js` - Content Script (page interaction, DOM manipulation, media detection)
  - `sidepanel/` - Side Panel UI (user interface)

### 2. **Frontend Stack**
- **HTML**: Vanilla HTML5
- **CSS**: Pure CSS3 (NO frameworks, NO Tailwind, NO Bootstrap)
- **JavaScript**: Vanilla ES6+ (NO React, NO Vue, NO frameworks)
- **Rendering**: Client-side JavaScript string templates (template literals)

### 3. **Architecture Pattern**
- **Pattern**: Single-Page Application (SPA)
- **State Management**: Class-based state with reactive rendering
- **Communication**: Chrome Extension Message Passing API
- **Storage**: Chrome Storage API (local)

---

## 🎨 DESIGN SYSTEM

### Color Palette (CSS Variables)
```css
:root {
    --bg: #0a0a0f;           /* Main background - deep dark */
    --surface: #12121a;      /* Cards/sections - elevated dark */
    --border: #1f1f2e;       /* Borders - subtle separation */
    --cyan: #00f2ff;         /* Primary accent - vibrant cyan */
    --green: #00ff88;        /* Success/positive - neon green */
    --red: #ff4466;          /* Error/stop - vibrant red */
    --orange: #ff9f43;       /* Warning/resume - warm orange */
    --text: #e8e8e8;         /* Primary text - soft white */
    --muted: #666;           /* Secondary text - muted gray */
    --glass: rgba(255, 255, 255, 0.03); /* Glassmorphism effect */
}
```

### Typography
- **Font Family**: `'Inter', -apple-system, sans-serif`
- **Base Font Size**: `13px`
- **Monospace**: `'Monaco', 'Consolas', monospace` (for logs/code)
- **Font Weights**:
  - Normal: `400`
  - Medium: `500`
  - Semibold: `600`

### Spacing System
- **Base Unit**: `4px`
- **Common Values**: `8px`, `10px`, `12px`, `16px`
- **Container Padding**: `16px`
- **Element Gaps**: `8px` - `12px`

### Border Radius
- **Small**: `4px` - `6px` (mini buttons)
- **Medium**: `8px` (inputs, buttons)
- **Large**: `12px` (sections, cards)
- **Full**: `50%` (circular elements)

### Visual Effects
- **Glassmorphism**: `background: rgba(255, 255, 255, 0.03)`
- **Glow Effects**: `box-shadow: 0 0 20px rgba(color, 0.4)`
- **Text Glow**: `text-shadow: 0 0 20px rgba(color, 0.3)`
- **Transitions**: `transition: all 0.2s`

---

## 🏗️ FILE STRUCTURE

```
your-extension/
├── manifest.json              # Extension configuration
├── background.js              # Service worker (downloads, API calls)
├── content.js                 # Content script (page interaction)
├── icons/                     # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── sidepanel/                 # UI files
    ├── index.html             # Minimal HTML shell
    ├── app.js                 # Main application logic
    └── styles.css             # Complete CSS styling
```

---

## 📄 COMPLETE STARTER TEMPLATES

### 1. manifest.json
```json
{
    "manifest_version": 3,
    "name": "Your Extension Name",
    "version": "1.0.0",
    "description": "Your extension description",
    "permissions": [
        "sidePanel",
        "storage",
        "downloads",
        "activeTab"
    ],
    "host_permissions": [
        "https://yoursite.com/*"
    ],
    "background": {
        "service_worker": "background.js"
    },
    "side_panel": {
        "default_path": "sidepanel/index.html"
    },
    "action": {
        "default_title": "Open Panel",
        "default_icon": {
            "16": "icons/icon16.png",
            "48": "icons/icon48.png",
            "128": "icons/icon128.png"
        }
    },
    "content_scripts": [
        {
            "matches": ["https://yoursite.com/*"],
            "js": ["content.js"],
            "run_at": "document_idle"
        }
    ],
    "icons": {
        "16": "icons/icon16.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png"
    }
}
```

### 2. sidepanel/index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Extension</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div id="root"></div>
    <script src="app.js"></script>
</body>
</html>
```

### 3. sidepanel/styles.css (COMPLETE DESIGN SYSTEM)
```css
/* ==================== FOUNDATION ==================== */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

:root {
    --bg: #0a0a0f;
    --surface: #12121a;
    --border: #1f1f2e;
    --cyan: #00f2ff;
    --green: #00ff88;
    --red: #ff4466;
    --orange: #ff9f43;
    --text: #e8e8e8;
    --muted: #666;
    --glass: rgba(255, 255, 255, 0.03);
}

body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', -apple-system, sans-serif;
    font-size: 13px;
    min-height: 100vh;
}

.app {
    padding: 16px;
    max-width: 400px;
}

/* ==================== TYPOGRAPHY ==================== */
h1 {
    font-size: 18px;
    font-weight: 600;
    color: var(--cyan);
    text-align: center;
    margin-bottom: 16px;
    text-shadow: 0 0 20px rgba(0, 242, 255, 0.3);
}

/* ==================== LAYOUT COMPONENTS ==================== */
.section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
}

.row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}

.row label {
    flex: 0 0 70px;
    color: var(--muted);
}

.row input,
.row select {
    flex: 1;
    margin-bottom: 0;
}

.slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}

.slider-row label {
    flex: 0 0 50px;
    color: var(--muted);
}

.slider-row input {
    flex: 1;
}

.slider-row span {
    width: 35px;
    text-align: right;
    color: var(--cyan);
}

.toggle-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
}

.toggle-row:last-child {
    border-bottom: none;
}

/* ==================== FORM ELEMENTS ==================== */
textarea,
input[type="text"],
input[type="password"],
select {
    width: 100%;
    padding: 10px 12px;
    background: var(--glass);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 13px;
    margin-bottom: 10px;
    resize: none;
}

textarea:focus,
input:focus,
select:focus {
    outline: none;
    border-color: var(--cyan);
    box-shadow: 0 0 10px rgba(0, 242, 255, 0.1);
}

select option {
    background: var(--surface);
    color: var(--text);
    padding: 8px;
}

input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--cyan);
    cursor: pointer;
}

input[type="range"] {
    -webkit-appearance: none;
    background: var(--border);
    height: 4px;
    border-radius: 2px;
}

input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    background: var(--cyan);
    border-radius: 50%;
    cursor: pointer;
}

/* ==================== BUTTONS ==================== */
.btn {
    flex: 1;
    padding: 12px;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    text-transform: uppercase;
    font-size: 12px;
}

.btn.green {
    background: var(--green);
    color: #000;
}

.btn.green:hover {
    box-shadow: 0 0 20px rgba(0, 255, 136, 0.4);
}

.btn.red {
    background: var(--red);
    color: #fff;
}

.btn.red:hover {
    box-shadow: 0 0 20px rgba(255, 68, 102, 0.4);
}

.btn.cyan {
    background: var(--cyan);
    color: #000;
}

.btn.cyan:hover {
    box-shadow: 0 0 20px rgba(0, 242, 255, 0.4);
}

.btn.orange {
    background: var(--orange);
    color: #000;
}

.btn.orange:hover {
    box-shadow: 0 0 20px rgba(255, 159, 67, 0.4);
}

.btn.full {
    width: 100%;
    margin-top: 8px;
}

.btn-row {
    display: flex;
    gap: 8px;
    margin-top: 8px;
}

.mini-btn {
    background: var(--glass);
    border: 1px solid var(--border);
    color: var(--text);
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
}

/* ==================== MODE SWITCH ==================== */
.mode-switch {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
}

.mode-switch button {
    flex: 1;
    padding: 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--muted);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
}

.mode-switch button.active {
    background: linear-gradient(135deg, var(--cyan), #0099ff);
    color: #000;
    border-color: var(--cyan);
    font-weight: 600;
}

/* ==================== STATUS ==================== */
.status {
    text-align: center;
    padding: 8px;
    background: var(--glass);
    border-radius: 6px;
    margin-bottom: 12px;
    color: var(--cyan);
    font-weight: 500;
}

/* ==================== PROGRESS ==================== */
.progress-bar {
    height: 6px;
    background: var(--border);
    border-radius: 3px;
    margin: 12px 0 4px;
    overflow: hidden;
}

.progress-bar .fill {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, var(--cyan), var(--green));
    border-radius: 3px;
    transition: width 0.3s;
}

.progress-text {
    text-align: center;
    color: var(--muted);
    font-size: 12px;
    margin-bottom: 12px;
}

/* ==================== LOG ==================== */
.log {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
}

.log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: var(--glass);
    border-bottom: 1px solid var(--border);
}

.log-header span {
    font-weight: 500;
}

.log-header button {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 11px;
}

.log-content {
    height: 150px;
    overflow-y: auto;
    padding: 8px;
    font-family: 'Monaco', 'Consolas', monospace;
    font-size: 11px;
}

.log-entry {
    display: flex;
    gap: 8px;
    padding: 3px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.log-time {
    color: var(--muted);
    flex-shrink: 0;
}

.log-msg {
    color: var(--text);
    word-break: break-word;
}

/* ==================== SCROLLBAR ==================== */
::-webkit-scrollbar {
    width: 6px;
}

::-webkit-scrollbar-track {
    background: var(--surface);
}

::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
    background: var(--muted);
}
```

### 4. sidepanel/app.js (APPLICATION TEMPLATE)
```javascript
// Main Application Class
class YourExtension {
    constructor() {
        // State
        this.status = 'Ready';
        this.activityLog = [
            { time: '--:--:--', message: 'Extension Ready v1.0' }
        ];
        
        this.init();
    }

    async init() {
        // Load saved settings from storage
        const settings = await chrome.storage.local.get([
            'yourSetting1',
            'yourSetting2'
        ]);
        
        // Initialize settings
        // this.yourSetting1 = settings.yourSetting1 || 'default';
        
        this.render();
        this.listen();
    }

    // Add log entry
    addLog(msg) {
        this.activityLog.push({
            time: new Date().toTimeString().split(' ')[0],
            message: msg
        });
        if (this.activityLog.length > 100) this.activityLog.shift();
        this.updateLogUI();
    }

    // Update log display
    updateLogUI() {
        const el = document.getElementById('logContent');
        if (el) {
            el.innerHTML = this.activityLog.map(e =>
                `<div class="log-entry"><span class="log-time">${e.time}</span><span class="log-msg">${e.message}</span></div>`
            ).join('');
            el.scrollTop = el.scrollHeight;
        }
    }

    // Update status display
    updateStatus(s) {
        this.status = s;
        const el = document.getElementById('status');
        if (el) el.textContent = s;
    }

    // Message listener for background/content script messages
    listen() {
        chrome.runtime.onMessage.addListener(msg => {
            if (msg.type === 'UPDATE_LOG') {
                this.addLog(msg.log.message);
            }
            // Add more message handlers here
        });
    }

    // Attach event listeners to UI elements
    attach() {
        // Example: button click
        document.getElementById('yourButton')?.addEventListener('click', () => {
            this.yourAction();
        });

        // Example: input change
        document.getElementById('yourInput')?.addEventListener('input', e => {
            this.yourValue = e.target.value;
        });

        // Add more event listeners here
    }

    // Your custom methods
    yourAction() {
        this.addLog('Action performed');
        
        // Send message to background script
        chrome.runtime.sendMessage({
            type: 'YOUR_ACTION',
            data: { /* your data */ }
        });
    }

    // Main render method
    render() {
        const root = document.getElementById('root');

        root.innerHTML = `
            <div class="app">
                <h1>⚡ Your Extension Name</h1>
                
                <div class="status" id="status">${this.status}</div>
                
                <div class="section">
                    <!-- Your UI components here -->
                    <div class="row">
                        <label>Setting</label>
                        <input type="text" id="yourInput" placeholder="Enter value">
                    </div>
                    
                    <div class="btn-row">
                        <button id="yourButton" class="btn cyan">Action</button>
                    </div>
                </div>

                <!-- Activity Log -->
                <div class="log">
                    <div class="log-header">
                        <span>Activity</span>
                        <button id="clearLog">Clear</button>
                    </div>
                    <div id="logContent" class="log-content">
                        ${this.activityLog.map(e =>
                            `<div class="log-entry"><span class="log-time">${e.time}</span><span class="log-msg">${e.message}</span></div>`
                        ).join('')}
                    </div>
                </div>
            </div>
        `;

        this.attach();
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => new YourExtension());
```

### 5. background.js (SERVICE WORKER TEMPLATE)
```javascript
// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
    
    // Enable side panel
    chrome.sidePanel.setPanelOptions({
        path: 'sidepanel/index.html',
        enabled: true
    }).catch(error => console.error(error));
});

// Open side panel on icon click
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received:', message);

    switch (message.type) {
        case 'YOUR_ACTION':
            handleYourAction(message.data, sendResponse);
            return true; // Keep channel open for async

        case 'LOG_ACTIVITY':
            // Forward log to side panel
            chrome.runtime.sendMessage({
                type: 'UPDATE_LOG',
                log: message.log
            });
            break;

        default:
            console.log('Unknown message type:', message.type);
    }

    return false;
});

// Your custom handlers
async function handleYourAction(data, sendResponse) {
    try {
        // Your logic here
        sendResponse({ success: true });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}
```

### 6. content.js (CONTENT SCRIPT TEMPLATE)
```javascript
console.log('Content script loaded');

// Listen for messages from background/sidepanel
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    switch (msg.type) {
        case 'YOUR_COMMAND':
            handleYourCommand(msg.data);
            respond({ success: true });
            return false;
    }
    return false;
});

// Helper: Log to background
function log(message) {
    chrome.runtime.sendMessage({
        type: 'LOG_ACTIVITY',
        log: {
            time: new Date().toTimeString().split(' ')[0],
            message: message
        }
    });
}

// Your custom functions
function handleYourCommand(data) {
    log('Command received');
    // Your page interaction logic here
}
```

---

## 🎯 UI COMPONENT LIBRARY

### Pre-built Components You Can Copy-Paste

#### Mode Switch (Tabs)
```javascript
// HTML
const modeSwitch = `
    <div class="mode-switch">
        <button id="mode1" class="${this.mode === 'mode1' ? 'active' : ''}">Mode 1</button>
        <button id="mode2" class="${this.mode === 'mode2' ? 'active' : ''}">Mode 2</button>
    </div>
`;

// Event Listeners
document.getElementById('mode1')?.addEventListener('click', () => {
    this.mode = 'mode1';
    this.render();
});
```

#### Input Row
```javascript
const inputRow = `
    <div class="row">
        <label>Name</label>
        <input type="text" id="nameInput" value="${this.name}">
    </div>
`;
```

#### Toggle Switch
```javascript
const toggleRow = `
    <div class="toggle-row">
        <label>Enable Feature</label>
        <input type="checkbox" id="featureToggle" ${this.enabled ? 'checked' : ''}>
    </div>
`;
```

#### Slider
```javascript
const sliderRow = `
    <div class="slider-row">
        <label>Count</label>
        <input type="range" id="countSlider" min="1" max="100" value="${this.count}">
        <span id="countVal">${this.count}</span>
    </div>
`;

// Event
document.getElementById('countSlider')?.addEventListener('input', e => {
    this.count = +e.target.value;
    document.getElementById('countVal').textContent = this.count;
});
```

#### Progress Bar
```javascript
// HTML
const progressBar = `
    <div class="progress-bar">
        <div id="progressFill" class="fill"></div>
    </div>
    <div id="progressText" class="progress-text">${this.current}/${this.total}</div>
`;

// Update method
updateProgress(current, total) {
    this.current = current;
    this.total = total;
    const bar = document.getElementById('progressFill');
    const txt = document.getElementById('progressText');
    if (bar && total > 0) {
        bar.style.width = `${(current / total) * 100}%`;
    }
    if (txt) {
        txt.textContent = `${current}/${total}`;
    }
}
```

#### Button Row
```javascript
const btnRow = `
    <div class="btn-row">
        <button id="startBtn" class="btn green">▶ Start</button>
        <button id="stopBtn" class="btn red">■ Stop</button>
    </div>
`;
```

---

## 🔧 COMMUNICATION PATTERNS

### Side Panel → Background
```javascript
// In sidepanel/app.js
chrome.runtime.sendMessage({
    type: 'YOUR_ACTION',
    data: { value: 'test' }
}, response => {
    if (response?.success) {
        this.addLog('✓ Success');
    }
});
```

### Background → Side Panel
```javascript
// In background.js
chrome.runtime.sendMessage({
    type: 'UPDATE_LOG',
    log: { message: 'Background event occurred' }
});
```

### Content Script → Background
```javascript
// In content.js
chrome.runtime.sendMessage({
    type: 'PAGE_EVENT',
    data: { info: 'something happened on page' }
});
```

### Background → Content Script
```javascript
// In background.js
chrome.tabs.query({ active: true }, (tabs) => {
    if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
            type: 'DO_SOMETHING',
            data: { command: 'scan' }
        }, response => {
            console.log('Response:', response);
        });
    }
});
```

---

## 💾 STORAGE PATTERNS

### Save Settings
```javascript
await chrome.storage.local.set({
    yourSetting: this.yourValue,
    anotherSetting: this.anotherValue
});
```

### Load Settings
```javascript
const settings = await chrome.storage.local.get([
    'yourSetting',
    'anotherSetting'
]);

this.yourValue = settings.yourSetting || 'default';
this.anotherValue = settings.anotherSetting || 0;
```

### Remove Settings
```javascript
await chrome.storage.local.remove(['yourSetting']);
```

### Clear All
```javascript
await chrome.storage.local.clear();
```

---

## ✨ BEST PRACTICES

### 1. **State Management**
- Keep all state in a single class
- Use `this.render()` to reactively update UI
- Save important state to `chrome.storage.local`

### 2. **Event Handling**
- Always re-attach event listeners after `render()`
- Use optional chaining for safety: `element?.addEventListener()`
- Clean up listeners if needed

### 3. **Message Passing**
- Use descriptive message types: `'START_BATCH'`, `'DOWNLOAD_MEDIA'`
- Always include `type` field
- Use `return true` for async responses

### 4. **Performance**
- Keep log arrays limited (max 100 items)
- Debounce frequent updates
- Use `documentFragment` for large lists

### 5. **Styling**
- Use CSS variables for all colors
- Keep transitions consistent (0.2s)
- Follow spacing system (multiples of 4px)

---

## 🚀 QUICK START CHECKLIST

1. ✅ Copy `manifest.json` template
2. ✅ Copy `sidepanel/index.html`
3. ✅ Copy complete `sidepanel/styles.css`
4. ✅ Copy `sidepanel/app.js` template
5. ✅ Copy `background.js` template
6. ✅ Copy `content.js` template (if needed)
7. ✅ Create `icons/` folder with icon files
8. ✅ Load extension in Chrome: `chrome://extensions/`
9. ✅ Enable "Developer mode"
10. ✅ Click "Load unpacked" and select your folder

---

## 📝 CUSTOMIZATION PROMPT FOR NEW PROJECTS

**Use this prompt to start a new project with this UI system:**

```
I want to build a Chrome extension with the following features:
[DESCRIBE YOUR FEATURES]

Please use the exact UI tech stack from my Flow AI Media Downloader:
- Vanilla HTML/CSS/JavaScript (NO frameworks)
- Chrome Side Panel UI
- Class-based state management with reactive rendering
- Premium dark theme with glassmorphism
- CSS variables: --bg: #0a0a0f, --surface: #12121a, --cyan: #00f2ff, --green: #00ff88, --red: #ff4466
- Font: Inter, 13px base size
- Border radius: 8px inputs, 12px sections
- Button colors: green (start), red (stop), cyan (primary), orange (warning)
- Activity log component with timestamp
- Progress bar component
- Message passing between sidepanel ↔ background ↔ content scripts
- Chrome storage for settings persistence

Structure:
- manifest.json (Manifest V3)
- background.js (service worker)
- content.js (page interaction)
- sidepanel/index.html (minimal shell)
- sidepanel/app.js (main class with render() and attach())
- sidepanel/styles.css (complete design system)

The UI should be immediately functional without any setup or configuration. Focus on feature implementation, not UI design.
```

---

## 🎨 COLOR SCHEME VARIANTS

### Alternative 1: Blue/Purple Theme
```css
--bg: #0d0d18;
--surface: #151525;
--border: #252538;
--primary: #6366f1;    /* Indigo */
--accent: #a855f7;     /* Purple */
--success: #10b981;    /* Emerald */
--danger: #ef4444;     /* Red */
```

### Alternative 2: Warm/Orange Theme
```css
--bg: #1a1410;
--surface: #221a15;
--border: #332820;
--primary: #f59e0b;    /* Amber */
--accent: #fb923c;     /* Orange */
--success: #22c55e;    /* Green */
--danger: #dc2626;     /* Red */
```

---

## 📚 REFERENCE EXAMPLES

### Example: File Upload Button
```javascript
loadFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = ev => {
                this.data = ev.target.result;
                this.addLog(`📁 Loaded ${file.name}`);
                this.render();
            };
            reader.readAsText(file);
        }
    };
    input.click();
}
```

### Example: Countdown Timer
```javascript
async countdown(seconds) {
    for (let i = seconds; i > 0; i--) {
        this.updateStatus(`⏳ ${i}s`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    this.updateStatus('Ready');
}
```

### Example: Voice Notifications
```javascript
speak(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
}
```

---

## ⚡ PERFORMANCE TIPS

1. **Limit DOM Updates**: Batch updates, render once
2. **Use DocumentFragment**: For inserting multiple elements
3. **Debounce Inputs**: Wait for user to finish typing
4. **Cache Selectors**: Store DOM references in variables
5. **Lazy Load**: Load data only when needed
6. **Limit Logs**: Keep max 100 entries in memory

---

## 🔐 SECURITY NOTES

1. **Content Security Policy**: Manifest V3 enforces strict CSP
2. **No Inline Scripts**: All JS must be in external files
3. **No eval()**: Never use eval() or new Function()
4. **Sanitize Inputs**: Always validate user input
5. **HTTPS Only**: Only make requests to HTTPS URLs

---

**Last Updated**: January 2026  
**Version**: 5.0 TURBO  
**Compatibility**: Chrome 88+, Manifest V3
