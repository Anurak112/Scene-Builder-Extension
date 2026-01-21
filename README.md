# Flow AI Media Downloader TURBO v5.0

**High-volume autonomous media generator for Google Flow AI**
Optimized pipeline for generating 1,000+ images and videos.

## ⚡ TURBO Features

| Speed Mode | Delay | Throughput |
|------------|-------|------------|
| **Turbo** | 2-5s | ~720/hour |
| Fast | 7-20s | ~270/hour |
| Normal | 10-59s | ~100/hour |
| Slow | 30-90s | ~60/hour |

## 🚀 Optimizations

- **Direct value injection** - No character-by-character typing
- **Cached selectors** - Pre-compiled for instant lookup
- **Minimal delays** - 2-5 second turbo mode
- **Memory-efficient** - Log capped at 100 entries
- **Progress tracking** - Live progress bar with ETA
- **Batch stats** - Items/sec, success rate, elapsed time

## 📦 Quick Start

1. Install extension (`chrome://extensions` → Load unpacked)
2. Navigate to `labs.google/fx/tools/flow`
3. Click extension icon → Side panel opens
4. Paste prompts (one per line)
5. Select **Turbo (2-5s)** speed
6. Click **▶ Start**

## 🎯 Supported Platforms

- `labs.google/fx/tools/flow`
- `aistudio.google.com`
- `flow.google.com`

## 📁 Architecture

```
├── manifest.json    # v5.0 config
├── content.js       # Turbo injection engine
├── background.js    # Download handler
├── glm-api.js       # AI filename generation
└── sidepanel/
    ├── index.html
    ├── app.js       # UI controller
    └── styles.css   # Premium dark theme
```

## 🔧 Settings

| Setting | Description |
|---------|-------------|
| Repeat | 1-20x per prompt |
| Resolution | 1K / 2K / 4K |
| AI Filenames | GLM 4.7 API naming |
| Embed Metadata | PNG prompt injection |
| Voice | Completion announcements |

---
**v5.0.0** - TURBO High-Volume Pipeline
