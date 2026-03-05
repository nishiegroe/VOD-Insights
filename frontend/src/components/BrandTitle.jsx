import React from "react";

export default function BrandTitle({
  text,
  logoClassName,
  titleClassName,
  as: Tag = "h2",
}) {
  return (
    <Tag className={titleClassName}>
      <img src="/logo.png" alt="" className={logoClassName} aria-hidden="true" />
      <span>{text}</span>
    </Tag>
  );
}
