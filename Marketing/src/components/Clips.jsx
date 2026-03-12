import { useState } from 'react';
import ClipsPage from '../../assets/screenshots/Clips Page.png';

const galleryImages = [
  ClipsPage,
];

export default function Clips() {
  const [modalOpen, setModalOpen] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);

  return (
    <section style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '64px 0 48px 0',
      background: 'var(--card)',
      borderRadius: 24,
      boxShadow: '0 8px 32px rgba(8,15,18,0.18)',
      margin: 32,
      maxWidth: 1920,
      marginLeft: 'auto',
      marginRight: 'auto',
    }}>
      {/* Left: image with modal */}
      <div>
        <div
          style={{
            borderRadius: '30px',
            width: 960,
            height: 560,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 18,
            marginLeft: 32,
            boxShadow: '0 12px 64px rgba(255,179,71,0.18)',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
          }}
          onClick={() => setModalOpen(true)}
          title="Click to expand"
        >
          <img src={galleryImages[galleryIdx]} style={{ width: 960, height: 560, borderRadius: '30px', transition: 'box-shadow 0.2s' }} alt={`Gallery Screenshot ${galleryIdx + 1}`} />
          {/* Overlay for click-to-expand cue */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'linear-gradient(0deg, rgba(0,0,0,0.18) 70%, rgba(0,0,0,0.04) 100%)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              pointerEvents: 'none',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(0,0,0,0.55)',
              color: '#fff',
              borderRadius: 12,
              padding: '8px 18px',
              fontSize: 16,
              fontWeight: 600,
              margin: 24,
              boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
              userSelect: 'none',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginRight: 4}}><rect x="3" y="3" width="7" height="7" rx="2" stroke="#fff" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="2" stroke="#fff" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="2" stroke="#fff" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="2" stroke="#fff" strokeWidth="2"/></svg>
              Click to expand
            </div>
          </div>
        </div>
        {modalOpen && (
          <div
            onClick={() => setModalOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0,0,0,0.4)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'zoom-out',
            }}
          >
            <img
              src={galleryImages[galleryIdx]}
              alt={`Gallery Screenshot ${galleryIdx + 1}`}
              style={{
                maxWidth: '92vw',
                maxHeight: '92vh',
                borderRadius: 24,
                boxShadow: '0 8px 64px rgba(0,0,0,0.45)',
                background: '#222',
              }}
            />
          </div>
        )}
      </div>
      {/* Right: stacked content */}
      <div style={{textAlign: 'center', alignItems: 'center', display: 'flex', flexDirection: 'column', gap: 32, marginLeft: 48, margin: '48px'}}>
        <h1 style={{ textAlign: 'center', fontSize: '2.3rem', marginBottom: 0, fontWeight: 700, letterSpacing: '0.01em' }}>
          View all of your <span style={{color: 'var(--accent)'}}>clips, highlights, and key moments</span> in one place!
        </h1>
        <span style={{ fontSize: '1.22rem', color: 'var(--muted)', textAlign: 'center', margin: '32px 0', maxWidth: 700 }}>
          We point out which clips are statistically better or worse than your average, so you can quickly find the moments that matter and share them with your friends!
          <br/><br/>
          At a glipse you can see which game they were from, and how many kills, deaths, and assists you had in that clip!
        </span>
      </div>
    </section>
  );
}
