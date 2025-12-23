(() => {
  // 清除旧的波浪层
  const old = document.getElementById("realistic-waves");
  if (old) old.remove();

  // 创建 canvas
  const canvas = document.createElement("canvas");
  canvas.id = "realistic-waves";
  Object.assign(canvas.style, {
    position: "fixed",
    left: 0,
    bottom: 0,
    width: "100%",
    height: "25vh",
    zIndex: 9999,
    pointerEvents: "none",
  });
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  let w, h, t = 0;

  const resize = () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = canvas.offsetHeight;
  };
  resize();
  window.addEventListener("resize", resize);

  // 简易 Perlin 噪声函数
  const noise = (() => {
    const p = Array.from({ length: 512 }, () => Math.random());
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    return (x) => {
      const i = Math.floor(x) & 255;
      const f = x - Math.floor(x);
      const u = fade(f);
      return (1 - u) * p[i] + u * p[i + 1];
    };
  })();

  function draw() {
    ctx.clearRect(0, 0, w, h);
    t += 0.01;

    // 多层叠加波
    for (let layer = 0; layer < 3; layer++) {
      const amp = 20 + layer * 10;
      const wl = 150 + layer * 60;
      const spd = 0.3 + layer * 0.15;
      const offset = layer * 30;

      ctx.beginPath();
      for (let x = 0; x <= w; x++) {
        const nx = x / wl;
        const y = h - 40 - offset
          + amp * Math.sin(nx * 2 * Math.PI + t * spd)
          + 10 * noise(nx * 3 + t * 0.7 + layer * 10);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();

      const color = `rgba(${30 + layer * 20}, ${120 + layer * 50}, ${200 + layer * 30}, ${0.7 - layer * 0.2})`;
      ctx.fillStyle = color;
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  draw();
  console.log("%c🌊 实体不规则海浪已创建", "color:#00bfff;font-size:16px");
})();
