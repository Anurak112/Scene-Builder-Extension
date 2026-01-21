# 🎨 UI COMPONENT REFERENCE GUIDE
## Copy-Paste Component Library

All components below are pre-styled and ready to use with the Flow AI design system.

---

## 📐 LAYOUT COMPONENTS

### App Container
```javascript
`<div class="app">
    <!-- All your content goes here -->
</div>`
```
- Max width: 400px
- Padding: 16px
- Centers content

---

### Section Card
```javascript
`<div class="section">
    <!-- Section content -->
</div>`
```
- Dark surface background
- Rounded corners (12px)
- Padding: 16px
- Bottom margin: 12px

---

### Row Layout
```javascript
`<div class="row">
    <label>Label Text</label>
    <input type="text" value="${this.value}">
</div>`
```
- Label: 70px fixed width
- Input: Flexible (fills remaining space)
- Gap: 10px
- Bottom margin: 10px

---

## 🔤 TEXT COMPONENTS

### Main Header
```javascript
`<h1>⚡ Your Extension Name</h1>`
```
- Size: 18px
- Color: Cyan with glow
- Center aligned
- Use emoji for personality

---

### Status Bar
```javascript
`<div class="status" id="status">${this.status}</div>`
```

Update method:
```javascript
updateStatus(s) {
    this.status = s;
    const el = document.getElementById('status');
    if (el) el.textContent = s;
}
```

Examples:
- `this.updateStatus('Ready')`
- `this.updateStatus('Processing...')`
- `this.updateStatus('⏳ Waiting 5s')`
- `this.updateStatus('✓ Complete')`

---

## 🔘 BUTTON COMPONENTS

### Primary Action Buttons
```javascript
`<div class="btn-row">
    <button id="startBtn" class="btn green">▶ Start</button>
    <button id="stopBtn" class="btn red">■ Stop</button>
</div>`
```

Event listeners:
```javascript
document.getElementById('startBtn')?.addEventListener('click', () => {
    this.start();
});
document.getElementById('stopBtn')?.addEventListener('click', () => {
    this.stop();
});
```

### Button Colors
- **Green** (`.btn.green`): Start, Confirm, Success
- **Red** (`.btn.red`): Stop, Cancel, Delete
- **Cyan** (`.btn.cyan`): Info, Primary, Default
- **Orange** (`.btn.orange`): Warning, Resume, Retry

### Full Width Button
```javascript
`<button id="actionBtn" class="btn cyan full">Action</button>`
```

### Mini Button
```javascript
`<button id="miniBtn" class="mini-btn">📁</button>`
```
- Use for icon buttons
- Smaller padding (4px 8px)
- Often paired with inputs/selects

---

## 📝 FORM COMPONENTS

### Text Input
```javascript
`<div class="row">
    <label>Name</label>
    <input type="text" id="nameInput" value="${this.name}" placeholder="Enter name">
</div>`
```

Event:
```javascript
document.getElementById('nameInput')?.addEventListener('input', e => {
    this.name = e.target.value;
    // Save to storage immediately
    chrome.storage.local.set({ name: this.name });
});
```

---

### Password Input
```javascript
`<input type="password" id="apiKey" placeholder="API Key" value="${this.apiKey}">`
```

---

### Textarea
```javascript
`<textarea id="prompts" rows="4" placeholder="Enter text...">${this.text}</textarea>`
```

Event:
```javascript
document.getElementById('prompts')?.addEventListener('input', e => {
    this.text = e.target.value;
});
```

---

### Select Dropdown
```javascript
`<div class="row">
    <label>Mode</label>
    <select id="modeSelect">
        <option ${this.mode === 'fast' ? 'selected' : ''}>Fast</option>
        <option ${this.mode === 'normal' ? 'selected' : ''}>Normal</option>
        <option ${this.mode === 'slow' ? 'selected' : ''}>Slow</option>
    </select>
</div>`
```

Event:
```javascript
document.getElementById('modeSelect')?.addEventListener('change', e => {
    this.mode = e.target.value;
});
```

Dynamic options from array:
```javascript
`<select id="templateSelect">
    <option value="">-- Select Template --</option>
    ${this.templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
</select>`
```

---

### Checkbox / Toggle
```javascript
`<div class="toggle-row">
    <label>Enable Feature</label>
    <input type="checkbox" id="featureToggle" ${this.enabled ? 'checked' : ''}>
</div>`
```

Event:
```javascript
document.getElementById('featureToggle')?.addEventListener('change', e => {
    this.enabled = e.target.checked;
    chrome.storage.local.set({ enabled: this.enabled });
    this.render(); // Re-render if needed
});
```

---

### Range Slider
```javascript
`<div class="slider-row">
    <label>Count</label>
    <input type="range" id="countSlider" min="1" max="100" value="${this.count}">
    <span id="countVal">${this.count}</span>
</div>`
```

Event:
```javascript
document.getElementById('countSlider')?.addEventListener('input', e => {
    this.count = +e.target.value;
    document.getElementById('countVal').textContent = this.count;
});
```

---

### Resolution Buttons (Radio Button Group)
```javascript
`<div class="row">
    <label>Quality</label>
    <div class="res-group">
        <button class="res-btn ${this.resolution === '1K' ? 'active' : ''}" data-res="1K">1K</button>
        <button class="res-btn ${this.resolution === '2K' ? 'active' : ''}" data-res="2K">2K</button>
        <button class="res-btn ${this.resolution === '4K' ? 'active' : ''}" data-res="4K">4K</button>
    </div>
</div>`
```

CSS for `.res-group` and `.res-btn`:
```css
.res-group {
    display: flex;
    gap: 6px;
}

.res-btn {
    padding: 6px 14px;
    background: var(--glass);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--muted);
    cursor: pointer;
    transition: all 0.2s;
}

.res-btn.active {
    background: var(--cyan);
    color: #000;
    border-color: var(--cyan);
}
```

Event:
```javascript
document.querySelectorAll('.res-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        this.resolution = btn.dataset.res;
        this.render();
    });
});
```

---

## 🔀 MODE SWITCH (TABS)

```javascript
`<div class="mode-switch">
    <button id="manualMode" class="${this.mode === 'manual' ? 'active' : ''}">Manual</button>
    <button id="batchMode" class="${this.mode === 'batch' ? 'active' : ''}">Batch</button>
</div>`
```

Event:
```javascript
document.getElementById('manualMode')?.addEventListener('click', () => {
    this.mode = 'manual';
    this.render();
});
document.getElementById('batchMode')?.addEventListener('click', () => {
    this.mode = 'batch';
    this.render();
});
```

Conditional rendering based on mode:
```javascript
render() {
    const manualContent = this.mode === 'manual' ? `
        <div class="section">
            <!-- Manual mode UI -->
        </div>
    ` : '';

    const batchContent = this.mode === 'batch' ? `
        <div class="section">
            <!-- Batch mode UI -->
        </div>
    ` : '';

    root.innerHTML = `
        <div class="app">
            <div class="mode-switch">...</div>
            ${manualContent}
            ${batchContent}
        </div>
    `;
}
```

---

## 📊 PROGRESS COMPONENTS

### Progress Bar
```javascript
`<div class="progress-bar">
    <div id="progressFill" class="fill"></div>
</div>
<div id="progressText" class="progress-text">${this.current}/${this.total}</div>`
```

Update method:
```javascript
updateProgress(current, total) {
    this.current = current;
    this.total = total;
    
    const bar = document.getElementById('progressFill');
    const txt = document.getElementById('progressText');
    
    if (bar && total > 0) {
        bar.style.width = `${(current / total) * 100}%`;
    }
    if (txt) {
        txt.textContent = total > 0 ? `${current}/${total}` : '';
    }
}
```

Usage:
```javascript
this.updateProgress(5, 10);  // 50%
this.updateProgress(0, 0);   // Hide
```

---

### Countdown Display
```javascript
`<div id="countdownDisplay" class="countdown-display"></div>`
```

Update method:
```javascript
updateCountdown(remaining, total) {
    const el = document.getElementById('countdownDisplay');
    if (el && remaining > 0) {
        const percentage = Math.round((remaining / total) * 100);
        el.innerHTML = `
            <span class="countdown-icon">⏳</span>
            <span class="countdown-text">${remaining}s</span>
            <div class="countdown-bar">
                <div class="countdown-fill" style="width: ${percentage}%"></div>
            </div>
        `;
    } else if (el) {
        el.innerHTML = '';
    }
}
```

CSS:
```css
.countdown-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 8px;
    margin: 8px 0;
    background: var(--glass);
    border: 1px solid var(--border);
    border-radius: 8px;
}

.countdown-text {
    font-size: 14px;
    font-weight: 600;
    color: var(--cyan);
    min-width: 40px;
    text-align: center;
}

.countdown-bar {
    flex: 1;
    height: 6px;
    background: var(--border);
    border-radius: 3px;
    overflow: hidden;
    max-width: 150px;
}

.countdown-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--orange), var(--red));
    border-radius: 3px;
    transition: width 0.3s ease;
    animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
}
```

---

## 📜 ACTIVITY LOG

Full implementation:

### HTML
```javascript
`<div class="log">
    <div class="log-header">
        <span>Activity</span>
        <button id="clearLog">Clear</button>
    </div>
    <div id="logContent" class="log-content">
        ${this.activityLog.map(e => `
            <div class="log-entry">
                <span class="log-time">${e.time}</span>
                <span class="log-msg">${e.message}</span>
            </div>
        `).join('')}
    </div>
</div>`
```

### State and Methods
```javascript
class YourApp {
    constructor() {
        this.activityLog = [
            { time: '--:--:--', message: 'Extension Ready v1.0' }
        ];
    }

    addLog(msg) {
        this.activityLog.push({
            time: new Date().toTimeString().split(' ')[0],
            message: msg
        });
        
        // Memory limit
        if (this.activityLog.length > 100) {
            this.activityLog.shift();
        }
        
        this.updateLogUI();
    }

    updateLogUI() {
        const el = document.getElementById('logContent');
        if (el) {
            el.innerHTML = this.activityLog.map(e => `
                <div class="log-entry">
                    <span class="log-time">${e.time}</span>
                    <span class="log-msg">${e.message}</span>
                </div>
            `).join('');
            el.scrollTop = el.scrollHeight; // Auto-scroll to bottom
        }
    }

    attach() {
        document.getElementById('clearLog')?.addEventListener('click', () => {
            this.activityLog = [];
            this.updateLogUI();
        });
    }
}
```

### Usage Examples
```javascript
this.addLog('🚀 Starting process');
this.addLog('📝 Prompt injected');
this.addLog(`✅ Downloaded ${count} files`);
this.addLog('❌ Error: Connection failed');
this.addLog('⚠️ Warning: Slow response');
```

### CSS
```css
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
```

---

## 📁 FILE UPLOAD BUTTON

```javascript
loadFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.json';
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

HTML trigger:
```javascript
`<button id="loadFileBtn" class="mini-btn">📁</button>`
```

Event:
```javascript
document.getElementById('loadFileBtn')?.addEventListener('click', () => {
    this.loadFile();
});
```

---

## 🎨 TEMPLATE/STYLE PRESET SYSTEM

### Data Structure
```javascript
constructor() {
    this.templates = [
        { id: 'tpl_1', name: 'Portrait', content: 'Professional portrait...' },
        { id: 'tpl_2', name: 'Landscape', content: 'Breathtaking landscape...' }
    ];
    
    this.styles = [
        { id: 'style_1', name: 'Cinematic', modifiers: 'cinematic lighting, 8k...' },
        { id: 'style_2', name: 'Anime', modifiers: 'anime style, vibrant colors...' }
    ];
}
```

### Template Selector
```javascript
`<div class="row">
    <label>Template</label>
    <select id="templateSelect">
        <option value="">-- Load Template --</option>
        ${this.templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
    </select>
    <button id="saveTemplate" class="mini-btn" title="Save as Template">💾</button>
</div>`
```

### Events
```javascript
// Load template
document.getElementById('templateSelect')?.addEventListener('change', e => {
    if (e.target.value) {
        const template = this.templates.find(t => t.id === e.target.value);
        if (template) {
            this.prompts = template.content;
            this.addLog(`📋 Loaded: ${template.name}`);
            this.render();
        }
        e.target.value = ''; // Reset dropdown
    }
});

// Save template
document.getElementById('saveTemplate')?.addEventListener('click', () => {
    if (!this.prompts.trim()) {
        this.addLog('❌ No content to save');
        return;
    }
    const name = prompt('Enter template name:');
    if (name?.trim()) {
        this.saveAsTemplate(name.trim());
    }
});
```

### Methods
```javascript
async saveAsTemplate(name) {
    const template = {
        id: 'tpl_' + Date.now(),
        name: name,
        content: this.prompts.trim(),
        created: Date.now()
    };
    
    this.templates.push(template);
    await chrome.storage.local.set({ templates: this.templates });
    this.addLog(`💾 Template saved: ${name}`);
    this.render();
}

async deleteTemplate(id) {
    this.templates = this.templates.filter(t => t.id !== id);
    await chrome.storage.local.set({ templates: this.templates });
    this.addLog(`🗑️ Template deleted`);
    this.render();
}
```

---

## 🖼️ MEDIA GRID

### HTML
```javascript
`<div class="media-grid">
    ${this.media.map((m, i) => `
        <div class="media-item ${this.selectedMedia.has(i) ? 'sel' : ''}" data-index="${i}">
            <img src="${m.url}" alt="">
            <div class="chk"></div>
        </div>
    `).join('')}
</div>`
```

### State
```javascript
constructor() {
    this.media = [];
    this.selectedMedia = new Set();
}
```

### CSS
```css
.media-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 12px 0;
}

.media-item {
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid transparent;
    cursor: pointer;
    position: relative;
    transition: all 0.2s;
}

.media-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.media-item.sel {
    border-color: var(--cyan);
    box-shadow: 0 0 15px rgba(0, 242, 255, 0.3);
}

.media-item .chk {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 18px;
    height: 18px;
    border: 2px solid #fff;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.5);
}

.media-item.sel .chk {
    background: var(--cyan);
    border-color: var(--cyan);
}

.media-item.sel .chk::after {
    content: '✓';
    color: #000;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
}
```

### Events
```javascript
attach() {
    document.querySelectorAll('.media-item').forEach(item => {
        item.addEventListener('click', () => {
            const i = +item.dataset.index;
            if (this.selectedMedia.has(i)) {
                this.selectedMedia.delete(i);
            } else {
                this.selectedMedia.add(i);
            }
            this.render();
        });
    });
}
```

### Select All/None
```javascript
`<button id="selectAll" class="btn">
    ${this.selectedMedia.size === this.media.length && this.media.length > 0 ? 'Deselect All' : 'Select All'}
</button>`
```

Event:
```javascript
document.getElementById('selectAll')?.addEventListener('click', () => {
    if (this.selectedMedia.size === this.media.length) {
        this.selectedMedia.clear();
    } else {
        this.media.forEach((_, i) => this.selectedMedia.add(i));
    }
    this.render();
});
```

---

## 🔊 VOICE NOTIFICATIONS (BONUS)

```javascript
speak(text) {
    if (!this.enableVoiceNotifications) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
}
```

Usage:
```javascript
this.speak('Process completed');
this.speak(`Downloaded ${count} files`);
```

UI Toggle:
```javascript
`<div class="toggle-row">
    <label>🔊 Voice</label>
    <input type="checkbox" id="voiceToggle" ${this.enableVoiceNotifications ? 'checked' : ''}>
</div>`
```

---

## ⏱️ TIMER/COUNTDOWN

```javascript
async countdown(seconds, callback) {
    for (let i = seconds; i > 0 && this.running; i--) {
        this.updateCountdown(i, seconds);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (callback) callback();
}
```

Usage:
```javascript
await this.countdown(10, () => {
    this.addLog('Countdown complete!');
    this.nextAction();
});
```

---

## 🎯 COMPLETE EXAMPLE: SETTINGS SECTION

```javascript
`<div class="section">
    <h2>Settings</h2>
    
    <div class="row">
        <label>Folder</label>
        <input type="text" id="folderInput" value="${this.folderName}" placeholder="output">
    </div>
    
    <div class="row">
        <label>Mode</label>
        <select id="modeSelect">
            <option ${this.mode === 'fast' ? 'selected' : ''}>Fast</option>
            <option ${this.mode === 'normal' ? 'selected' : ''}>Normal</option>
        </select>
    </div>
    
    <div class="slider-row">
        <label>Quality</label>
        <input type="range" id="qualitySlider" min="1" max="10" value="${this.quality}">
        <span id="qualityVal">${this.quality}</span>
    </div>
    
    <div class="toggle-row">
        <label>Auto Save</label>
        <input type="checkbox" id="autoSaveToggle" ${this.autoSave ? 'checked' : ''}>
    </div>
    
    <button id="saveSettings" class="btn cyan full">💾 Save Settings</button>
</div>`
```

---

## 📦 READY-TO-USE PATTERNS

### Pattern: Confirm Before Action
```javascript
confirmAction(message, callback) {
    if (confirm(message)) {
        callback();
    }
}

// Usage
this.confirmAction('Delete all items?', () => {
    this.deleteAll();
});
```

### Pattern: Loading State
```javascript
async performAction() {
    this.updateStatus('Loading...');
    try {
        // ... async operation
        this.updateStatus('✓ Complete');
    } catch (error) {
        this.updateStatus('❌ Error');
        this.addLog(`Error: ${error.message}`);
    }
}
```

### Pattern: Batch Processing with Progress
```javascript
async processBatch(items) {
    for (let i = 0; i < items.length; i++) {
        this.updateProgress(i + 1, items.length);
        this.updateStatus(`Processing ${i + 1}/${items.length}`);
        await this.processItem(items[i]);
    }
    this.updateProgress(0, 0);
    this.updateStatus('Complete');
}
```

---

**Component Library Version**: 5.0 TURBO  
**Last Updated**: January 2026  
**Compatibility**: Chrome Extension Side Panel UI
