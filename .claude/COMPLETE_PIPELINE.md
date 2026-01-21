# Complete Scripts Pipeline - Flow AI Media Downloader

## Architecture Overview

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  Side Panel UI  │◄────►│  background.js   │◄────►│   content.js    │
│   (app.js)      │      │ (Service Worker) │      │ (Page Script)   │
└─────────────────┘      └──────────────────┘      └─────────────────┘
        │                        │                          │
        │                        │                          │
    User Input              Downloads API            Google Flow Page
                           Message Router              DOM Interaction
```

---

## Component Breakdown

### 1. **Side Panel UI** (`sidepanel/app.js`)
- **Role**: User interface and settings management
- **Runs in**: Extension side panel (isolated from page)
- **Can**: Send messages, store settings, update UI
- **Cannot**: Access page DOM, inject scripts

### 2. **Background Script** (`background.js`)
- **Role**: Message router and download handler
- **Runs in**: Service worker (persistent background)
- **Can**: Use chrome.downloads API, route messages, store data
- **Cannot**: Access page DOM directly

### 3. **Content Script** (`content.js`)
- **Role**: Page automation and media detection
- **Runs in**: Google Flow page context
- **Can**: Access page DOM, inject prompts, detect media
- **Cannot**: Use chrome.downloads API directly

---

## MANUAL MODE PIPELINE

### Execution Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: User Opens Side Panel                                      │
└─────────────────────────────────────────────────────────────────────┘
    ↓
    app.js: init()
        → Loads settings from chrome.storage
        → Renders UI
        → Sets up event listeners

┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: User Clicks "Detect Media"                                 │
└─────────────────────────────────────────────────────────────────────┘
    ↓
    app.js: detectMedia()
        → Line 190-200
        → chrome.runtime.sendMessage({ type: 'DETECT_MEDIA' })
    ↓
    background.js: Message Listener
        → Line 21-37
        → Receives DETECT_MEDIA
        → chrome.tabs.query({ active: true })
        → Forward to content script: SCAN_MEDIA
    ↓
    content.js: Message Listener
        → Line 224-226
        → Receives SCAN_MEDIA
        → Calls scanMedia()
    ↓
    content.js: scanMedia()
        → Line 464-487
        → document.querySelectorAll(SEL.media)
        → Filters by size (width > 100, height > 100)
        → Filters by isExcluded() (no icons, logos, SVGs)
        → Returns array of media objects:
            {
                type: 'image' | 'video',
                url: 'blob:...' | 'https://...',
                width: 1024,
                height: 1024,
                index: 0,
                extension: 'png' | 'mp4'
            }
    ↓
    background.js: Forward response back
        → sendResponse({ success: true, media: [...] })
    ↓
    app.js: Receives response
        → Updates UI with media grid
        → Shows thumbnails and resolution buttons

┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: User Selects Resolution and Clicks Download                │
└─────────────────────────────────────────────────────────────────────┘
    ↓
    app.js: downloadSelected()
        → Line 202-219
        → Gets selected media from UI
        → Gets selected resolution (1K/2K/4K)
        → chrome.runtime.sendMessage({
            type: 'DOWNLOAD_WITH_RESOLUTION',
            data: { url, resolution, index, folderName }
          })
    ↓
    background.js: Message Listener
        → Line 68-87
        → Receives DOWNLOAD_WITH_RESOLUTION
        → Forward to content script
    ↓
    content.js: Message Listener
        → Line 240-243
        → Receives DOWNLOAD_WITH_RESOLUTION
        → Calls downloadWithResolution(msg.data)
    ↓
    content.js: downloadWithResolution()
        → Line 568-615
        → STRATEGY 1: Try native UI download button
            → tryNativeDownload(index, resolution)
                → Line 619-736
                → Find media element by index
                → Find parent card/container
                → Simulate hover to reveal controls
                → Find download button
                → Click download button
                → Wait for resolution menu
                → Click resolution option (1K/2K/4K)
        → STRATEGY 2: URL modification
            → getResolutionUrl(url, resolution)
                → Line 760-781
                → Modify Google CDN URL parameters
                → =s1024 for 1K, =s2048 for 2K, =s4096 for 4K
        → Generate smart filename:
            → generateSmartFilename('manual_download', { ... })
        → Send to background:
            → chrome.runtime.sendMessage({
                type: 'DOWNLOAD_MEDIA',
                url: modifiedUrl,
                filename: 'manual_manual_download_2K_[timestamp].png',
                folderName: '...'
              })
    ↓
    background.js: Message Listener
        → Line 89-91
        → Receives DOWNLOAD_MEDIA
        → Calls handleDownload(message, sendResponse)
    ↓
    background.js: handleDownload()
        → Line 113-171
        → Check if AI filenames enabled
            → If yes: Call generateAIFilename(prompt, apiKey)
                → Line 243-277
                → Fetch to GLM 4.7 API
                → Get descriptive filename
        → Check if PNG and embedMetadata enabled
            → If yes:
                → Fetch media URL
                → Get ArrayBuffer
                → injectPNGMetadata(buffer, 'Prompt', prompt)
                    → Line 185-228
                    → Create tEXt chunk with prompt
                    → Insert after IHDR chunk
                    → Calculate CRC32
                → Convert to base64 data URL
        → chrome.downloads.download({
            url: dataUrl or original url,
            filename: 'folder/smart_filename.png',
            saveAs: false
          })
    ↓
    Browser Downloads File
        → Saved to Downloads/folder/filename.png

```

---

## BATCH MODE PIPELINE

### Execution Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: User Configures Batch Settings                             │
└─────────────────────────────────────────────────────────────────────┘
    ↓
    app.js: User inputs
        → Prompts (one per line)
        → Folder name
        → Resolution (1K/2K/4K)
        → Automation speed (Turbo/Fast/Normal/Slow)
        → Repeat count
        → Operation mode (Generate + Download / Download Only)

┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: User Clicks "Start Batch"                                  │
└─────────────────────────────────────────────────────────────────────┘
    ↓
    app.js: startBatch()
        → Line 135-165
        → Parse prompts (split by newline)
        → Build config object:
            {
                prompts: "prompt1\nprompt2\nprompt3",
                folderName: "batch_001",
                resolution: "2K",
                automationSpeed: "Turbo (2-5s)",
                repeatCount: 3,
                operation: "Generate + Download",
                aiFilenames: true,
                apiKey: "...",
                embedMetadata: true
            }
        → chrome.runtime.sendMessage({
            type: 'START_BATCH',
            data: config
          })
    ↓
    background.js: Message Listener
        → Line 39-58
        → Receives START_BATCH
        → chrome.tabs.query({ active: true })
        → Find tab with flow.google.com or aistudio.google.com
        → Forward to content script:
            chrome.tabs.sendMessage(tab.id, {
                type: 'START_BATCH_PROCESS',
                data: config
            })
    ↓
    content.js: Message Listener
        → Line 227-233
        → Receives START_BATCH_PROCESS
        → Set global state:
            batchConfig = msg.data
            batchProcessRunning = true
            generatedMediaUrls.clear()
            stats = { injected: 0, downloaded: 0, failed: 0, startTime: Date.now() }
        → Call runTurboPipeline(msg.data)

┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Run Turbo Pipeline (Main Loop)                             │
└─────────────────────────────────────────────────────────────────────┘
    ↓
    content.js: runTurboPipeline()
        → Line 247-344
        → Parse prompts: prompts.split('\n').filter(p => p.trim())
        → Calculate total: prompts.length * repeatCount
        → Log start: "🚀 TURBO PIPELINE | 9 items | Mode: Generate + Download"

        ┌─────────────────────────────────────────────────────────────┐
        │ PHASE 1: RAPID INJECTION LOOP                               │
        └─────────────────────────────────────────────────────────────┘
        
        FOR each prompt in prompts:
            FOR each repeat (1 to repeatCount):
                
                ┌────────────────────────────────────────────────────┐
                │ ITERATION START                                    │
                └────────────────────────────────────────────────────┘
                
                count++
                
                → Log progress:
                    "📝 [1/9] Prompt 1/3 | Repeat 1/3"
                    "   'Cyberpunk city with neon...'"
                
                → Send progress to UI:
                    chrome.runtime.sendMessage({
                        type: 'BATCH_PROGRESS',
                        current: count,
                        total: total,
                        promptNum: i + 1,
                        totalPrompts: prompts.length,
                        repeatNum: r + 1,
                        totalRepeats: repeatCount,
                        prompt: shortPrompt
                    })
                
                ┌────────────────────────────────────────────────────┐
                │ CRITICAL: START MEDIA DETECTION BEFORE INJECTION   │
                └────────────────────────────────────────────────────┘
                
                → Line 288-290
                → Log: "🔍 Starting media detection (baseline snapshot)..."
                → detectionPromise = startMediaDetection(60000)
                    ↓
                    content.js: startMediaDetection()
                        → Line 140-163
                        → baseline = scanMedia()
                            → Get ALL current media on page
                        → baselineUrls = Set of all URLs
                        → Log: "🔍 Media detection started | Baseline: 5 media"
                        → Create Promise that will resolve when new media appears
                        → Set pendingDetection = {
                            active: true,
                            resolve: [function],
                            reject: [function],
                            baselineUrls: Set(['url1', 'url2', ...]),
                            timeout: setTimeout(60000ms)
                          }
                        → Schedule immediate check: setTimeout(checkForNewMedia, 500ms)
                        → Return Promise (doesn't await yet)
                
                ┌────────────────────────────────────────────────────┐
                │ INJECT PROMPT (AFTER detection started)           │
                └────────────────────────────────────────────────────┘
                
                → Line 292-306
                → success = await turboInject(prompt)
                    ↓
                    content.js: turboInject()
                        → Line 350-409
                        → Find input field:
                            input = document.querySelector(SEL.input)
                                → '[data-slate-editor="true"]'
                                → '[contenteditable="true"]'
                                → 'textarea'
                            Fallback: scan all contenteditable
                            Fallback: scan all textareas
                        
                        → Focus input:
                            input.focus()
                        
                        → Inject text:
                            IF textarea:
                                input.value = prompt
                                input.dispatchEvent(new Event('input'))
                            ELSE (contenteditable):
                                input.innerHTML = ''
                                document.execCommand('selectAll')
                                document.execCommand('insertText', false, prompt)
                                input.dispatchEvent(new InputEvent('input'))
                        
                        → Wait 100ms for UI to react
                        
                        → Find and click generate button:
                            btn = document.querySelector(SEL.button)
                                → 'button[aria-label*="Generate"]'
                                → 'button[aria-label*="Create"]'
                                → 'button[type="submit"]'
                            Fallback: scan all buttons for text matching
                                'generate', 'create', 'run', 'send'
                            
                            IF found and not disabled:
                                btn.click()
                                return true
                            ELSE:
                                Fallback: Press Enter key
                                input.dispatchEvent(new KeyboardEvent('keydown', {
                                    key: 'Enter', code: 'Enter', keyCode: 13
                                }))
                                return true
                
                → IF injection failed:
                    → stats.failed++
                    → Log: "⚠️ Injection failed, retrying..."
                    → await sleep(1000)
                    → Retry once:
                        IF retry success:
                            stats.injected++
                            Log: "✅ Retry successful"
                        ELSE:
                            Log: "❌ Retry failed, skipping"
                            stopMediaDetection()  ← Cancel detection
                            continue  ← Skip to next prompt
                
                → IF injection successful:
                    → stats.injected++
                    → Log: "✅ Prompt injected successfully"
                
                ┌────────────────────────────────────────────────────┐
                │ WAIT FOR GENERATION TO COMPLETE                    │
                └────────────────────────────────────────────────────┘
                
                → Line 308
                → await waitGeneration(config.automationSpeed, count, total)
                    ↓
                    content.js: waitGeneration()
                        → Line 412-460
                        → Get delay range based on speed:
                            'Turbo (2-5s)': [2000, 5000]
                            'Fast (7-20s)': [7000, 20000]
                            'Normal (10-59s)': [10000, 59000]
                            'Slow (30-90s)': [30000, 90000]
                        
                        → wait = rand(min, max)
                        → totalSeconds = Math.ceil(wait / 1000)
                        → Log: "⏳ Waiting 4s for generation..."
                        
                        → COUNTDOWN LOOP:
                            FOR i = totalSeconds down to 1:
                                → Send countdown update to UI:
                                    chrome.runtime.sendMessage({
                                        type: 'COUNTDOWN_UPDATE',
                                        remaining: i,
                                        total: totalSeconds,
                                        currentNum: count,
                                        totalNum: total
                                    })
                                → await sleep(1000)
                        
                        → LOADING CHECK (max 3 attempts):
                            Log: "🔍 Checking if generation complete..."
                            loadingChecks = 0
                            FOR i = 0 to 2:
                                loading = document.querySelector(SEL.loading)
                                    → '[class*="loading"]'
                                    → '[class*="spinner"]'
                                    → 'mat-spinner'
                                
                                IF loading exists and visible:
                                    loadingChecks++
                                    Log: "⏳ Still generating... (check 1/3)"
                                    await sleep(3000)
                                ELSE:
                                    IF loadingChecks > 0:
                                        Log: "✅ Generation complete"
                                    break
                        
                        → Final buffer:
                            await sleep(1000)
                
                ┌────────────────────────────────────────────────────┐
                │ DOWNLOAD MEDIA (if Generate + Download mode)      │
                └────────────────────────────────────────────────────┘
                
                → Line 310-315
                → IF operation === 'Generate + Download':
                    → Log: "⬇ Downloading media..."
                    → await downloadLatestWithDetection(config, prompt, detectionPromise)
                        ↓
                        content.js: downloadLatestWithDetection()
                            → Line 495-543
                            → Log: "🔍 Waiting for new media to appear..."
                            
                            → AWAIT the detection promise (started before injection):
                                newMedia = await detectionPromise
                                
                                ┌──────────────────────────────────────┐
                                │ MutationObserver is watching DOM     │
                                └──────────────────────────────────────┘
                                
                                Meanwhile, MutationObserver callbacks running:
                                → Line 122-128
                                → ON any DOM mutation (childList, attributes):
                                    IF pendingDetection.active:
                                        checkForNewMedia()
                                            ↓
                                            → Line 166-189
                                            → currentMedia = scanMedia()
                                            → newMedia = currentMedia.filter(m =>
                                                !pendingDetection.baselineUrls.has(m.url))
                                            
                                            → IF newMedia.length > 0:
                                                latest = newMedia[newMedia.length - 1]
                                                Log: "✨ New media detected: image (1024x1024)"
                                                clearTimeout(pendingDetection.timeout)
                                                pendingDetection.active = false
                                                pendingDetection.resolve(latest)  ← Promise resolves!
                                                pendingDetection = null
                            
                            → IF newMedia is null (timeout):
                                Log: "❌ No new media detected within timeout"
                                stats.failed++
                                return
                            
                            → IF generatedMediaUrls.has(newMedia.url):
                                Log: "⚠️ Media already downloaded (duplicate URL)"
                                return
                            
                            → Mark as downloaded:
                                generatedMediaUrls.add(newMedia.url)
                                stats.downloaded++
                            
                            → Generate smart filename:
                                filename = generateSmartFilename(prompt, {
                                    resolution: config.resolution || '1K',
                                    extension: newMedia.extension,
                                    maxLength: 40
                                })
                                    ↓
                                    content.js: generateSmartFilename()
                                        → Line 16-60
                                        → Clean prompt:
                                            cleanPromptForFilename(prompt, 40)
                                                → Line 63-108
                                                → Remove filler words (a, the, and, etc.)
                                                → Convert to lowercase
                                                → Replace special chars
                                                → Split into words
                                                → Filter words (length > 2)
                                                → Take first 8 words
                                                → Join with underscores
                                                → Truncate at word boundary if too long
                                                → Example: "cyberpunk_city_neon_lights_rain"
                                        
                                        → Build filename:
                                            baseName = cleanedPrompt
                                            baseName += '_' + resolution  → "..._2K"
                                            baseName += '_' + timestamp   → "..._20260104225500123"
                                        
                                        → Check uniqueness:
                                            WHILE usedFilenames.has(filename):
                                                filename = baseName + '_' + counter
                                                counter++
                                        
                                        → Track filename:
                                            usedFilenames.add(filename)
                                            downloadCounter++
                                        
                                        → Return: "cyberpunk_city_neon_lights_rain_2K_20260104225500123.png"
                            
                            → Log: "✅ Downloading: image (1024x1024)"
                            → Log: "📁 Filename: [smart_filename].png"
                            
                            → Send download request to background:
                                chrome.runtime.sendMessage({
                                    type: 'DOWNLOAD_MEDIA',
                                    url: newMedia.url,
                                    filename: 'cyberpunk_city_neon_lights_rain_2K_20260104225500123.png',
                                    prompt: 'Cyberpunk city with neon lights and rain',
                                    aiFilenames: config.aiFilenames,
                                    apiKey: config.apiKey,
                                    folderName: config.folderName,
                                    embedMetadata: config.embedMetadata
                                })
                                    ↓
                                    background.js: handleDownload()
                                        → (Same as Manual Mode steps above)
                                        → Downloads file
                            
                            → Short delay:
                                await sleep(rand(500, 2000))
                
                ELSE (Download Only mode):
                    → stopMediaDetection()  ← Cancel detection
                
                ┌────────────────────────────────────────────────────┐
                │ END OF ITERATION - Move to next                   │
                └────────────────────────────────────────────────────┘
            
            END REPEAT LOOP
        END PROMPT LOOP
        
        ┌─────────────────────────────────────────────────────────────┐
        │ PHASE 2: BULK HARVEST (if Download Only mode)              │
        └─────────────────────────────────────────────────────────────┘
        
        → IF operation === 'Download Only':
            → Line 318-321
            → await bulkHarvest(config)
                ↓
                content.js: bulkHarvest()
                    → Line 545-564
                    → Log: "📜 Scanning page..."
                    → await quickScroll()
                        → Line 566-577
                        → Scroll down page to load lazy content
                        → 30 iterations max
                        → Stop if height stops changing
                    
                    → media = scanMedia()
                    → Log: "📦 Harvesting [N] items..."
                    
                    → FOR each media item:
                        IF already downloaded (in generatedMediaUrls):
                            skip
                        
                        generatedMediaUrls.add(item.url)
                        stats.downloaded++
                        
                        chrome.runtime.sendMessage({
                            type: 'DOWNLOAD_MEDIA',
                            url: item.url,
                            filename: generateSmartFilename(`harvest_item_${i}`, {...}),
                            folderName: config.folderName,
                            embedMetadata: config.embedMetadata
                        })
                        
                        IF i % 20 === 0:
                            Log progress: "⬇ 20/100"
                        
                        await sleep(rand(300, 1000))

┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: Batch Completion                                           │
└─────────────────────────────────────────────────────────────────────┘
    ↓
    content.js: runTurboPipeline() end
        → Line 323-344
        → batchProcessRunning = false
        → elapsed = (Date.now() - stats.startTime) / 1000
        → rate = elapsed / stats.injected
        → Log: "✅ COMPLETE | ✓9 | ⬇9 | ❌0 | ⏱45s (5.0s/item)"
        
        → Send completion message:
            chrome.runtime.sendMessage({ type: 'BATCH_COMPLETED' })
        
        → IF voice notifications enabled:
            speak(`Completed ${stats.injected} generations in ${elapsed} seconds`)
                → Line 859-866
                → window.speechSynthesis.speak(...)
```

---

## Message Flow Summary

```
USER ACTION                  COMPONENT INVOLVED           MESSAGE TYPE
──────────────────────────  ─────────────────────────    ─────────────────────
Click Detect Media       →  app.js                   →  DETECT_MEDIA
                         →  background.js            →  SCAN_MEDIA (forwarded)
                         →  content.js               →  scanMedia()
                         ←  content.js               ←  { media: [...] }
                         ←  background.js            ←  (forwarded)
                         ←  app.js                   ←  Updates UI

Click Download (Manual)  →  app.js                   →  DOWNLOAD_WITH_RESOLUTION
                         →  background.js            →  (forwarded)
                         →  content.js               →  downloadWithResolution()
                         →  content.js               →  DOWNLOAD_MEDIA
                         →  background.js            →  handleDownload()
                         →  chrome.downloads API     →  File saved

Click Start Batch        →  app.js                   →  START_BATCH
                         →  background.js            →  START_BATCH_PROCESS
                         →  content.js               →  runTurboPipeline()
                           (Loop for each prompt:)
                         →  content.js               →  BATCH_PROGRESS
                         →  background.js            →  (forwarded)
                         →  app.js                   →  Updates progress bar
                         →  content.js               →  COUNTDOWN_UPDATE
                         →  app.js                   →  Updates countdown
                         →  content.js               →  DOWNLOAD_MEDIA (per item)
                         →  background.js            →  handleDownload()
                         →  content.js               →  BATCH_COMPLETED
                         →  app.js                   →  Resets UI

Click Stop Batch         →  app.js                   →  STOP_BATCH
                         →  background.js            →  STOP_BATCH_PROCESS
                         →  content.js               →  batchProcessRunning = false
```

---

## Critical Timing Points (Where Issues Can Occur)

### 1. **Media Detection Baseline** (Line 288-290)
```javascript
const detectionPromise = startMediaDetection(60000);
```
**MUST happen BEFORE injection**
- If started too late → baseline includes newly generated image → downloads same image repeatedly
- If not awaited properly → race condition

### 2. **Prompt Injection** (Line 292)
```javascript
const success = await turboInject(prompt);
```
**Can fail if:**
- Input field not found (selector changed)
- Button not found or disabled
- Event propagation blocked
- Google Flow UI changed

### 3. **Generation Wait** (Line 308)
```javascript
await waitGeneration(config.automationSpeed, count, total);
```
**Can timeout if:**
- Generation takes longer than random delay
- Loading spinner selector changed
- Network issues

### 4. **Media Detection Resolution** (Line 502)
```javascript
const newMedia = await detectionPromise;
```
**Returns null if:**
- No new media appears within 60s
- MutationObserver not detecting changes
- Media URL matches existing baseline

### 5. **Download Request** (Line 531-540)
```javascript
chrome.runtime.sendMessage({ type: 'DOWNLOAD_MEDIA', ... });
```
**Can fail if:**
- Message channel closed
- Background service worker sleeping
- URL is blob: and expired

---

## Debugging Checklist

To find where the abnormal behavior occurs:

1. **Check Console Logs**
   ```
   F12 → Console tab → Filter: [FlowAI]
   Look for sequence of logs matching pipeline
   ```

2. **Verify Detection Timeline**
   ```
   Should see IN THIS ORDER:
   🔍 Starting media detection (baseline snapshot)...
   🔍 Media detection started | Baseline: 5 media
   ✅ Prompt injected successfully
   ✨ New media detected: image (1024x1024)
   ```

3. **Check for Skipped Steps**
   ```
   Missing any log? → That step failed
   ```

4. **Monitor generatedMediaUrls**
   ```javascript
   // Add to console:
   console.log('Tracked URLs:', Array.from(generatedMediaUrls));
   ```

5. **Check usedFilenames**
   ```javascript
   // Add to console:
   console.log('Used filenames:', Array.from(usedFilenames));
   ```

6. **Verify MutationObserver Active**
   ```javascript
   // Should see on load:
   📡 Media observer initialized
   ```

---

**Document Version**: 2026-01-04  
**Extension Version**: 5.1
