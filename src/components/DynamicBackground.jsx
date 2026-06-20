import { useEffect, useRef } from 'react';

function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  return { width, height };
}

function drawSoftField(ctx, width, height, time) {
  const base = ctx.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, '#d7dde1');
  base.addColorStop(0.42, '#b9c2c8');
  base.addColorStop(1, '#89949d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const glowX = width * (0.52 + Math.sin(time * 0.18) * 0.05);
  const glowY = height * (0.45 + Math.cos(time * 0.15) * 0.04);
  const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, Math.max(width, height) * 0.74);
  glow.addColorStop(0, 'rgba(255,255,255,0.62)');
  glow.addColorStop(0.44, 'rgba(235,241,244,0.28)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  for (let i = 0; i < 4; i += 1) {
    const y = height * (0.22 + i * 0.2) + Math.sin(time * (0.22 + i * 0.05)) * height * 0.045;
    const wave = height * (0.05 + i * 0.008);
    const offset = time * (0.16 + i * 0.04);
    const fill = ctx.createLinearGradient(0, y - wave * 2, width, y + wave * 2);
    fill.addColorStop(0, 'rgba(255,255,255,0)');
    fill.addColorStop(0.5, i % 2 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(71,87,99,0.12)');
    fill.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= width; x += width / 18) {
      const yy = y + Math.sin((x / width + offset) * Math.PI * 2) * wave;
      ctx.lineTo(x, yy);
    }
    ctx.lineTo(width, y + wave * 3.2);
    ctx.lineTo(0, y + wave * 3.2);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.restore();

  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.48,
    Math.min(width, height) * 0.16,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.78,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(0.72, 'rgba(32,42,50,0.08)');
  vignette.addColorStop(1, 'rgba(18,26,34,0.34)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

export default function DynamicBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return undefined;

    let rafId = 0;
    const render = (now) => {
      const { width, height } = fitCanvas(canvas);
      drawSoftField(ctx, width, height, now / 1000);
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return <canvas className="dynamic-background-canvas" ref={canvasRef} aria-hidden="true" />;
}
