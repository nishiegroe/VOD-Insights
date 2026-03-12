
import logo from '../../assets/branding/Logo 2.png';
import GithubButton from './GithubButton';
import DownloadButton from './DownloadButton';
import HomePageImg from '../../assets/screenshots/Home Page.png';
import ScanRecordingsImg from '../../assets/screenshots/Scan Recordings.png';
import ScanVodRightsideImg from '../../assets/screenshots/Scan Vod Rightside.png';
import VODPageImg from '../../assets/screenshots/VOD Page.png';
import VodViewerPageImg from '../../assets/screenshots/Vod Viewer Page.png';
import VodViewerCreateClipImg from '../../assets/screenshots/Vod Viewer Create Clip.png';
import ClipsPageImg from '../../assets/screenshots/Clips Page.png';
import ClipViewerPageImg from '../../assets/screenshots/Clip Viewer Page.png';

const galleryImages = [
  VodViewerPageImg,
  VODPageImg,
  HomePageImg,
  // ScanRecordingsImg,
  // ScanVodRightsideImg,
  VodViewerCreateClipImg,
  ClipsPageImg,
  ClipViewerPageImg,
];

import { useState } from 'react';

export default function Hero() {
  const [modalOpen, setModalOpen] = useState(false);
    const [galleryIdx, setGalleryIdx] = useState(0);
  return (
    <section style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '64px 0 48px 0',
      background: 'var(--card)',
      borderRadius: 24,
      boxShadow: '0 8px 32px rgba(8,15,18,0.18)',
      margin: 32,
      maxWidth: 1280,
      marginLeft: 'auto',
      marginRight: 'auto'
    }}>
      <div style={{
        borderRadius: '50%',
        width: 120,
        height: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        overflow: 'visible',
        position: 'relative'
      }}>
        <img src={logo} alt="VOD Insights Logo" className="zoom" style={{ width: 200, height: 200, position: 'relative', zIndex: 2 }} />
      </div>
      <h1 style={{ textAlign: 'center', fontSize: '2.3rem', marginBottom: 22, fontWeight: 700, letterSpacing: '0.01em' }}>
        Automated VOD Analysis for <span style={{ color: 'var(--accent)' }}>Esports Coaches</span> and <span style={{ color: 'var(--accent)' }}>Content Creators</span>
      </h1>
      <div
        style={{
          borderRadius: '30px',
          width: 960,
          height: 560,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
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
        {/* Gallery navigation arrows */}
        <button
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.35)',
            border: 'none',
            borderRadius: '50%',
            color: '#fff',
            fontSize: 28,
            width: 44,
            height: 44,
            cursor: 'pointer',
            zIndex: 2,
            opacity: galleryIdx > 0 ? 1 : 0.5,
          }}
          onClick={e => {
            e.stopPropagation();
            setGalleryIdx(idx => idx === 0 ? galleryImages.length - 1 : idx - 1);
          }}
          aria-label="Previous image"
        >&lt;</button>
        <button
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(0,0,0,0.35)',
            border: 'none',
            borderRadius: '50%',
            color: '#fff',
            fontSize: 28,
            width: 44,
            height: 44,
            cursor: 'pointer',
            zIndex: 2,
          }}
          onClick={e => {
            e.stopPropagation();
            setGalleryIdx(idx => idx === galleryImages.length - 1 ? 0 : idx + 1);
          }}
          aria-label="Next image"
        >&gt;</button>
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
          {/* Modal navigation arrows */}
          <button
            style={{
              position: 'absolute',
              left: 32,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,0.35)',
              border: 'none',
              borderRadius: '50%',
              color: '#fff',
              fontSize: 36,
              width: 56,
              height: 56,
              cursor: 'pointer',
              zIndex: 2,
              opacity: galleryIdx > 0 ? 1 : 0.5,
            }}
            onClick={e => {
              e.stopPropagation();
              setGalleryIdx(idx => idx === 0 ? galleryImages.length - 1 : idx - 1);
            }}
            aria-label="Previous image"
          >&lt;</button>
          <button
            style={{
              position: 'absolute',
              right: 32,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,0.35)',
              border: 'none',
              borderRadius: '50%',
              color: '#fff',
              fontSize: 36,
              width: 56,
              height: 56,
              cursor: 'pointer',
              zIndex: 2,
            }}
            onClick={e => {
              e.stopPropagation();
              setGalleryIdx(idx => idx === galleryImages.length - 1 ? 0 : idx + 1);
            }}
            aria-label="Next image"
          >&gt;</button>
        </div>
      )}
      <br/>
      <span style={{ fontSize: '1.22rem', color: 'var(--muted)', textAlign: 'center', marginBottom: 28, maxWidth: 700 }}>
        Turn hours of gameplay footage into polished, highlight-ready clips in minutes.<br />
        Or prep all the key moments for review with your team.<br/><br/>
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Works with <span style={{fontStyle: 'italic'}}>any</span> game.</span> No <span style={{ color: 'var(--accent)', fontWeight: 600, fontStyle: 'italic' }}>guessing</span> where the action is.
      </span>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
        <GithubButton />
        <DownloadButton />
      </div>
    </section>
  );
}
