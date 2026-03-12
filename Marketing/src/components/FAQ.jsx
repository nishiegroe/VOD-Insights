import React from 'react';

const faqs = [
  {
    q: 'Does it work with any game?',
    a: 'Yes! You can calibrate the capture area for any overlay or HUD.'
  },
  {
    q: 'Is my data private?',
    a: 'All analysis happens locally on your PC. No uploads or cloud storage.'
  },
  {
    q: 'How accurate is the OCR?',
    a: 'Default Tesseract OCR is reliable for most overlays; GPU EasyOCR is available for complex cases.'
  },
  {
    q: 'Do I need to install extra tools?',
    a: 'No. The installer installs all of the tools for you!'
  },
  {
    q: 'Can I use it offline?',
    a: 'Yes, after first-run setup, everything works offline.'
  }
];

export default function FAQ() {
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
      }}>FAQ</h2>
      <div style={{
        color: '#c7e0f7',
        fontSize: 18,
        lineHeight: 1.7,
        margin: 0,
        textAlign: 'left',
        width: '100%',
        maxWidth: 520,
      }}>
        {faqs.map((f, i) => (
          <div key={i} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{f.q}</div>
            <li style={{ marginLeft: '24px', color: '#c7e0f7' }}>{f.a}</li>
          </div>
        ))}
      </div>
      <br/>
    </section>
  );
}
