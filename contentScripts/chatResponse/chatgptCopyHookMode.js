const DEFAULT_WINDOW_MS = 2500;

export function shouldInterceptCopyEvent(ctx, now) {
  if (!ctx) return false;
  const windowMs = ctx.windowMs || DEFAULT_WINDOW_MS;
  return (now - ctx.openedAt) <= windowMs;
}
