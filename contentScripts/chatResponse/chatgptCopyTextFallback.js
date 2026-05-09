export function chooseCopyText(capturedText, domText) {
  const a = typeof capturedText === "string" ? capturedText.trim() : "";
  if (a) return capturedText;
  const b = typeof domText === "string" ? domText.trim() : "";
  if (b) return domText;
  return null;
}
