# Quick Debugging Guide - Duplicate Download Issue

## The Issue
Getting the **same image downloaded multiple times** instead of different images for each prompt.

---

## Step-by-Step Debugging

### 1. Open Console and Monitor Logs

**Press F12 → Console tab**

Filter logs with: `[FlowAI]`

### 2. Expected Log Sequence (Per Prompt)

```
✅ CORRECT SEQUENCE:
──────────────────────────────────────────────────────────────
📝 [1/3] Prompt 1/3 | Repeat 1/1
   "Cyberpunk city with neon..."

🔍 Starting media detection (baseline snapshot)...      ← STEP A
🔍 Media detection started | Baseline: 5 media          ← STEP B

✅ Prompt injected successfully                          ← STEP C

⏳ Waiting 4s for generation...                         ← STEP D
🔍 Checking if generation complete...
✅ Generation complete

⬇ Downloading media...                                  ← STEP E
🔍 Waiting for new media to appear...
✨ New media detected: image (1024x1024)                ← STEP F ← CRITICAL!
✅ Downloading: image (1024x1024)
📁 Filename: cyberpunk_city_neon_lights_2K_[time].png  ← STEP G
```

### 3. Check Critical Step F

**The most important log line:**
```
✨ New media detected: image (1024x1024)
```

**Questions to ask:**

1. **Does this log appear for EACH prompt?**
   - YES → Good, detection is working
   - NO → Detection is timing out or failing

2. **Does the filename (Step G) change for each prompt?**
   - YES → Smart filenames working
   - NO → Getting same filename → same prompt being used

3. **Do the image dimensions change?**
   - YES → Different images being detected
   - NO → Same image being detected repeatedly

---

## Common Problems & Solutions

### Problem 1: Detection Happens Too Late

**Log Pattern:**
```
✅ Prompt injected successfully
⏳ Waiting 4s for generation...
✅ Generation complete
⬇ Downloading media...
🔍 Starting media detection (baseline snapshot)...    ← TOO LATE!
✨ New media detected: image (1024x1024)              ← Already existed!
```

**Diagnosis**: Detection starts AFTER image appeared
**Fix**: Already implemented (detection now starts at line 288-290 BEFORE injection)
**Verify**: Ensure you reloaded the extension after the fix

### Problem 2: Same URL Being Detected

**Add this debug log:**
```javascript
// In content.js, line 502, add:
console.log('[DEBUG] Detected URL:', newMedia?.url);
console.log('[DEBUG] Baseline URLs:', Array.from(pendingDetection?.baselineUrls || []));
```

**Expected**: URLs should be different for each prompt
**If same**: Baseline is not being taken correctly

### Problem 3: Baseline Not Updating

**Check this in console:**
```javascript
// Run manually:
scanMedia().length;  // Should return count of current media

// After generation:
scanMedia().length;  // Should be +1
```

**If count doesn't increase**: Media isn't being added to DOM

### Problem 4: Detection Times Out

**Log Pattern:**
```
🔍 Waiting for new media to appear...
⏱️ Media detection timeout (60000ms)
❌ No new media detected within timeout
```

**Possible Causes:**
1. Generation failed (check Google Flow for errors)
2. Image loaded but not matching selectors
3. MutationObserver not firing

**Check MutationObserver:**
```javascript
// Should see on page load:
📡 Media observer initialized
```

If missing → Observer didn't start

---

## Manual Testing Steps

### Test 1: Single Prompt (Baseline)

1. Clear downloads folder
2. Switch to Batch mode
3. Enter ONE prompt:
   ```
   A red apple on a table
   ```
4. Set repeat to **1**
5. Click "Start Batch"
6. **Expected**: 1 file downloaded
7. **Check filename**: Should contain "red_apple_table"

**✅ Pass**: Proceeds to Test 2  
**❌ Fail**: Check console logs, fix detection issue

### Test 2: Different Prompts (Core Issue)

1. Clear downloads folder
2. Enter THREE different prompts:
   ```
   A red apple on a table
   A blue car in a garage
   A yellow bird flying
   ```
3. Set repeat to **1**
4. Click "Start Batch"
5. **Expected**: 3 DIFFERENT files
6. **Check filenames**:
   ```
   red_apple_table_2K_[time1].png
   blue_car_garage_2K_[time2].png
   yellow_bird_flying_2K_[time3].png
   ```
7. **Open files visually**: Should be 3 different images

**✅ Pass**: Detection working correctly  
**❌ Fail**: Check if same prompt being used (filename identical) or same media detected

### Test 3: Same Prompt Repeated (Variations)

1. Clear downloads folder
2. Enter ONE prompt repeated:
   ```
   Cyberpunk city neon lights
   Cyberpunk city neon lights
   Cyberpunk city neon lights
   ```
3. Set repeat to **1**
4. Click "Start Batch"
5. **Expected**: 3 DIFFERENT generated variations
6. **Check filenames**: Should have `_1`, `_2` suffixes
   ```
   cyberpunk_city_neon_lights_2K_[time1].png
   cyberpunk_city_neon_lights_2K_[time2]_1.png
   cyberpunk_city_neon_lights_2K_[time3]_2.png
   ```
7. **Open files**: Should be 3 visually different variations

**✅ Pass**: Google Flow generating variations correctly  
**❌ Fail**: Same image file → Detection catching same media

---

## Console Debug Commands

### Check Current State

```javascript
// In browser console on Google Flow page:

// 1. Check how many media items currently visible
document.querySelectorAll('img[src*="storage.googleapis"], img[src*="blob:"]').length;

// 2. Check tracked downloads
generatedMediaUrls.size;  // How many already downloaded

// 3. Check used filenames
usedFilenames.size;  // How many unique filenames generated

// 4. Check if detection is active
pendingDetection;  // Should be null when idle, object when detecting

// 5. Force a media scan
scanMedia();  // Returns array of detected media
```

### Inject Test Prompt Manually

```javascript
// Test injection without full batch:
turboInject("Test cyberpunk city").then(r => console.log('Inject result:', r));
```

### Monitor Media Changes

```javascript
// Watch for new images appearing:
const observer = new MutationObserver((mutations) => {
    mutations.forEach(m => {
        m.addedNodes.forEach(node => {
            if (node.tagName === 'IMG' || node.tagName === 'VIDEO') {
                console.log('NEW MEDIA:', node.src);
            }
        });
    });
});
observer.observe(document.body, { childList: true, subtree: true });
```

---

## What to Report

If issue persists, provide:

1. **Full console log** from one batch run (copy/paste text)
2. **Screenshot** of downloaded files showing duplicate issue
3. **Prompts used** (what you entered in text area)
4. **Settings**: Resolution, Speed, Repeat count
5. **Browser/Extension info**:
   - Chrome version
   - Extension reloaded? (YES/NO)
6. **Observed behavior**:
   - Same filename repeated? → Smart filename issue
   - Same image repeated? → Detection issue
   - Different filenames but same image? → Detection catching same URL

---

## Quick Fix Checklist

- [ ] Extension reloaded in `chrome://extensions/`
- [ ] Google Flow page refreshed
- [ ] Side panel closed and reopened
- [ ] Console shows: `📡 Media observer initialized`
- [ ] Console shows: `🔍 Starting media detection` BEFORE `✅ Prompt injected`
- [ ] Console shows: `✨ New media detected` for EACH prompt
- [ ] Filenames are unique (no exact duplicates)
- [ ] Image files are visually different (not same image)

If ALL checked ✅ → Issue is fixed
If ANY checked ❌ → That's where the problem is

---

**Last Updated**: 2026-01-04
