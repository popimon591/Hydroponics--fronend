// Uses the actual Groxvel brand asset (transparent PNG).
// NEVER emit a duplicate "G" text next to it.
const LOGO_SRC = "/groxvel-logo.png";

export function GroxvelLogo({ height = 32, className = "" }) {
  return (
    <img
      src={LOGO_SRC}
      alt="Groxvel"
      style={{ height, width: "auto", display: "block" }}
      className={`select-none ${className}`}
      draggable={false}
    />
  );
}
