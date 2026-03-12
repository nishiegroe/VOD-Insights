import React from 'react';

import homePage from '../../assets/screenshots/Home Page.png';
import vodPage from '../../assets/screenshots/VOD Page.png';
import vodViewerPage from '../../assets/screenshots/Vod Viewer Page.png';
import vodViewerCreateClip from '../../assets/screenshots/Vod Viewer Create Clip.png';
import clipsPage from '../../assets/screenshots/Clips Page.png';
import clipViewerPage from '../../assets/screenshots/Clip Viewer Page.png';
import scanRecordings from '../../assets/screenshots/Scan Recordings.png';
import scanVodRightside from '../../assets/screenshots/Scan Vod Rightside.png';

const screenshots = [
  { src: homePage, alt: 'Home Page', caption: 'Status and controls overview' },
  { src: vodPage, alt: 'VOD Page', caption: 'VOD library and event navigation' },
  { src: vodViewerPage, alt: 'Vod Viewer', caption: 'Event marker navigation' },
  { src: vodViewerCreateClip, alt: 'Create Clip', caption: 'Clip generation workflow' },
  { src: clipsPage, alt: 'Clips Page', caption: 'Clip library and playback' },
  { src: clipViewerPage, alt: 'Clip Viewer', caption: 'Clip review workflow' },
  { src: scanRecordings, alt: 'Scan Recordings', caption: 'Scan recordings workflow' },
  { src: scanVodRightside, alt: 'Scan Vod Rightside', caption: 'Scan VOD rightside workflow' }
];

export default function Gallery() {
  return (
    <section>
      <h2>Screenshot Gallery</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
        {screenshots.map((shot, i) => (
          <div key={i} style={{ background: 'var(--card)', borderRadius: 12, padding: 12, maxWidth: 220, textAlign: 'center', boxShadow: '0 2px 8px rgba(8,15,18,0.12)' }}>
            <img
              src={shot.src}
              alt={shot.alt}
              className="gallery-img"
              style={{ width: '100%', borderRadius: 8, marginBottom: 8, transition: 'transform 0.25s cubic-bezier(.4,2,.6,1)' }}
            />
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>{shot.caption}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
