// Side Panel Application - TURBO Edition
// Optimized for 1000+ media generation

class FlowAIDownloader {
    constructor() {
        this.mode = 'batch';
        this.status = 'Ready';
        this.prompts = '';
        this.folderName = 'flow_media';
        this.automationSpeed = 'Turbo (2-5s)';
        this.operation = 'Generate + Download';
        this.repeatCount = 1;
        this.resolution = '1K';
        this.aiFilenames = false;
        this.apiKey = '';
        this.embedMetadata = true;
        this.enableVoiceNotifications = true;
        this.detectedMedia = [];
        this.selectedMedia = new Set();
        this.activityLog = [{ time: '--:--:--', message: 'TURBO v5.1 Ready - Enhanced Stability' }];
        this.activeBatch = null;
        this.progress = { current: 0, total: 0 };
        this.countdown = { remaining: 0, total: 0, currentNum: 0, totalNum: 0 };
        this.harvestModeRunning = false; // Harvest Mode state

        // Connection state
        this.isConnected = false;
        this.heartbeatInterval = null;

        // Templates and Styles
        this.templates = [];
        this.styles = [];
        this.selectedTemplate = '';
        this.selectedStyle = '';

        this.init();
    }

    async init() {
        const s = await chrome.storage.local.get(['apiKey', 'aiFilenames', 'folderName', 'embedMetadata', 'enableVoiceNotifications', 'promptTemplates', 'stylePresets']);
        this.apiKey = s.apiKey || '';
        this.aiFilenames = s.aiFilenames || false;
        this.embedMetadata = s.embedMetadata !== undefined ? s.embedMetadata : true;
        this.folderName = s.folderName || 'flow_media';
        this.enableVoiceNotifications = s.enableVoiceNotifications !== false;

        // Load templates and styles, initialize defaults if none exist
        this.templates = s.promptTemplates || this.initializeDefaultTemplates();
        this.styles = s.stylePresets || this.initializeDefaultStyles();

        // Save defaults if they were just initialized
        if (!s.promptTemplates) {
            await chrome.storage.local.set({ promptTemplates: this.templates });
        }
        if (!s.stylePresets) {
            await chrome.storage.local.set({ stylePresets: this.styles });
        }

        // Check for recoverable batch using StateManager
        if (typeof StateManager !== 'undefined') {
            const recoverableBatch = await StateManager.getRecoverableBatch();
            if (recoverableBatch) {
                this.activeBatch = recoverableBatch;
                if (recoverableBatch.wasInterrupted) {
                    this.addLog(`⚠️ Previous batch was interrupted at ${recoverableBatch.currentIndex + 1}/${recoverableBatch.prompts.length}`);
                    this.addLog(`💡 Click "Resume" to continue from where you left off`);
                } else if (recoverableBatch.isRunning) {
                    this.addLog(`⚡ Batch in progress: ${recoverableBatch.currentIndex + 1}/${recoverableBatch.prompts.length}`);
                } else {
                    this.addLog(`📋 Saved batch available: ${recoverableBatch.currentIndex + 1}/${recoverableBatch.prompts.length}`);
                }
            }
            // Cleanup old checkpoints
            StateManager.cleanupCheckpoints();
        }

        // Check initial connection
        await this.checkConnection();

        this.render();
        this.listen();

        // Start heartbeat for connection monitoring
        this.startHeartbeat();
    }


    addLog(msg) {
        this.activityLog.push({ time: new Date().toTimeString().split(' ')[0], message: msg });
        if (this.activityLog.length > 100) this.activityLog.shift(); // Memory limit
        this.updateLogUI();
    }

    updateLogUI() {
        const el = document.getElementById('logContent');
        if (el) {
            el.innerHTML = this.activityLog.map(e =>
                `<div class="log-entry"><span class="log-time">${e.time}</span><span class="log-msg">${e.message}</span></div>`
            ).join('');
            el.scrollTop = el.scrollHeight;
        }
    }

    updateStatus(s) {
        this.status = s;
        const el = document.getElementById('status');
        if (el) el.textContent = s;
    }

    updateProgress(current, total) {
        this.progress = { current, total };
        const bar = document.getElementById('progressBar');
        const txt = document.getElementById('progressText');
        if (bar && total > 0) {
            bar.style.width = `${(current / total) * 100}%`;
        }
        if (txt) {
            txt.textContent = total > 0 ? `${current}/${total}` : '';
        }
    }

    updateCountdown(remaining, total, currentNum, totalNum) {
        this.countdown = { remaining, total, currentNum, totalNum };
        const countdownEl = document.getElementById('countdownDisplay');
        if (countdownEl) {
            const percentage = Math.round((remaining / total) * 100);
            countdownEl.innerHTML = `
                <span class="countdown-icon">⏳</span>
                <span class="countdown-text">${remaining}s</span>
                <div class="countdown-bar">
                    <div class="countdown-fill" style="width: ${percentage}%"></div>
                </div>
            `;
        }
    }

    clearCountdown() {
        this.countdown = { remaining: 0, total: 0, currentNum: 0, totalNum: 0 };
        const countdownEl = document.getElementById('countdownDisplay');
        if (countdownEl) {
            countdownEl.innerHTML = '';
        }
    }

    async saveBatchState(index, running = true) {
        const prompts = this.prompts.split('\n').filter(p => p.trim());
        this.activeBatch = {
            prompts,
            currentIndex: index,
            isRunning: running,
            wasInterrupted: false,
            config: {
                folderName: this.folderName,
                automationSpeed: this.automationSpeed,
                operation: this.operation,
                repeatCount: this.repeatCount,
                resolution: this.resolution,
                aiFilenames: this.aiFilenames,
                apiKey: this.apiKey,
                embedMetadata: this.embedMetadata,
                enableVoiceNotifications: this.enableVoiceNotifications
            }
        };

        // Use StateManager if available
        if (typeof StateManager !== 'undefined') {
            await StateManager.saveBatchProgress(this.activeBatch);
        } else {
            await chrome.storage.local.set({ activeBatch: this.activeBatch });
        }
    }

    startBatch() {
        if (!this.prompts.trim()) {
            this.addLog('❌ No prompts');
            return;
        }

        const lines = this.prompts.split('\n').filter(p => p.trim());
        const total = lines.length * this.repeatCount;

        this.updateStatus('Running...');
        this.updateProgress(0, total);
        this.addLog(`🚀 Starting ${total} items | ${this.automationSpeed}`);
        this.saveBatchState(0, true);

        chrome.runtime.sendMessage({
            type: 'START_BATCH',
            data: {
                prompts: this.prompts,
                startIndex: 0,
                folderName: this.folderName,
                automationSpeed: this.automationSpeed,
                operation: this.operation,
                repeatCount: this.repeatCount,
                resolution: this.resolution,
                aiFilenames: this.aiFilenames,
                apiKey: this.apiKey,
                embedMetadata: this.embedMetadata,
                enableVoiceNotifications: this.enableVoiceNotifications
            }
        });
    }

    resumeBatch() {
        if (!this.activeBatch) return;
        this.updateStatus('Resuming...');
        this.addLog(`⚡ Resume from #${this.activeBatch.currentIndex + 1}`);

        chrome.runtime.sendMessage({
            type: 'START_BATCH',
            data: { ...this.activeBatch.config, prompts: this.activeBatch.prompts.join('\n'), startIndex: this.activeBatch.currentIndex }
        });
    }

    stopBatch() {
        this.updateStatus('Stopped');
        this.addLog('🛑 Stopped');
        if (this.activeBatch) {
            this.activeBatch.isRunning = false;
            this.activeBatch.wasInterrupted = true;
            // Use StateManager if available
            if (typeof StateManager !== 'undefined') {
                StateManager.saveBatchProgress(this.activeBatch);
            } else {
                chrome.storage.local.set({ activeBatch: this.activeBatch });
            }
        }
        chrome.runtime.sendMessage({ type: 'STOP_BATCH' });
        this.updateProgress(0, 0);
        this.clearCountdown();
        setTimeout(() => this.updateStatus('Ready'), 1500);
        this.render(); // Re-render to show Resume button
    }

    detectMedia() {
        this.addLog('🔍 Scanning...');
        chrome.runtime.sendMessage({ type: 'DETECT_MEDIA' }, res => {
            if (res?.success) {
                this.detectedMedia = res.media || [];
                this.selectedMedia.clear();
                this.addLog(`Found ${this.detectedMedia.length} items`);
                this.render();
            }
        });
    }

    downloadSelected() {
        if (this.selectedMedia.size === 0) return;
        this.addLog(`⬇ Downloading ${this.selectedMedia.size} at ${this.resolution}...`);

        Array.from(this.selectedMedia).forEach(i => {
            const m = this.detectedMedia[i];
            // Use resolution-aware download via content script
            chrome.runtime.sendMessage({
                type: 'DOWNLOAD_WITH_RESOLUTION',
                data: {
                    url: m.url,
                    resolution: this.resolution,
                    index: m.index,
                    folderName: this.folderName
                }
            });
        });
    }

    listen() {
        chrome.runtime.onMessage.addListener(msg => {
            if (msg.type === 'UPDATE_LOG') this.addLog(msg.log.message);
            else if (msg.type === 'BATCH_PROGRESS') {
                this.updateProgress(msg.current, msg.total);
                // Clear countdown when moving to next item
                this.clearCountdown();
            }
            else if (msg.type === 'COUNTDOWN_UPDATE') {
                this.updateCountdown(msg.remaining, msg.total, msg.currentNum, msg.totalNum);
            }
            else if (msg.type === 'BATCH_COMPLETED') {
                this.activeBatch = null;
                // Use StateManager if available
                if (typeof StateManager !== 'undefined') {
                    StateManager.clearBatch();
                    StateManager.updateStats({ operations: 1, downloads: msg.downloaded || 0 });
                } else {
                    chrome.storage.local.remove('activeBatch');
                }
                this.updateStatus('Done ✓');
                this.updateProgress(0, 0);
                this.clearCountdown();
                setTimeout(() => this.updateStatus('Ready'), 3000);
                this.render();
            }
            // Harvest Mode listeners
            else if (msg.type === 'HARVEST_PROGRESS') {
                this.updateProgress(msg.current, msg.total);
            }
            else if (msg.type === 'HARVEST_COMPLETED') {
                this.harvestModeRunning = false;
                this.updateStatus('Harvest Done ✓');
                this.updateProgress(0, 0);
                this.clearCountdown();
                setTimeout(() => this.updateStatus('Ready'), 3000);
                this.render();
            }
        });
    }

    // ==================== HARVEST MODE ====================
    startHarvestMode() {
        this.harvestModeRunning = true;
        this.updateStatus('Harvesting...');
        this.addLog('🌾 Starting Harvest Mode');

        chrome.runtime.sendMessage({
            type: 'START_HARVEST_MODE',
            data: {
                folderName: this.folderName,
                automationSpeed: this.automationSpeed,
                enableVoiceNotifications: this.enableVoiceNotifications
            }
        });

        this.render();
    }

    stopHarvestMode() {
        this.harvestModeRunning = false;
        this.updateStatus('Stopped');
        this.addLog('🛑 Harvest Mode stopped');
        chrome.runtime.sendMessage({ type: 'STOP_HARVEST_MODE' });
        this.updateProgress(0, 0);
        this.clearCountdown();
        setTimeout(() => this.updateStatus('Ready'), 1500);
        this.render();
    }

    // ==================== CONNECTION HEALTH ====================

    async checkConnection() {
        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: 'HEARTBEAT' }, (resp) => {
                    if (chrome.runtime.lastError) {
                        resolve({ alive: false });
                    } else {
                        resolve(resp || { alive: false });
                    }
                });
            });
            this.isConnected = response?.alive === true;
            this.updateConnectionUI();
            return this.isConnected;
        } catch {
            this.isConnected = false;
            this.updateConnectionUI();
            return false;
        }
    }

    updateConnectionUI() {
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
            statusEl.className = `connection-status ${this.isConnected ? 'connected' : 'disconnected'}`;
            statusEl.innerHTML = `
                <span class="status-dot"></span>
                <span class="status-text">${this.isConnected ? 'Connected' : 'Disconnected'}</span>
            `;
        }
    }

    startHeartbeat() {
        this.stopHeartbeat(); // Clear any existing
        this.heartbeatInterval = setInterval(async () => {
            // Only check during active operations
            if (this.status === 'Running...' || this.harvestModeRunning) {
                const wasConnected = this.isConnected;
                await this.checkConnection();

                if (wasConnected && !this.isConnected) {
                    this.addLog('⚠️ Connection lost, attempting recovery...');
                    await this.attemptRecovery();
                }
            } else {
                // Passive check
                await this.checkConnection();
            }
        }, 5000);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    async attemptRecovery() {
        try {
            // Try to find a valid Flow tab and re-inject content script
            const tabs = await chrome.tabs.query({ active: true });
            const validTab = tabs.find(t =>
                t.url && (
                    t.url.includes('flow.google.com') ||
                    t.url.includes('aistudio.google.com') ||
                    t.url.includes('labs.google')
                )
            );

            if (validTab) {
                await chrome.scripting.executeScript({
                    target: { tabId: validTab.id },
                    files: ['content.js']
                });
                this.addLog('✅ Recovery successful - content script re-injected');
                await this.checkConnection();
            } else {
                this.addLog('⚠️ No valid Flow tab found for recovery');
            }
        } catch (e) {
            this.addLog(`❌ Recovery failed: ${e.message}`);
            this.stopBatch();
        }
    }


    attach() {
        // Mode
        document.getElementById('manualMode')?.addEventListener('click', () => { this.mode = 'manual'; this.render(); });
        document.getElementById('batchMode')?.addEventListener('click', () => { this.mode = 'batch'; this.render(); });

        // Inputs
        document.getElementById('prompts')?.addEventListener('input', e => this.prompts = e.target.value);
        document.getElementById('folderName')?.addEventListener('input', e => { this.folderName = e.target.value; chrome.storage.local.set({ folderName: this.folderName }); });
        document.getElementById('automationSpeed')?.addEventListener('change', e => this.automationSpeed = e.target.value);
        document.getElementById('operation')?.addEventListener('change', e => this.operation = e.target.value);
        document.getElementById('repeatSlider')?.addEventListener('input', e => { this.repeatCount = +e.target.value; document.getElementById('repeatVal').textContent = this.repeatCount + 'x'; });
        document.getElementById('aiFilenames')?.addEventListener('change', e => { this.aiFilenames = e.target.checked; chrome.storage.local.set({ aiFilenames: this.aiFilenames }); this.render(); });
        document.getElementById('embedMetadata')?.addEventListener('change', e => { this.embedMetadata = e.target.checked; chrome.storage.local.set({ embedMetadata: this.embedMetadata }); });
        document.getElementById('apiKey')?.addEventListener('input', e => { this.apiKey = e.target.value; chrome.storage.local.set({ apiKey: this.apiKey }); });
        document.getElementById('voiceNotif')?.addEventListener('change', e => { this.enableVoiceNotifications = e.target.checked; chrome.storage.local.set({ enableVoiceNotifications: this.enableVoiceNotifications }); });

        // Templates and Styles
        document.getElementById('templateSelect')?.addEventListener('change', e => {
            if (e.target.value) this.loadTemplate(e.target.value);
            e.target.value = ''; // Reset dropdown
        });

        document.getElementById('saveTemplate')?.addEventListener('click', () => {
            if (!this.prompts.trim()) {
                this.addLog('❌ No prompts to save');
                return;
            }
            const name = prompt('Enter template name:');
            if (name?.trim()) this.saveAsTemplate(name.trim());
        });

        document.getElementById('applyStyle')?.addEventListener('click', () => {
            const select = document.getElementById('styleSelect');
            if (select?.value) {
                this.applyStyle(select.value);
                select.value = ''; // Reset dropdown
            }
        });

        // Resolution
        document.querySelectorAll('.res-btn').forEach(b => b.addEventListener('click', () => { this.resolution = b.dataset.res; this.render(); }));

        // Actions
        document.getElementById('startBatch')?.addEventListener('click', () => this.startBatch());
        document.getElementById('stopBatch')?.addEventListener('click', () => this.stopBatch());
        document.getElementById('resumeBatch')?.addEventListener('click', () => this.resumeBatch());
        document.getElementById('startHarvest')?.addEventListener('click', () => this.startHarvestMode());
        document.getElementById('stopHarvest')?.addEventListener('click', () => this.stopHarvestMode());
        document.getElementById('clearLog')?.addEventListener('click', () => { this.activityLog = []; this.updateLogUI(); });
        document.getElementById('loadFile')?.addEventListener('click', () => this.loadFile());

        // Manual
        document.getElementById('detectMedia')?.addEventListener('click', () => this.detectMedia());
        document.getElementById('selectAll')?.addEventListener('click', () => {
            if (this.selectedMedia.size === this.detectedMedia.length) this.selectedMedia.clear();
            else this.detectedMedia.forEach((_, i) => this.selectedMedia.add(i));
            this.render();
        });
        document.getElementById('downloadSel')?.addEventListener('click', () => this.downloadSelected());

        // Media grid
        document.querySelectorAll('.media-item').forEach(item => {
            item.addEventListener('click', () => {
                const i = +item.dataset.index;
                this.selectedMedia.has(i) ? this.selectedMedia.delete(i) : this.selectedMedia.add(i);
                this.render();
            });
        });
    }

    loadFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.csv';
        input.style.display = 'none';
        document.body.appendChild(input);

        input.onchange = e => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = ev => {
                    const content = ev.target.result;
                    try {
                        if (file.name.toLowerCase().endsWith('.csv')) {
                            this.prompts = this.parseCSV(content);
                        } else {
                            this.prompts = content;
                        }
                        this.render();
                        this.addLog(`📁 Loaded ${file.name}`);
                    } catch (err) {
                        this.addLog(`❌ Error loading file: ${err.message}`);
                    }
                };
                reader.onerror = () => this.addLog('❌ Error reading file');
                reader.readAsText(file);
            }
            document.body.removeChild(input);
        };

        input.click();
    }

    parseCSV(text) {
        if (!text.trim()) return '';

        // Detect delimiter: comma or semicolon
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        if (lines.length === 0) return '';

        const firstLine = lines[0];
        const commaCount = (firstLine.match(/,/g) || []).length;
        const semiCount = (firstLine.match(/;/g) || []).length;
        const delimiter = semiCount > commaCount ? ';' : ',';

        const parseRow = (row) => {
            const result = [];
            let cell = '';
            let inQuotes = false;
            for (let i = 0; i < row.length; i++) {
                const char = row[i];
                if (char === '"') {
                    if (inQuotes && row[i + 1] === '"') {
                        cell += '"'; // Escaped quote
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === delimiter && !inQuotes) {
                    result.push(cell.trim());
                    cell = '';
                } else {
                    cell += char;
                }
            }
            result.push(cell.trim());
            return result;
        };

        const headers = parseRow(lines[0]);
        const promptKeywords = ['prompt', 'text', 'content', 'message', 'description', 'visual', 'imagine'];
        const ignoreKeywords = ['scene', 'id', 'index', 'number', '#', 'count', 'time'];

        // 1. Try fuzzy match for prompt keywords (ignoring id-like columns)
        let promptIndex = headers.findIndex(h => {
            const low = h.toLowerCase();
            return promptKeywords.some(kw => low.includes(kw)) && !ignoreKeywords.some(kw => low === kw);
        });

        // 2. If no match, try to find the column with the longest average text length (ignoring headers)
        if (promptIndex === -1 && lines.length > 1) {
            const sampleRows = lines.slice(1, 6).map(l => parseRow(l));
            let maxAvgLen = -1;
            sampleRows[0]?.forEach((_, colIndex) => {
                // Skip if this column header is an "ignore" keyword
                if (ignoreKeywords.includes(headers[colIndex]?.toLowerCase())) return;

                const avgLen = sampleRows.reduce((sum, row) => sum + (row[colIndex]?.length || 0), 0) / sampleRows.length;
                if (avgLen > maxAvgLen) {
                    maxAvgLen = avgLen;
                    promptIndex = colIndex;
                }
            });
        }

        // 3. Last fallback: first column
        if (promptIndex === -1) promptIndex = 0;

        // Header detection: if the first row contains any typical keywords, skip it
        const hasHeaders = headers.some(h => {
            const low = h.toLowerCase();
            return promptKeywords.some(kw => low.includes(kw)) || ignoreKeywords.includes(low);
        });
        const startLine = (hasHeaders && lines.length > 1) ? 1 : 0;

        const prompts = [];
        for (let i = startLine; i < lines.length; i++) {
            const columns = parseRow(lines[i]);
            if (columns[promptIndex]) {
                prompts.push(columns[promptIndex]);
            }
        }

        return prompts.join('\n');
    }

    // ==================== TEMPLATES AND STYLES ====================

    initializeDefaultTemplates() {
        return [
            { id: 'tpl_portrait', name: 'Portrait Photography', content: 'Professional portrait, shallow depth of field, soft lighting, bokeh background' },
            { id: 'tpl_landscape', name: 'Landscape Scene', content: 'Breathtaking landscape, golden hour, dramatic sky, nature photography' },
            { id: 'tpl_product', name: 'Product Shot', content: 'Professional product photography, clean background, studio lighting, commercial grade' },
            { id: 'tpl_abstract', name: 'Abstract Art', content: 'Abstract composition, vibrant colors, modern art style, creative concept' },
            { id: 'tpl_character', name: 'Character Design', content: 'Character concept art, detailed design, fantasy style, professional illustration' },
            { id: 'tpl_architecture', name: 'Architecture', content: 'Architectural photography, modern design, symmetrical composition, professional' }
        ];
    }

    initializeDefaultStyles() {
        return [
            { id: 'style_cinematic', name: 'Cinematic', modifiers: 'cinematic lighting, highly detailed, dramatic atmosphere, 8k resolution, movie quality' },
            { id: 'style_photorealistic', name: 'Photorealistic', modifiers: 'photorealistic, ultra detailed, professional photography, sharp focus, natural lighting' },
            { id: 'style_anime', name: 'Anime Style', modifiers: 'anime style, cel shaded, vibrant colors, clean lines, detailed illustration' },
            { id: 'style_fantasy', name: 'Fantasy Art', modifiers: 'fantasy art, magical atmosphere, ethereal lighting, mystical, detailed illustration' },
            { id: 'style_cyberpunk', name: 'Cyberpunk', modifiers: 'cyberpunk aesthetic, neon lights, futuristic, high tech, dark atmosphere' },
            { id: 'style_vintage', name: 'Vintage', modifiers: 'vintage style, film grain, retro aesthetic, nostalgic atmosphere, classic' },
            { id: 'style_minimalist', name: 'Minimalist', modifiers: 'minimalist, clean composition, simple, elegant, modern aesthetic' },
            { id: 'style_watercolor', name: 'Watercolor', modifiers: 'watercolor painting style, soft edges, artistic, hand painted, traditional media' }
        ];
    }

    async saveAsTemplate(name) {
        const template = {
            id: 'tpl_' + Date.now(),
            name: name,
            content: this.prompts.trim(),
            created: Date.now()
        };
        this.templates.push(template);
        await chrome.storage.local.set({ promptTemplates: this.templates });
        this.addLog(`💾 Template saved: ${name}`);
        this.render();
    }

    loadTemplate(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (template) {
            this.prompts = template.content;
            this.addLog(`📋 Loaded template: ${template.name}`);
            this.render();
        }
    }

    applyStyle(styleId) {
        const style = this.styles.find(s => s.id === styleId);
        if (!style) return;

        const lines = this.prompts.split('\n').map(line => {
            const trimmed = line.trim();
            return trimmed ? `${trimmed}, ${style.modifiers}` : line;
        });

        this.prompts = lines.join('\n');
        this.addLog(`🎨 Applied style: ${style.name}`);
        this.render();
    }

    render() {
        const root = document.getElementById('root');

        const mediaGrid = this.detectedMedia.length > 0 ? `
            <div class="media-grid">${this.detectedMedia.map((m, i) => `
                <div class="media-item ${this.selectedMedia.has(i) ? 'sel' : ''}" data-index="${i}">
                    <img src="${m.url}" alt=""><div class="chk"></div>
                </div>`).join('')}
            </div>` : '';

        const manual = this.mode === 'manual' ? `
            <div class="section">
                <div class="row">
                    <label>Folder</label>
                    <input type="text" id="folderName" value="${this.folderName}">
                </div>
                <div class="row">
                    <label>Resolution</label>
                    <div class="res-group">
                        <button class="res-btn ${this.resolution === '1K' ? 'active' : ''}" data-res="1K">1K</button>
                        <button class="res-btn ${this.resolution === '2K' ? 'active' : ''}" data-res="2K">2K</button>
                        <button class="res-btn ${this.resolution === '4K' ? 'active' : ''}" data-res="4K">4K</button>
                    </div>
                </div>
                <div class="btn-row">
                    <button id="detectMedia" class="btn cyan">🔍 Detect</button>
                    <button id="selectAll" class="btn">${this.selectedMedia.size === this.detectedMedia.length && this.detectedMedia.length > 0 ? 'Deselect' : 'Select All'}</button>
                </div>
                ${mediaGrid}
                <button id="downloadSel" class="btn cyan full">⬇ Download${this.selectedMedia.size ? ` (${this.selectedMedia.size})` : ''}</button>
            </div>` : '';


        const batch = this.mode === 'batch' ? `
            <div class="section">
                <div class="prompt-header">
                    <label>Prompts</label>
                    <button id="loadFile" class="mini-btn">📁</button>
                </div>
                <textarea id="prompts" rows="4" placeholder="One prompt per line...">${this.prompts}</textarea>

                <div class="row template-row">
                    <label>Template</label>
                    <select id="templateSelect">
                        <option value="">-- Load Template --</option>
                        ${this.templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                    </select>
                    <button id="saveTemplate" class="mini-btn" title="Save as Template">💾</button>
                </div>

                <div class="row style-row">
                    <label>Style</label>
                    <select id="styleSelect">
                        <option value="">-- Add Style --</option>
                        ${this.styles.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                    </select>
                    <button id="applyStyle" class="mini-btn cyan" title="Apply Style">+ Add</button>
                </div>

                <div class="row">
                    <label>Folder</label>
                    <input type="text" id="folderName" value="${this.folderName}">
                </div>

                <div class="row">
                    <label>Speed</label>
                    <select id="automationSpeed">
                        <option ${this.automationSpeed.includes('Turbo') ? 'selected' : ''}>Turbo (2-5s)</option>
                        <option ${this.automationSpeed.includes('Fast') ? 'selected' : ''}>Fast (7-20s)</option>
                        <option ${this.automationSpeed.includes('Normal') ? 'selected' : ''}>Normal (10-59s)</option>
                        <option ${this.automationSpeed.includes('Slow') ? 'selected' : ''}>Slow (30-90s)</option>
                    </select>
                </div>

                <div class="row">
                    <label>Operation</label>
                    <select id="operation">
                        <option ${this.operation.includes('Generate + Download') ? 'selected' : ''}>Generate + Download</option>
                        <option ${this.operation === 'Generate Only' ? 'selected' : ''}>Generate Only</option>
                        <option ${this.operation === 'Download Only' ? 'selected' : ''}>Download Only (Harvest)</option>
                    </select>
                </div>

                <div class="slider-row">
                    <label>Repeat</label>
                    <input type="range" id="repeatSlider" min="1" max="20" value="${this.repeatCount}">
                    <span id="repeatVal">${this.repeatCount}x</span>
                </div>

                <div class="row">
                    <label>Resolution</label>
                    <div class="res-group">
                        <button class="res-btn ${this.resolution === '1K' ? 'active' : ''}" data-res="1K">1K</button>
                        <button class="res-btn ${this.resolution === '2K' ? 'active' : ''}" data-res="2K">2K</button>
                        <button class="res-btn ${this.resolution === '4K' ? 'active' : ''}" data-res="4K">4K</button>
                    </div>
                </div>

                <div class="toggle-row">
                    <label>AI Filenames</label>
                    <input type="checkbox" id="aiFilenames" ${this.aiFilenames ? 'checked' : ''}>
                </div>
                ${this.aiFilenames ? `<input type="password" id="apiKey" placeholder="GLM API Key" value="${this.apiKey}">` : ''}

                <div class="toggle-row">
                    <label>Embed Metadata</label>
                    <input type="checkbox" id="embedMetadata" ${this.embedMetadata ? 'checked' : ''}>
                </div>

                <div class="toggle-row">
                    <label>🔊 Voice</label>
                    <input type="checkbox" id="voiceNotif" ${this.enableVoiceNotifications ? 'checked' : ''}>
                </div>

                <div class="progress-bar"><div id="progressBar" class="fill"></div></div>
                <div id="progressText" class="progress-text">${this.progress.total > 0 ? this.progress.current + '/' + this.progress.total : ''}</div>

                <div id="countdownDisplay" class="countdown-display"></div>

                <div class="btn-row">
                    <button id="startBatch" class="btn green">▶ Start</button>
                    <button id="stopBatch" class="btn red">■ Stop</button>
                </div>
                <div class="btn-row">
                    ${this.harvestModeRunning
                ? `<button id="stopHarvest" class="btn red full">■ Stop Harvest</button>`
                : `<button id="startHarvest" class="btn orange full">🌾 Harvest Videos (1080p)</button>`
            }
                </div>
                ${this.activeBatch && !this.activeBatch.isRunning ? `<button id="resumeBatch" class="btn orange full">⚡ Resume (${this.activeBatch.currentIndex + 1}/${this.activeBatch.prompts.length})</button>` : ''}
            </div>` : '';

        root.innerHTML = `
            <div class="app">
                <div class="header-row">
                    <h1>⚡ Flow AI TURBO</h1>
                    <div id="connectionStatus" class="connection-status ${this.isConnected ? 'connected' : 'disconnected'}">
                        <span class="status-dot"></span>
                        <span class="status-text">${this.isConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                </div>
                <div class="mode-switch">
                    <button id="manualMode" class="${this.mode === 'manual' ? 'active' : ''}">Manual</button>
                    <button id="batchMode" class="${this.mode === 'batch' ? 'active' : ''}">Batch</button>
                </div>
                <div class="status" id="status">${this.status}</div>
                ${manual}${batch}
                <div class="log">
                    <div class="log-header"><span>Activity</span><button id="clearLog">Clear</button></div>
                    <div id="logContent" class="log-content">${this.activityLog.map(e => `<div class="log-entry"><span class="log-time">${e.time}</span><span class="log-msg">${e.message}</span></div>`).join('')}</div>
                </div>
            </div>`;


        this.attach();
    }
}

document.addEventListener('DOMContentLoaded', () => new FlowAIDownloader());
