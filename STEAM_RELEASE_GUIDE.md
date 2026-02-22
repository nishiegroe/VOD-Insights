# Steam Release Guide - Apex Event Tracker

This guide outlines the steps needed to release Apex Event Tracker on Steam.

## Technical Requirements

### 1. Build & Packaging
- ✅ **Licensing compliance** - LGPL FFmpeg now in place
- ✅ **Create installer** - Use NSIS, Inno Setup, or Steam's built-in installer
- ✅ **Test on clean system** - Verify on Windows without dev tools installed
- **Code signing** - Sign executable with certificate (optional but recommended for trust)
- ✅ **Bundle dependencies** - Ensure no missing DLLs or runtime requirements

### 2. Steamworks Integration (Optional but Recommended)
Download Steamworks SDK and implement:
- **Steam initialization** - Add `steam_api.dll`
- **Steam overlay support** - Allow users to access Steam overlay
- **Cloud saves** - Sync bookmarks/configs across devices
- **Achievements** - Examples:
  - "First 100 kills tracked"
  - "Analyzed 10 hours of gameplay"
  - "Created 50 clips"
- **Steam Input API** - Controller support if applicable
- **Rich presence** - Show what user is doing ("Analyzing replay", "Reviewing bookmarks")

### 3. System Requirements Testing
- **Define specs** - Document minimum and recommended hardware
- **Test low-end hardware** - Verify Tesseract OCR performance
- **Benchmark capture** - Ensure dxcam/mss work on various systems

## Business/Admin Requirements

### 4. Steam Partner Account
- Register at [partner.steamgames.com](https://partner.steamgames.com)
- Pay **$100 USD** Steamworks Direct fee (one-time per app)
  - Recoups after $1,000 in adjusted gross revenue
- Complete tax forms (W-8 for non-US, W-9 for US)
- Approval takes 1-2 weeks

### 5. Store Page Assets
Required images and media:

**Capsule Images:**
- Header: 460×215px
- Small: 231×87px
- Main: 616×353px
- Vertical: 374×448px
- Hero: 3840×1240px (optional)

**Screenshots:**
- Minimum: 5 screenshots
- Recommended: 1920×1080
- Show key features: OCR detection, bookmark list, clip export, VOD analysis

**Trailer:**
- 1080p video
- Showcase workflow: "Record → Auto-detect → Export clips → Share"
- 30-90 seconds optimal length

**Text Content:**
- App description (full store page text)
- Short description (one-liner pitch)
- Tags/categories (Utilities, Game Recording, Tools)

### 6. Legal/Compliance

**EULA/Terms of Service:**
- Steam's default TOS often sufficient
- Or write custom EULA for specific restrictions

**Privacy Policy:**
- Required if collecting any user data (even crash reports)
- State what data is stored locally vs. transmitted

**Age Rating:**
- Complete IARC questionnaire on Steam
- Likely rating: Everyone/PEGI 3 (utilities/tools)

**Credits:**
- Acknowledge third-party software
- ✅ Already covered in `THIRD_PARTY_NOTICES.txt`

### 7. Pricing & Distribution

**Pricing Strategy:**
- Set base price (Steam takes 30% revenue cut)
- Consider pricing tiers: $9.99, $14.99, $19.99
- Regional pricing adjustment (Steam assists with recommendations)

**Territories:**
- Choose countries/regions for distribution
- Consider excluded regions for legal/support reasons

**Discounts:**
- Launch discount (10-20% optional)
- Seasonal sales participation
- Bundle opportunities

## Pre-Launch

### 8. Build Upload

**Steamworks SDK Builder:**
- Install Steamworks SDK tools
- Create "depots" for distribution:
  - Windows x64 build (primary)
  - Optional: separate depot for large assets

**Upload Process:**
- Use Steam CMD or ContentBuilder GUI
- Configure launch options and install scripts
- Set install directory and shortcuts
- Document install size

**Build Configuration:**
- Set default executable
- Configure launch parameters if needed
- Test install/uninstall flow

### 9. Beta Testing

**Setup:**
- Create beta branch on Steam
- Generate Steam keys for testers
- Recruit beta testers (friends, community, Reddit)

**Feedback Collection:**
- Monitor crash reports
- Collect usability feedback
- Test on various hardware configs
- Iterate based on feedback

**Duration:**
- Recommended: 2-4 weeks minimum
- Address critical bugs before launch

## Marketing

### 10. Community & Visibility

**Steam Community:**
- Set up community hub
- Enable discussions and guides
- Encourage user-generated content (guides, tips)

**Social Media:**
- Announce on Reddit:
  - r/apexlegends
  - r/pcgaming
  - r/gamedev
  - r/software
- Twitter/X announcements
- Gaming Discord servers

**Press/Content Creators:**
- Create press kit with screenshots and key info
- Reach out to gaming YouTubers/streamers
- Apex Legends content creators (target audience)

**Launch Strategy:**
- Plan announcement timing
- Consider launch discount
- Coordinate social media posts
- Email announcement if you have mailing list

## Post-Launch

### 11. Updates & Support

**Ongoing Maintenance:**
- Regular updates for bug fixes
- New feature development based on feedback
- Stay updated with Apex Legends game changes

**Community Management:**
- Monitor Steam discussions daily
- Respond to reviews (especially negative)
- Address support requests promptly
- Build community trust

**Analytics:**
- Steam provides:
  - Download statistics
  - Revenue reports
  - Regional breakdown
  - User reviews/ratings
- Use data to inform updates

**Update Cadence:**
- Hotfixes: As needed for critical bugs
- Minor updates: Monthly
- Major features: Quarterly

## Immediate Next Steps

1. **Register Steam Partner account** (1-2 weeks for approval)
2. **Create store page assets:**
   - Design capsule images
   - Take/edit screenshots
   - Record trailer video
3. **Build installer and test:**
   - Test on clean Windows install
   - Verify all dependencies bundled
   - Check licensing compliance
4. **Write privacy policy** (if storing any user data)
5. **Complete IARC age rating questionnaire**

## Resources

- **Steamworks Documentation:** [partner.steamgames.com/doc/home](https://partner.steamgames.com/doc/home)
- **Steamworks SDK:** Available after partner registration
- **Steam Community:** [steamcommunity.com/dev](https://steamcommunity.com/dev)

## Notes

- **Timeline:** Plan for 2-3 months from registration to launch
- **Budget:** $100 app fee + optional marketing costs
- **Support:** Be prepared for ongoing customer support commitment
- **Visibility:** Steam algorithm favors positive reviews and engagement

---

**Questions or need help with specific steps?** Common assistance areas:
- Inno Setup installer script
- Store page text/description
- Privacy policy template
- Achievement ideas
- Trailer storyboard
