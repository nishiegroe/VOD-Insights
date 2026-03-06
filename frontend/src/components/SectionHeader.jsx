import React from "react";

export default function SectionHeader({ title, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
      <h2 style={{ margin: 0 }}>{title}</h2>
      {action || null}
    </div>
  );
}
