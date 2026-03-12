import React from 'react';

export default function Requirements() {
  return (
    <section
      style={{
        background: 'var(--card)',
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
      }}>Requirements & Trust</h2>
      <ul style={{
        color: '#c7e0f7',
        fontSize: 18,
        lineHeight: 1.7,
        paddingLeft: 24,
        margin: 0,
        textAlign: 'left',
        width: '100%',
        maxWidth: 520,
      }}>
        <li style={{marginBottom: 8}}>Windows 10 or 11 (64-bit)</li>
        <li style={{marginBottom: 8}}>Runs entirely locally &mdash; no cloud dependencies</li>
        <li style={{marginBottom: 8}}>Open-source (MIT License)</li>
        <li>Installer auto-bundles FFmpeg and tools</li>
      </ul>
      <br/>
    </section>
  );
}
