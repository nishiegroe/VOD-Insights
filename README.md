# VOD Insights 🎮📊

**Automated Apex Legends VOD analysis for coaches, content creators, and esports professionals.**

Turn hours of gameplay footage into polished, highlight-ready clips in minutes. VOD Insights watches your killfeed in real time, detects key moments (kills, assists, knocks), and auto-splits your recordings into ready-to-share clips—all locally on your Windows PC.

---

## For Esports Coaches 👨‍🏫

### Analyze gameplay faster. Coach smarter.

- **Spot patterns** in kill trades, positioning, and team fights without manually scrubbing through VODs
- **Create highlight reels** for players to review their best (and worst) moments in seconds
- **Generate searchable event logs** of every kill, assist, and knockout across long scrim sessions
- **Build a coaching library** — organize clips by player, round type, or strategy

*Perfect for scrim reviews, team debriefs, and identifying mechanical improvements.*

---

## For Content Creators 🎥

### Stop editing. Start uploading.

- **Auto-split your stream VODs** into bite-sized clips perfect for YouTube Shorts, TikTok, or Twitch clips
- **Intelligent merging** — nearby kills are combined into one clean highlight, not fragmented clips
- **Custom naming** — clips are auto-labeled with timestamps, kill counts, and event details (kill/assist/knock)
- **Twitch integration** — download your Twitch VODs and analyze them the same way you record locally
- **Batch process** — analyze entire gaming sessions while you edit other content or sleep

*Turn raw gameplay into content in a fraction of the time. Focus on commentary and strategy; let VOD Insights handle the technical editing.*

---

## How It Works ⚙️

1. **Set up your killfeed region** — Simple visual calibration (2 minutes)
2. **Start recording gameplay** — VOD Insights runs quietly in the background
3. **Pick your moment** — Press a button to log bookmarks, or let it run continuously
4. **Auto-split and export** — Get polished clips with proper naming and timestamps
5. **Upload to your platform** — Ready-to-share content in one click

No complex setup. No manual scrubbing. No time-consuming clip editing.

---

## Key Features

- ✅ **Real-time killfeed OCR** — Detects kill/assist/knock events instantly  
- ✅ **Bookmarks mode** — Log timestamps manually during long sessions  
- ✅ **Auto-split clips** — FFmpeg-powered clip extraction with intelligent merging  
- ✅ **Custom region calibration** — Works with any overlay, HUD, or resolution  
- ✅ **Twitch VOD download + analysis** — Import and analyze clips from your Twitch channel  
- ✅ **Desktop app + web UI** — Local, private, no cloud dependencies  
- ✅ **Batch processing** — Process multiple VODs or long sessions unattended  
- ✅ **Smart naming** — Automatic clip names with event counts (e.g., `clip_20260228_120000_k2_a1_d0.mp4`)  
- ✅ **Event logs (CSV/JSONL)** — Export data for further analysis or integration  

---

## Quick Start (5 Minutes)

### Requirements

- **Windows 10 or 11** (64-bit)
- ~500 MB free disk space for the app
- Stable internet (for first run setup only)

### Installation

1. **Download the latest installer** from [GitHub Releases](https://github.com/nishiegroe/VOD-Insights/releases)
2. **Run the installer** — Follow the prompts (auto-installs dependencies like FFmpeg)
3. **Launch the app** — Click the desktop shortcut
4. **Calibrate your killfeed region** (1 minute):
   - Open **Settings** → **Capture Area**
   - Adjust the overlay to match your killfeed
   - Click **Save**
5. **Start logging events!**

### First Session

- **For real-time capture:** Open **Home**, click **Start Capture**, play a match, then **Stop**
- **For bookmarks mode:** Click **Start Bookmarks**, press the hotkey during kills, then **Export Clips**
- **For existing VODs:** Go to **VOD Library**, select a recording, and **Scan for Events**

Done. Your clips are ready in the output folder.

---

## Use Cases

### Coach Scenario
*"I want to review my team's scrim session and give feedback on 5 key rounds."*

1. Record your scrim with VOD Insights running
2. After the session, scan the VOD
3. Export 15-30 second clips of each key moment
4. Use them in your team debrief or send to players for review

**Time saved:** 45 minutes of manual scrubbing → 5 minutes of auto-export

---

### Content Creator Scenario
*"I streamed a 4-hour ranked session and want to upload 3 YouTube Shorts from it."*

1. VOD Insights ran in the background during your stream (or import your Twitch VOD)
2. Review the auto-detected kill moments in the **Clips** tab
3. Select the 3 best clips (they're already trimmed and named)
4. Download them to your upload folder
5. Upload to YouTube Shorts with captions

**Time saved:** 2+ hours of editing → 10 minutes of selection + upload

---

## Configuration & Advanced Options

VOD Insights is highly configurable. Once you've installed and run the app, you can tweak:

- **OCR settings** — Speed/accuracy tradeoff, GPU acceleration (optional)
- **Capture region** — Fine-tune killfeed coordinates
- **Event keywords** — Customize what counts as a "kill," "assist," etc.
- **Clip length** — Adjust how many seconds before/after an event to capture
- **Output naming** — Customize clip file names with timestamps and event counts
- **Cooldown periods** — Prevent clip spam from rapid-fire events

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
- Check **Logs** tab in the app for error details
- Open an issue on [GitHub](https://github.com/nishiegroe/VOD-Insights/issues) with your logs and settings

---

## Roadmap & Contributing

This is an actively developed tool. Future ideas:

- [ ] Multi-region detection (minimap, damage numbers, etc.)
- [ ] AI-powered play evaluation
- [ ] Direct Twitch/YouTube export
- [ ] Customizable event types beyond kill/assist/knock
- [ ] Support for other games (Valorant, CS:GO, etc.)

**Want to contribute?** Open an issue or PR. All skill levels welcome.

---

## License

[MIT License](LICENSE) — Use freely, modify, and redistribute.

---

## Credits

Built by [Nishie](https://github.com/nishiegroe) for the Apex Legends esports and content creation community.

**Questions?** Open an issue or reach out on Discord.

---

**Ready to save hours on VOD analysis?** [Download the latest release now](https://github.com/nishiegroe/VOD-Insights/releases) 🚀
