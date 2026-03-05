import React from "react";
import BrandTitle from "./BrandTitle";

export default function WelcomeSetupCard({ onChooseDirectory }) {
  return (
    <section className="card centered" style={{ padding: "3rem 2rem" }}>
      <BrandTitle
        as="h2"
        text="Welcome to VOD Insights!"
        logoClassName="brand-logo brand-logo-welcome"
        titleClassName="brand-title brand-title-welcome"
      />
      <p style={{ fontSize: "1.1rem", marginBottom: "1.5rem", color: "var(--text-secondary)" }}>
        To get started, you need to configure where your Apex Legends recordings are stored.
      </p>
      <p style={{ marginBottom: "2rem", color: "var(--text-secondary)" }}>
        Point the app to your recordings directory, and it will automatically detect and list your VODs.
        No need to manually import files!
      </p>
      <button
        type="button"
        className="primary"
        style={{ fontSize: "1.1rem", padding: "0.75rem 2rem" }}
        onClick={onChooseDirectory}
      >
        Choose VOD Directory
      </button>
    </section>
  );
}
