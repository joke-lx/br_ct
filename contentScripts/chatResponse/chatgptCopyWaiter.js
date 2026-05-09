export function waitForValue(getter, { timeoutMs = 1200, intervalMs = 30 } = {}) {
  return new Promise((resolve) => {
    const start = Date.now();

    function tick() {
      let v = null;
      try {
        v = getter();
      } catch {
        v = null;
      }

      if (typeof v === "string" && v.trim()) {
        resolve(v);
        return;
      }

      if (Date.now() - start >= timeoutMs) {
        resolve(null);
        return;
      }

      setTimeout(tick, intervalMs);
    }

    tick();
  });
}
