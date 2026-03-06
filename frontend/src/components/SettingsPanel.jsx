import React from "react";

export default function SettingsPanel({ sectionId, bindSectionRef, title, subtitle, children }) {
  return (
    <section
      className="settings-panel"
      ref={sectionId ? bindSectionRef(sectionId) : undefined}
      data-section-id={sectionId || undefined}
    >
      {title ? <h3>{title}</h3> : null}
      {subtitle ? <p className="hint">{subtitle}</p> : null}
      {children}
    </section>
  );
}
