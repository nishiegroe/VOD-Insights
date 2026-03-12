import React from 'react';
import DownloadButton from './DownloadButton';

export default function CTA() {
  return (
    <section style={{ textAlign: 'center', background: 'var(--card)', color: 'white' }}>
      <h2>Ready to save hours during VOD review?</h2>
      <br/>
      <DownloadButton />
      <div style={{ marginTop: 36 }}>
        <a href="https://github.com/nishiegroe/VOD-Insights" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', fontWeight: 600 }}>
          View on GitHub
        </a>
      </div>
    </section>
  );
}
