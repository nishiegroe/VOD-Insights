import React from 'react';
import Hero from './components/Hero';
import Features from './components/Features';
import Gallery from './components/Gallery';
import Workflow from './components/Workflow';
import Requirements from './components/Requirements';
import FAQ from './components/FAQ';
import CTA from './components/CTA';
import HeroWide from './components/HeroWide';
import logo from '../assets/branding/Logo 2.png';
import BYOVODS from './components/BYOVODS';
import Clips from './components/Clips';


export default function App() {
  return (
    <div className="app-bg">
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center', // vertical centering
        justifyContent: 'center',
        marginTop: 32,
        marginBottom: 48,
        width: '100%'
      }}>
        <div style={{
          borderRadius: '50%',
          width: 120,
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
          position: 'relative',
          marginRight: 32 // keep spacing between logo and text
        }}>
          <img src={logo} alt="VOD Insights Logo" className="zoom" style={{ width: 120, height: 120, position: 'relative', zIndex: 2 }} />
        </div>
        <h1 style={{
          textAlign: 'left',
          fontSize: '4rem',
          fontWeight: 700,
          letterSpacing: '0.01em',
          display: 'flex',
          marginTop: 'auto',
          alignItems: 'center' // ensure text is vertically centered with logo
        }}>
          VOD Insights
        </h1>
      </div>
      <HeroWide />
      <BYOVODS />
      <Clips />
      {/* <Hero /> */}
      <Features />
      {/* <Gallery /> */}
      <Workflow />
      <Requirements />
      <FAQ />
      <CTA />
    </div>
  );
}
