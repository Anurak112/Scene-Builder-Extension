# 🚀 NEW PROJECT PROMPT - Copy & Paste This

Use this exact prompt when starting a new Chrome extension project to get the same UI system:

---

## THE PROMPT

```
I want to build a Chrome extension with the following features:

[DESCRIBE YOUR FEATURES HERE - e.g., "Auto-save form data", "Screenshot tool", "YouTube downloader"]

CRITICAL: Use the EXACT UI tech stack and design system described below. Do NOT deviate.

## TECH STACK (NON-NEGOTIABLE)
- **NO frameworks**: Vanilla HTML/CSS/JavaScript only
- **NO libraries**: No React, Vue, Tailwind, Bootstrap, jQuery, etc.
- **Architecture**: Class-based state management with reactive rendering
- **UI Type**: Chrome Side Panel (Manifest V3)
- **Rendering**: JavaScript template literals (string templates)

## FILE STRUCTURE
```
extension/
├── manifest.json              # Manifest V3
├── background.js              # Service worker
├── content.js                 # Content script (if needed)
├── icons/                     # 16x16, 48x48, 128x128
└── sidepanel/
    ├── index.html             # Minimal shell: <div id="root"></div>
    ├── app.js                 # Main class: constructor, init(), render(), attach()
    └── styles.css             # Complete design system below
```

## DESIGN SYSTEM (EXACT VALUES)

### CSS Variables
```css
:root {
    --bg: #0a0a0f;           /* Main background */
    --surface: #12121a;      /* Cards/sections */
    --border: #1f1f2e;       /* Borders */
    --cyan: #00f2ff;         /* Primary accent */
    --green: #00ff88;        /* Success/start */
    --red: #ff4466;          /* Error/stop */
    --orange: #ff9f43;       /* Warning/resume */
    --text: #e8e8e8;         /* Primary text */
    --muted: #666;           /* Secondary text */
    --glass: rgba(255, 255, 255, 0.03); /* Glassmorphism */
}
```

### Typography
- Font: `'Inter', -apple-system, sans-serif`
- Base size: `13px`
- Monospace: `'Monaco', 'Consolas', monospace` (for logs)
- Weights: 400 (normal), 500 (medium), 600 (semibold)

### Spacing
- Base unit: `4px`
- Container padding: `16px`
- Element gaps: `8px` - `12px`
- Section margin: `12px`

### Border Radius
- Small (mini buttons): `4px` - `6px`
- Medium (inputs, buttons): `8px`
- Large (sections): `12px`
- Circular: `50%`

### Visual Effects
- Glassmorphism: `background: rgba(255, 255, 255, 0.03)`
- Glow: `box-shadow: 0 0 20px rgba(color, 0.4)`
- Text glow: `text-shadow: 0 0 20px rgba(color, 0.3)`
- Transitions: `transition: all 0.2s`

## MANDATORY UI COMPONENTS

### 1. App Container
```css
.app {
    padding: 16px;
    max-width: 400px;
}
```

### 2. Header
```css
h1 {
    font-size: 18px;
    font-weight: 600;
    color: var(--cyan);
    text-align: center;
    margin-bottom: 16px;
    text-shadow: 0 0 20px rgba(0, 242, 255, 0.3);
}
```

### 3. Section
```css
.section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
}
```

### 4. Buttons
- Green button: Start/Primary action (`.btn.green`)
- Red button: Stop/Cancel (`.btn.red`)
- Cyan button: Info/Secondary (`.btn.cyan`)
- Orange button: Warning/Resume (`.btn.orange`)

All buttons:
- `padding: 12px`
- `border-radius: 8px`
- `font-weight: 600`
- `text-transform: uppercase`
- `font-size: 12px`
- Glow on hover

### 5. Form Elements
All inputs/selects:
- `background: var(--glass)`
- `border: 1px solid var(--border)`
- `border-radius: 8px`
- `padding: 10px 12px`
- Cyan glow on focus

### 6. Activity Log (REQUIRED)
Must include:
```javascript
// In app.js
this.activityLog = [
    { time: '--:--:--', message: 'Extension Ready v1.0' }
];

addLog(msg) {
    this.activityLog.push({
        time: new Date().toTimeString().split(' ')[0],
        message: msg
    });
    if (this.activityLog.length > 100) this.activityLog.shift();
    this.updateLogUI();
}
```

```css
/* In styles.css */
.log {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
}

.log-content {
    height: 150px;
    overflow-y: auto;
    padding: 8px;
    font-family: 'Monaco', 'Consolas', monospace;
    font-size: 11px;
}
```

### 7. Status Display
```javascript
// Centered status bar showing current state
.status {
    text-align: center;
    padding: 8px;
    background: var(--glass);
    border-radius: 6px;
    margin-bottom: 12px;
    color: var(--cyan);
    font-weight: 500;
}
```

### 8. Progress Bar (if needed)
```css
.progress-bar {
    height: 6px;
    background: var(--border);
    border-radius: 3px;
    margin: 12px 0 4px;
    overflow: hidden;
}

.progress-bar .fill {
    height: 100%;
    background: linear-gradient(90deg, var(--cyan), var(--green));
    transition: width 0.3s;
}
```

## APPLICATION STRUCTURE (app.js)

```javascript
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
        // Load settings
        const settings = await chrome.storage.local.get(['yourSettings']);
        // Initialize...
        
        this.render();
        this.listen();
    }

    addLog(msg) { /* ... */ }
    updateLogUI() { /* ... */ }
    updateStatus(s) { /* ... */ }
    
    listen() {
        // Chrome message listener
        chrome.runtime.onMessage.addListener(msg => {
            // Handle messages
        });
    }

    attach() {
        // Attach event listeners after render
        document.getElementById('btn')?.addEventListener('click', () => {
            // Handle click
        });
    }

    render() {
        const root = document.getElementById('root');
        root.innerHTML = `
            <div class="app">
                <h1>⚡ Extension Name</h1>
                <div class="status" id="status">${this.status}</div>
                
                <!-- Your UI here -->
                
                <!-- Activity Log -->
                <div class="log">
                    <div class="log-header">
                        <span>Activity</span>
                        <button id="clearLog">Clear</button>
                    </div>
                    <div id="logContent" class="log-content">
                        ${this.activityLog.map(e =>
                            `<div class="log-entry">
                                <span class="log-time">${e.time}</span>
                                <span class="log-msg">${e.message}</span>
                            </div>`
                        ).join('')}
                    </div>
                </div>
            </div>
        `;
        
        this.attach();
    }
}

document.addEventListener('DOMContentLoaded', () => new YourExtension());
```

## COMMUNICATION PATTERN

### Side Panel → Background
```javascript
chrome.runtime.sendMessage({
    type: 'ACTION_NAME',
    data: { /* your data */ }
}, response => {
    if (response?.success) {
        this.addLog('✓ Success');
    }
});
```

### Background → Side Panel
```javascript
chrome.runtime.sendMessage({
    type: 'UPDATE_LOG',
    log: { message: 'Event occurred' }
});
```

### Background → Content Script
```javascript
chrome.tabs.query({ active: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
        type: 'COMMAND',
        data: {}
    }, response => {
        console.log(response);
    });
});
```

## STORAGE PATTERN

```javascript
// Save
await chrome.storage.local.set({
    setting1: this.value1,
    setting2: this.value2
});

// Load
const settings = await chrome.storage.local.get(['setting1', 'setting2']);
this.value1 = settings.setting1 || 'default';
```

## CRITICAL RULES

1. **NO frameworks or libraries whatsoever**
2. **Use EXACT color values from CSS variables above**
3. **Always include Activity Log component**
4. **Always include Status display**
5. **Use class-based state management**
6. **Re-render on state changes: `this.render()`**
7. **Re-attach listeners in `attach()` after every render**
8. **Use template literals for HTML generation**
9. **Save important state to chrome.storage.local**
10. **Follow spacing/sizing system exactly**

## QUALITY CHECKLIST

Before delivering, ensure:
- ✅ Premium dark theme with glassmorphism
- ✅ Smooth transitions on all interactive elements
- ✅ Glow effects on buttons (hover) and header (always)
- ✅ Activity log with timestamps
- ✅ Status indicator
- ✅ Consistent spacing (multiples of 4px)
- ✅ Proper focus states (cyan glow)
- ✅ Custom scrollbar styling
- ✅ Monospace font for code/logs
- ✅ Message passing working between components

## DELIVERABLES

Provide complete, ready-to-use code for:
1. manifest.json
2. background.js
3. content.js (if needed)
4. sidepanel/index.html
5. sidepanel/app.js
6. sidepanel/styles.css

Make it immediately loadable in Chrome without any setup.

---

NOW BUILD: [YOUR FEATURE DESCRIPTION HERE]
```

---

## EXAMPLES OF FEATURES TO REQUEST

### Example 1: Form Autosave
```
NOW BUILD: A form autosave extension that automatically saves form inputs as the user types, with the ability to restore them later. Features: detect all forms on page, save to storage every 2 seconds, show list of saved forms in side panel, click to restore.
```

### Example 2: Screenshot Tool
```
NOW BUILD: A screenshot tool that captures visible page area, selected region, or full page. Features: three capture modes, instant preview in side panel, download with timestamp, history of last 10 screenshots.
```

### Example 3: Link Collector
```
NOW BUILD: A link collector that extracts all links from a page and categorizes them (internal, external, images, downloads). Features: scan page button, filter by type, export to CSV, duplicate detection.
```

### Example 4: Color Picker
```
NOW BUILD: An eyedropper color picker that detects colors from anywhere on the page. Features: click to pick, color history (last 20), format conversion (HEX, RGB, HSL), copy to clipboard.
```

---

## 💡 TIPS

1. **Be specific** with your feature requirements
2. **List all actions** you want the extension to perform
3. **Mention data** that needs to be stored
4. **Specify triggers** (button clicks, page load, etc.)
5. The AI will handle all UI/styling automatically

---

## 📋 BEFORE YOU START

1. ✅ Describe your features clearly
2. ✅ Copy the entire prompt above
3. ✅ Replace `[YOUR FEATURE DESCRIPTION HERE]` with your needs
4. ✅ Paste to Claude/ChatGPT
5. ✅ Get production-ready code immediately

---

**Template Version**: 5.0 TURBO  
**Last Updated**: January 2026  
**Works With**: Claude 3.5 Sonnet, GPT-4, and similar LLMs
