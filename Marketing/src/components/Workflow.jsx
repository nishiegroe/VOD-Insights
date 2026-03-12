import React from 'react';

export default function Workflow() {
  return (
    <section
      style={{
        background: 'var(--card)', // matches typical card color
        borderRadius: 16,
        margin: '32px auto',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        maxWidth: 900,
        color: '#eaf6ff',
        fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <h2 style={{
        fontSize: 28,
        fontWeight: 700,
        marginBottom: 18,
        color: '#fff',
        letterSpacing: 0.5,
        textAlign: 'center',
      }}>How It Works</h2>
      <ol style={{
        color: '#c7e0f7',
        fontSize: 18,
        lineHeight: 1.7,
        paddingLeft: 24,
        margin: 0,
        textAlign: 'left',
        width: '100%',
        maxWidth: 520,
      }}>
        <li style={{marginBottom: 8}}>Calibrate killfeed region for your game overlay.</li>
        <li style={{marginBottom: 8}}>Import or scan VODs (local files or Twitch downloads).</li>
        <li style={{marginBottom: 8}}>Let the app detect your events (kills/assists/knocks) automatically.</li>
        <li style={{marginBottom: 8}}>Jump to those key moments in the VOD viewer.</li>
        <li>Auto-split and export clips with smart naming.</li>
        
      </ol>
      <br/>
    </section>
  );
}
