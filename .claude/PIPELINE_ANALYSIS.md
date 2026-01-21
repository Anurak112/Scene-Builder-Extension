# Flow AI Media Downloader - Pipeline Analysis & Issues

## Project Overview
A Chrome extension for high-volume autonomous media generation and downloading from Google Flow AI and AI Studio.

**Version**: 5.0 TURBO  
**Target**: 1000+ media generation with 2-5s delays  
**Architecture**: Manifest V3, Side Panel UI, Content Script automation

---

## Current Architecture

### Core Components
1. **manifest.json** - Extension configuration
2. **background.js** - Service worker (download handler, message router)
3. **content.js** - Page automation (injection, generation, scanning)
4. **sidepanel/app.js** - UI controller
5. **sidepanel/index.html** - UI markup
6. **sidepanel/styles.css** - UI styling

### Message Flow
```
Side Panel UI → background.js → content.js → Google Flow API
                     ↓
              chrome.downloads API
```

---

## Critical Issues Identified

### 🔴 Issue #1: Wrong Media Type Detection in Batch Mode

**Location**: `content.js` lines 310-341 (`downloadLatest` function)

**Problem**:
```javascript
const latest = newMedia[newMedia.length - 1];  // Always takes LAST media
```

**Why This Fails**:
- When multiple images exist on page, it assumes the **last** one is the newest
- Google Flow renders media in unpredictable order
- Icons, thumbnails, and other page elements may be detected as "latest"
- Works by accident in some cases, fails in others

**Evidence from Screenshot**:
- User getting duplicate downloads with identical prompts
- File type confusion (downloads whatever is "last" in DOM, not what was just generated)

**Root Cause**:
No correlation between prompt submission and media generation timestamp/order.

---

### 🔴 Issue #2: Media Detection Not Prompt-Aware

**Location**: `content.js` lines 277-307 (`scanMedia` function)

**Problem**:
```javascript
function scanMedia() {
    const elements = document.querySelectorAll(SEL.media);
    // Returns ALL media on page, no timestamp, no association with prompts
}
```

**Issues**:
1. No timestamp tracking when media appears
2. No DOM observation for new media
3. No correlation between injection time and media appearance time
4. Relies on "latest = last in array" heuristic

**What's Missing**:
- MutationObserver to detect when new images are added to DOM
- Timestamp tracking for each detected media
- Prompt-to-media mapping
- Generation session tracking

---

### 🔴 Issue #3: Incorrect Workflow in Batch Mode

**Location**: `content.js` lines 63-129 (`runTurboPipeline`)

**Current Flow**:
```
For each prompt:
  1. Inject prompt
  2. Wait for generation (random delay)
  3. Download "latest" media
  4. Repeat
```

**Problems**:
1. **No verification** that generation actually completed
2. **Loading check is weak** (only 3 attempts, 3s each)
3. **Downloads whatever is "last"** in the media array, not what was just generated
4. **Race conditions**: If generation is slower than expected, downloads wrong media

**What Should Happen**:
```
For each prompt:
  1. Take snapshot of existing media URLs (before injection)
  2. Inject prompt
  3. Monitor DOM for NEW media elements (MutationObserver)
  4. Wait until new media appears (or timeout)
  5. Download ONLY the media that appeared after injection
  6. Move to next prompt
```

---

### 🔴 Issue #4: Resolution Download Logic Incorrect

**Location**: `content.js` lines 389-430 (`downloadWithResolution`)

**Problem**:
The "Manual Mode" resolution download tries to:
1. Click native download button on UI
2. Modify URL parameters for higher resolution

**Issues**:
- UI button clicking is fragile (selectors change, hover states unreliable)
- URL modification only works for `googleusercontent.com` URLs
- Blob URLs can't be modified
- No fallback if both methods fail
- Doesn't work for videos at all

---

### 🟡 Issue #5: Duplicate File Prevention Incomplete

**Location**: `content.js` lines 12-22 (recently fixed)

**Status**: ✅ FIXED with `generateUniqueId()`
- Now includes timestamp + counter + random suffix
- Should prevent duplicates

**Remaining Concern**:
The real issue isn't filename collision, it's **downloading the same media multiple times** because `downloadLatest` can't tell which media corresponds to which prompt.

---

### 🟡 Issue #6: Loading/Generation Detection Weak

**Location**: `content.js` lines 227-274 (`waitGeneration`)

**Current Logic**:
```javascript
await sleep(randomDelay);  // 2-5s, 7-20s, etc.
// Then check for loading spinner 3 times
for (let i = 0; i < 3; i++) {
    const loading = document.querySelector(SEL.loading);
    if (loading) await sleep(3000);
}
```

**Problems**:
1. Random delays are **guesswork**, not based on actual generation state
2. Loading spinner might not appear or might be cached
3. Only checks 3 times (9 seconds max) then gives up
4. No verification that media actually appeared
5. No handling of generation failures

---

### 🟡 Issue #7: Session Recovery Not Implemented

**Location**: Currently partially in `background.js` line 279-287

**Problem**:
- `updateBatchProgress` saves state but nothing uses it
- No UI to resume from saved state
- If browser crashes, all progress lost
- `resumeBatch()` in app.js doesn't actually work

---

## Recommended Fixes (Priority Order)

### 🏆 Phase 1: Fix Core Media Detection (CRITICAL)

**Goal**: Accurately identify which media corresponds to which prompt

**Changes Required**:

#### 1.1 Add MutationObserver to Track New Media
```javascript
// In content.js - Add at top
let mediaObserver = null;
let pendingMediaDetection = { active: false, resolve: null, baselineUrls: new Set() };

function startMediaDetection() {
    // Take snapshot of current media
    const baseline = scanMedia();
    pendingMediaDetection.baselineUrls = new Set(baseline.map(m => m.url));
    pendingMediaDetection.active = true;
    
    return new Promise((resolve) => {
        pendingMediaDetection.resolve = resolve;
        
        // Set timeout (30s max)
        setTimeout(() => {
            if (pendingMediaDetection.active) {
                pendingMediaDetection.active = false;
                resolve(null); // No new media detected
            }
        }, 30000);
    });
}

// MutationObserver to detect new images/videos
function initMediaObserver() {
    mediaObserver = new MutationObserver((mutations) => {
        if (!pendingMediaDetection.active) return;
        
        // Check if new media appeared
        const currentMedia = scanMedia();
        const newMedia = currentMedia.find(m => !pendingMediaDetection.baselineUrls.has(m.url));
        
        if (newMedia) {
            pendingMediaDetection.active = false;
            pendingMediaDetection.resolve(newMedia);
        }
    });
    
    mediaObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src']
    });
}
```

#### 1.2 Update `downloadLatest` to Use Detection
```javascript
async function downloadLatest(config, prompt) {
    log(`   🔍 Waiting for new media to appear...`);
    
    // Start detection BEFORE we've confirmed generation
    const detectionPromise = startMediaDetection();
    
    // Wait a bit longer for media to render
    await sleep(2000);
    
    // Get the new media (or timeout)
    const newMedia = await detectionPromise;
    
    if (!newMedia) {
        log(`   ⚠️ No new media detected after 30s`);
        stats.failed++;
        return;
    }
    
    // Mark as downloaded
    generatedMediaUrls.add(newMedia.url);
    stats.downloaded++;
    
    const slug = prompt.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 25);
    const filename = `${slug}_${config.resolution || '1K'}_${generateUniqueId()}.${newMedia.extension}`;
    
    log(`   ✅ New media detected: ${newMedia.type} (${newMedia.width}x${newMedia.height})`);
    
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
    
    await sleep(rand(500, 2000));
}
```

#### 1.3 Initialize Observer on Load
```javascript
// At bottom of content.js
initMediaObserver();
console.log('Flow AI v5.0 TURBO Ready - Media observer active');
```

---

### 🏆 Phase 2: Improve Generation Detection

**Goal**: Know when generation actually completes, not guess with delays

#### 2.1 Better Loading State Detection
```javascript
async function waitForGenerationComplete() {
    const maxAttempts = 60; // 60 seconds max
    
    for (let i = 0; i < maxAttempts && batchProcessRunning; i++) {
        const loading = document.querySelector(SEL.loading);
        
        // Check if loading indicator is visible
        if (loading && loading.offsetParent !== null) {
            log(`   ⏳ Generation in progress... (${i}s)`);
            await sleep(1000);
            continue;
        }
        
        // Check for error states
        const error = document.querySelector('[class*="error"], [role="alert"]');
        if (error && error.textContent.toLowerCase().includes('error')) {
            log(`   ❌ Generation error detected`);
            return { success: false, error: error.textContent };
        }
        
        // Loading stopped - generation likely complete
        // Wait a bit for media to render
        await sleep(2000);
        return { success: true };
    }
    
    log(`   ⏱️ Timeout after ${maxAttempts}s`);
    return { success: false, error: 'timeout' };
}
```

#### 2.2 Update Pipeline to Use It
```javascript
// In turboInject or after injection:
const result = await waitForGenerationComplete();
if (!result.success) {
    log(`   ❌ Generation failed: ${result.error}`);
    stats.failed++;
    return;
}
```

---

### 🏆 Phase 3: Fix Resolution Downloads

**Goal**: Reliable high-res downloads in Manual mode

#### 3.1 Strategy
1. **Primary**: Try to upscale via URL parameters (for Google CDN images)
2. **Secondary**: Download original, upscale client-side with canvas (for blobs)
3. **Fallback**: Download as-is

#### 3.2 Implementation
```javascript
async function downloadWithResolution(data) {
    const { url, resolution, index, folderName } = data;
    
    // Strategy 1: URL modification (works for googleusercontent.com)
    if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
        const highResUrl = getResolutionUrl(url, resolution);
        return downloadDirect(highResUrl, resolution, folderName);
    }
    
    // Strategy 2: Blob/Canvas upscale
    if (url.startsWith('blob:')) {
        return downloadAndUpscale(url, resolution, folderName);
    }
    
    // Strategy 3: Download as-is
    return downloadDirect(url, '1K', folderName);
}

async function downloadAndUpscale(blobUrl, resolution, folderName) {
    // Fetch blob
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    
    // Load into image
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode();
    
    // Calculate target size
    const sizeMap = { '1K': 1024, '2K': 2048, '4K': 4096 };
    const targetSize = sizeMap[resolution] || 1024;
    
    // Create canvas at target resolution
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const scale = Math.max(targetSize / img.width, targetSize / img.height);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    
    // Upscale with smooth rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Convert to blob
    return new Promise((resolve) => {
        canvas.toBlob((upscaledBlob) => {
            const upscaledUrl = URL.createObjectURL(upscaledBlob);
            downloadDirect(upscaledUrl, resolution, folderName);
            resolve({ success: true });
        }, 'image/png', 0.95);
    });
}
```

---

### 🏆 Phase 4: Session Recovery

**Goal**: Resume interrupted batches

#### 4.1 Save State After Each Download
```javascript
async function saveBatchState(promptIndex, downloaded, failed) {
    await chrome.storage.local.set({
        batchSession: {
            active: true,
            timestamp: Date.now(),
            config: batchConfig,
            progress: {
                promptIndex,
                downloaded,
                failed
            }
        }
    });
}
```

#### 4.2 Add Resume Logic
```javascript
async function resumeBatch() {
    const { batchSession } = await chrome.storage.local.get('batchSession');
    
    if (!batchSession || !batchSession.active) {
        log('No session to resume');
        return;
    }
    
    const config = batchSession.config;
    config.startIndex = batchSession.progress.promptIndex;
    
    log(`📂 Resuming from prompt ${config.startIndex + 1}`);
    runTurboPipeline(config);
}
```

---

### 🏆 Phase 5: Better Error Handling

**Goal**: Don't fail silently

#### 5.1 Capture Generation Errors
- Detect error messages in UI
- Log to activity feed
- Add to failed count
- Option to retry or skip

#### 5.2 Network Error Handling
- Retry downloads up to 3 times
- Exponential backoff
- Log failed downloads to file

#### 5.3 UI Feedback
- Show which prompts failed
- Allow manual retry of failed items
- Export failed prompts to text file

---

## Summary of Issues by Severity

| Priority | Issue | Impact | Complexity to Fix |
|----------|-------|--------|-------------------|
| 🔴 **P0** | Wrong media detection (takes "last" not "new") | HIGH - Downloads wrong files | Medium |
| 🔴 **P0** | No prompt-to-media correlation | HIGH - Can't verify correctness | Medium |
| 🔴 **P1** | Weak generation detection (guessing with delays) | MEDIUM - Timing issues | Low |
| 🟡 **P2** | Resolution downloads fragile | MEDIUM - Manual mode breaks | High |
| 🟡 **P2** | No session recovery | LOW - Convenience feature | Low |
| 🟢 **P3** | Duplicate filenames | FIXED ✅ | N/A |

---

## Next Steps

### Immediate (This Week)
1. ✅ Fix duplicate filenames (DONE)
2. 🔧 Implement MutationObserver media detection
3. 🔧 Update `downloadLatest` to use new detection
4. 🔧 Improve generation completion detection

### Short-term (Next Week)
4. Fix resolution downloads with canvas upscaling
5. Add session recovery
6. Better error handling and logging

### Long-term (Future)
7. Video handling improvements
8. Metadata extraction from Google Flow UI
9. Batch export to ZIP
10. Cloud storage integration (Google Drive, etc.)

---

## Testing Checklist

After implementing Phase 1 fixes, test:

- [ ] Single prompt generates and downloads correct media
- [ ] Multiple prompts in sequence (5+) download correct media for each
- [ ] Repeat count (3x same prompt) downloads 3 unique images
- [ ] No duplicate downloads
- [ ] Failed generations logged correctly
- [ ] Works on both Google Flow and AI Studio
- [ ] Works for both images and videos
- [ ] Session recovery from mid-batch

---

**Analysis Date**: 2026-01-04  
**Analyzed By**: Antigravity AI Assistant  
**Project Version**: 5.0 TURBO
