import React from 'react';

const features = [  
  {
    emoji: '📸',
    title: 'Any Recording Source',
    desc: 'Scan VODs from any source: OBS, X-Split, Twitch, and more'
  },
  {
    emoji: '🎬',
    title: 'Smart-Split Clips',
    desc: 'Groups nearby events into a single highlight clip for seamless playback'
  },
  {
    emoji: '🎬',
    title: 'Split VODs into Clips',
    desc: 'Split an entire VOD into many clips and highlights, with a click of a button'
  },
  {
    emoji: '🕹️',
    title: 'Game-Agnostic',
    desc: 'Works with any game overlay, HUD, or resolution.'
  },
  {
    emoji: '🔍',
    title: 'Killfeed OCR Scanning',
    desc: `Automatically detects events such as kill/assist/knock/etc for VOD analysis.`
  },
  {
    emoji: '⚡',
    title: 'GPU OCR Option',
    desc: 'Supports NVIDIA GPU acceleration for complex overlays or longer VOD sessions.'
  },
  {
    emoji: '📥',
    title: 'Twitch VOD Download',
    desc: 'Import and analyze VODs from Twitch channels directly.'
  },
  {
    emoji: '📝',
    title: 'Event Logs Export',
    desc: 'Export event data for integration or analysis.'
  }
];

export default function Features() {
  return (
    <section style={{ maxWidth: 900, margin: '0 auto 48px auto', padding: '32px 0' }}>
      <h2 style={{ textAlign: 'center', fontSize: '1.7rem', marginBottom: 32 }}>Key Features</h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 32,
        justifyContent: 'center',
        alignItems: 'stretch',
        margin: '0 auto',
        maxWidth: 800,
        padding: '0 16px'
      }}>
        {features.map((f, i) => (
          <div className="zoom-s" key={i} style={{
            background: 'var(--card)',
            borderRadius: 18,
            padding: '28px 18px',
            boxShadow: '0 4px 16px rgba(8,15,18,0.10)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minHeight: 180,
            transition: 'box-shadow 0.2s',
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{f.emoji}</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 8, color: 'var(--accent)' }}>{f.title}</div>
            <div style={{ color: 'var(--muted)', textAlign: 'center', fontSize: '1rem' }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
