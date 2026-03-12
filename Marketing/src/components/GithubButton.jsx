import React from 'react';

// Direct link to the latest installer asset
const installerUrl = 'https://github.com/nishiegroe/VOD-Insights/releases/download/v1.2.2/VODInsights-Setup-1.2.2.exe';

export default function DownloadButton() {
  return (
    <a
      className="cta-btn"
      href="https://github.com/nishiegroe/VOD-Insights"
      target="_blank"
      rel="noopener noreferrer"
      style={{ fontSize: '1.15rem', padding: '16px 40px', borderRadius: 16, marginTop: 8, boxShadow: '0 4px 16px rgba(255,179,71,0.18)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '12px' }}
    >
      View Github
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle' }}>
        <path d="M12 2C6.48 2 2 6.58 2 12.25C2 17.02 5.58 21.1 10.26 22C10.77 22.09 10.97 21.77 10.97 21.5C10.97 21.27 10.96 20.68 10.96 19.97C7.73 20.67 7.04 18.61 7.04 18.61C6.54 17.34 5.81 17.01 5.81 17.01C4.74 16.29 5.89 16.31 5.89 16.31C7.06 16.4 7.66 17.56 7.66 17.56C8.72 19.36 10.54 18.81 11.23 18.54C11.33 17.81 11.61 17.32 11.91 17.06C9.09 16.8 6.13 15.81 6.13 11.47C6.13 10.27 6.58 9.29 7.29 8.53C7.18 8.27 6.79 7.09 7.39 5.54C7.39 5.54 8.32 5.25 10.96 6.82C11.87 6.57 12.83 6.45 13.79 6.45C14.75 6.45 15.71 6.57 16.62 6.82C19.26 5.25 20.19 5.54 20.19 5.54C20.79 7.09 20.4 8.27 20.29 8.53C21 9.29 21.45 10.27 21.45 11.47C21.45 15.82 18.48 16.8 15.66 17.06C16.06 17.41 16.41 18.09 16.41 19.06C16.41 20.32 16.4 21.23 16.4 21.5C16.4 21.77 16.6 22.09 17.11 22C21.79 21.1 25.37 17.02 25.37 12.25C25.37 6.58 20.89 2 15.37 2H12Z" fill="black"/>
      </svg>
    </a>
  );
}
