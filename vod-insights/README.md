# VOD Insights 🎮📊

**Automated VOD analysis for esports coaches and content creators. Works with any game.**

Turn hours of gameplay footage into polished, highlight-ready clips in minutes. VOD Insights scans your recorded gameplay, detects key moments (kills, assists, knocks, or custom events), and helps you navigate and export clips-all locally on your Windows PC. Works with any game, from Apex Legends to Valorant to CS:GO.

---

## For Esports Coaches 👨‍🏫

### Analyze gameplay faster. Coach smarter.

- **Jump instantly to key moments** - Use event markers and heatmaps to navigate VODs without manual scrubbing
- **Spot patterns** in kill trades, positioning, and team fights with visual event markers
- **Generate searchable event logs** of every kill, assist, and knockout across long scrim sessions
- **Review at your pace** - Use "next event" and "previous event" buttons to skim through the action

*Perfect for scrim reviews, team debriefs, and identifying mechanical improvements.*

---

## For Content Creators 🎥

### Stop editing. Start uploading.

- **Auto-split your stream VODs** into bite-sized clips perfect for YouTube Shorts, TikTok, or Twitch clips
- **Intelligent merging** - nearby kills are combined into one clean highlight, not fragmented clips
- **Custom naming** - clips are auto-labeled with timestamps, kill counts, and event details (kill/assist/knock)
- **Twitch integration** - download your Twitch VODs and analyze them the same way you record locally
- **Batch process** - analyze entire gaming sessions while you edit other content or sleep

*Turn raw gameplay into content in a fraction of the time. Focus on commentary and strategy; let VOD Insights handle the technical editing.*

---

## How It Works ⚙️

1. **Calibrate your killfeed region** - Visual setup takes 2 minutes
2. **Scan your VOD** - Upload a video or point to a local file
3. **VOD Insights analyzes it** - OCR detects all kill/assist/knock events and marks them with timestamps
4. **Jump to the action** - Use event markers to instantly navigate to key moments
5. **Download your clips** - Export polished highlight clips with auto-generated names

No manual scrubbing. No frame-by-frame editing. No guessing where the action is.

---

## Key Features

- ✅ **Works with any game** — Apex, Valorant, CS:GO, or any esports title  
- ✅ **Killfeed OCR scanning** — Automatically detects all events during VOD analysis
- ✅ **Custom region calibration** — Works with any overlay, HUD, or resolution  
- ✅ **VOD viewer with event navigation** — Jump between key moments using event markers  
- ✅ **Twitch VOD download + analysis** — Import and analyze clips from your Twitch channel  
- ✅ **Auto-split clips** — FFmpeg-powered clip extraction with intelligent merging  
- ✅ **Desktop app + web UI** — Local, private, no cloud dependencies  
- ✅ **Batch processing** — Process multiple VODs or long sessions unattended  
- ✅ **Smart naming** — Automatic clip names with event counts (e.g., `clip_20260228_120000_k2_a1_d0.mp4`)  
- ✅ **Event logs (CSV/JSONL)** — Export data for further analysis or integration

---

## Quick Start (5 Minutes)

### Requirements

- **Windows 10 or 11** (64-bit)
- Stable internet (for first run setup only)

### Installation

1. **Download the latest installer** from [GitHub Releases](https://github.com/nishiegroe/VOD-Insights/releases)
2. **Run the installer** - Follow the prompts (auto-installs dependencies like FFmpeg)
3. **Launch the app** - Click the desktop shortcut
4. **Calibrate your killfeed region** (1 minute):
   - Open **Settings** → **Capture Area**
   - Adjust the overlay to match your killfeed
   - Click **Save**
5. **Start logging events!**

### First Session

1. Go to **VOD Library** and select a recording (or download from Twitch)
2. Click **Scan for Events** to analyze the VOD
3. Once scanning is complete, use the **VOD Viewer** to jump between key moments
4. Use **Previous Event** and **Next Event** buttons to skim through highlights
5. Optionally export clips of moments you want to share

Your VOD is now fully searchable with all key moments marked!

---

## Use Cases

### Coach Scenario
*"I want to review my team's scrim session and give feedback on 5 key rounds."*

1. Load the scrim VOD into VOD Library
2. Scan for all events (kills, assists, knockdowns)
3. Use the VOD Viewer's event heatmap to identify high-action moments
4. Jump directly to key moments using "Next Event" buttons - no scrubbing
5. Use event markers to take notes and bookmark specific rounds for discussion

**Time saved:** 45 minutes of manual scrubbing → 5 minutes to find and review key moments

---

### Content Creator Scenario
*"I have a 4-hour VOD and want to find 3 YouTube Shorts-worthy moments."*

1. Download your VOD from Twitch or import a local file into **VOD Library**
2. Scan for all events to get a complete map of kills, assists, and highlights
3. Use the VOD Viewer's event markers to jump to high-action areas
4. Export 30-60 second clips from moments with multi-kills or clutch plays
5. Download clips and upload to YouTube Shorts/TikTok with captions

**Time saved:** 2+ hours of manual scrubbing → 15 minutes to find and export clips

---

## Configuration & Advanced Options

VOD Insights is highly configurable. Once you've installed and run the app, you can tweak:

- **OCR settings** - Speed/accuracy tradeoff, GPU acceleration (optional)
- **Capture region** - Fine-tune killfeed coordinates
- **Event keywords** - Customize what counts as a "kill," "assist," etc.
- **Clip length** - Adjust how many seconds before/after an event to capture
- **Output naming** - Customize clip file names with timestamps and event counts
- **Cooldown periods** - Prevent clip spam from rapid-fire events

See the **Settings** page in the app for full details.

---

## For Developers

### Stack

- **Python 3.10+** backend (Flask, OpenCV, Tesseract/EasyOCR)
- **React 18** frontend (Vite SPA)
- **Electron** desktop wrapper
- **FFmpeg** for clip splitting
- **Inno Setup** for Windows installer

### Development

```bash
# Clone the repo
git clone https://github.com/nishiegroe/VOD-Insights.git
cd VOD-Insights

# Set up Python backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Set up frontend
cd frontend
npm install
npm run dev

# In another terminal: run backend
python -m app.webui

# In another terminal: run desktop app
cd desktop
npm install
npm run dev
```

See [CLAUDE.md](CLAUDE.md) for full architecture docs, build instructions, and release workflow.

---

## Troubleshooting

### "Killfeed not detected"
- Ensure your capture region overlaps your actual killfeed
- Try adjusting **OCR threshold** in Settings (increase for better contrast)
- Switch to **GPU OCR** for better accuracy on complex overlays

### "Clips are too short/long"
- Adjust **clip padding** in Settings (seconds before/after event)
- Increase **merge distance** to combine nearby events into one clip

### "App is slow"
- Reduce **capture FPS** in Settings (default: 30, try 15-20)
- Increase **OCR interval** (check killfeed less frequently)
- Enable **GPU OCR** if you have an NVIDIA GPU

### "Still stuck?"
- Open an issue on [GitHub](https://github.com/nishiegroe/VOD-Insights/issues) with details about your setup and what happened

---

## Roadmap & Contributing

This is an actively developed tool. Future ideas:

- [ ] Multi-region detection (minimap, damage numbers, etc.)
- [ ] AI-powered play evaluation
- [ ] Customizable event types beyond kill/assist/knock
- [ ] Native support for other games (Valorant, CS:GO, etc.)

**Want to contribute?** Open an issue or PR. All skill levels welcome.

---

## License

[MIT License](LICENSE) - Use freely, modify, and redistribute.

---

## Credits

Built by [Nishie](https://github.com/nishiegroe) for the Apex Legends esports and content creation community.

**Questions?** Open an issue or reach out on Discord.

---

**Ready to save hours on VOD analysis?** [Download the latest release now](https://github.com/nishiegroe/VOD-Insights/releases) 🚀
