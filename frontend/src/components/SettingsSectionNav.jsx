import React from "react";

export default function SettingsSectionNav({ sections, activeSection, jumpToSection }) {
  return (
    <nav className="settings-nav" aria-label="Settings sections">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          className={`settings-nav-link ${activeSection === section.id ? "active" : ""}`}
          onClick={() => jumpToSection(section.id)}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}
