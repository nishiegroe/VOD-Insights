import React, { useEffect, useState } from 'react';

export default function DownloadButton() {
  const [installerUrl, setInstallerUrl] = useState(null);
  const [version, setVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchLatestRelease() {
      try {
        // Fetched from same origin to avoid CORS issues with the NAS share URL.
        // In dev, Vite proxies /latest.json to the NAS automatically.
        // In production, Marketing/public/latest.json is baked into the build.
        const res = await fetch("/latest.json");
        if (!res.ok) throw new Error('Failed to fetch release');
        const data = await res.json();
        setVersion(data.version);
        setInstallerUrl(data.installer.url);
      } catch (e) {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchLatestRelease();
  }, []);

  if (loading) {
    return <a className="cta-btn" style={{ fontSize: '1.15rem', padding: '16px 40px', borderRadius: 16, marginTop: 8, boxShadow: '0 4px 16px rgba(255,179,71,0.18)', opacity: 0.7, pointerEvents: 'none' }}>Loading...</a>;
  }
  if (error || !installerUrl) {
    return <a className="cta-btn" style={{ fontSize: '1.15rem', padding: '16px 40px', borderRadius: 16, marginTop: 8, boxShadow: '0 4px 16px rgba(255,179,71,0.18)', opacity: 0.7, pointerEvents: 'none' }}>Download Unavailable</a>;
  }
  return (
    <a
      className="cta-btn"
      href={installerUrl}
      download
      style={{ fontSize: '1.15rem', padding: '16px 40px', borderRadius: 16, marginTop: 8, boxShadow: '0 4px 16px rgba(255,179,71,0.18)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '12px' }}
    >
      Download VOD Insights
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ verticalAlign: 'middle' }}>
        <path d="M12 16V4" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 12L12 16L16 12" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="4" y="18" width="16" height="2" rx="1" fill="black"/>
      </svg>
    </a>
  );
}
