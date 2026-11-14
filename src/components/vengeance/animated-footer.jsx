/* Vengeance UI — animated-footer (MIT, © Ashutoshx7; ported from LukeBaffait's
   animated footer). Ported from the registry TSX.
   Aegis adaptations: JSX, light-only (no next-themes), our own same-origin SVG
   artwork instead of the demo hand photos, render loop paused while off-screen,
   no parallax/reveal for reduced-motion users, heading exposed as one text node
   for screen readers, optional children rendered above the art. */
import React, { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

const DEFAULT_ASCII_CHARS = "........:::=+xX#0369";
const HIGHLIGHT_LIFETIME = 300;
const CLUSTER_SIZE = 10;
const PARALLAX_EASE = 0.05;

function buildCells(image, columns, asciiChars) {
  const rows = Math.max(1, Math.round(columns / (image.naturalWidth / image.naturalHeight || 1)));
  const sampler = document.createElement("canvas");
  sampler.width = columns;
  sampler.height = rows;
  const sctx = sampler.getContext("2d");
  const cells = new Map();
  if (!sctx) return { rows, cells };
  sctx.fillStyle = "#fff";
  sctx.fillRect(0, 0, columns, rows);
  sctx.drawImage(image, 0, 0, columns, rows);
  const px = sctx.getImageData(0, 0, columns, rows).data;
  const bg = asciiChars.lastIndexOf(".");
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const o = (row * columns + col) * 4;
      const brightness = (px[o] * 0.299 + px[o + 1] * 0.587 + px[o + 2] * 0.114) / 255;
      const ci = Math.min(asciiChars.length - 1, Math.floor((1 - brightness) * asciiChars.length));
      if (ci <= bg) continue;
      cells.set(`${col},${row}`, { col, row, char: asciiChars[ci], highlightEndTime: 0 });
    }
  }
  return { rows, cells };
}

function highlightCluster(cells, start) {
  const now = Date.now();
  start.highlightEndTime = now + HIGHLIGHT_LIFETIME;
  const steps = Math.floor(Math.random() * CLUSTER_SIZE) + 1;
  const lit = [start];
  let current = start;
  for (let step = 0; step < steps; step++) {
    const nb = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const c = cells.get(`${current.col + dx},${current.row + dy}`);
      if (c && !lit.includes(c)) nb.push(c);
    }
    if (!nb.length) break;
    const next = nb[Math.floor(Math.random() * nb.length)];
    next.highlightEndTime = now + HIGHLIGHT_LIFETIME + step * 10;
    lit.push(next);
    current = next;
  }
}

export function AnimatedFooter({
  headingLines = ["AEGIS"],
  leftImage = "/footer/shield.svg",
  rightImage = "/footer/phone.svg",
  background = "#f5f8ff",
  textColor = "#0b1b3a",
  charColor = "#b9cdf3",
  hoverColor = "#2563eb",
  hoverCharColor = "#ffffff",
  asciiChars = DEFAULT_ASCII_CHARS,
  columns = 64,
  cellSize = 20,
  fontSize = 18,
  parallaxStrength = 16,
  hoverRadius = 8,
  className,
  children,
}) {
  const rootRef = useRef(null);
  const leftWrapRef = useRef(null);
  const rightWrapRef = useRef(null);
  const leftCanvasRef = useRef(null);
  const rightCanvasRef = useRef(null);
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reveal = !reduce;

  const sig = useMemo(
    () => JSON.stringify({ leftImage, rightImage, columns, cellSize, fontSize, asciiChars, headingLines }),
    [leftImage, rightImage, columns, cellSize, fontSize, asciiChars, headingLines],
  );

  useEffect(() => {
    const root = rootRef.current;
    const wrappers = [leftWrapRef.current, rightWrapRef.current];
    if (!root || wrappers.some((w) => !w)) return undefined;
    const hands = [];

    const setup = (image, canvas) => {
      const { rows, cells } = buildCells(image, columns, asciiChars);
      if (!cells.size) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = columns * cellSize * dpr;
      canvas.height = rows * cellSize * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      const m = ctx.measureText("X");
      const gh = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      hands.push({ canvas, ctx, cells, cellList: [...cells.values()], rows, columns, cellSize, baselineOffset: cellSize / 2 + gh / 2 - m.actualBoundingBoxDescent });
      draw(Date.now());
    };
    const load = (src, canvas) => {
      if (!src || !canvas) return;
      const img = new Image();
      let done = false;
      const init = () => { if (!done) { done = true; setup(img, canvas); } };
      img.onload = init;
      img.src = src;
      if (img.complete && img.naturalWidth) init();
    };
    load(leftImage, leftCanvasRef.current);
    load(rightImage, rightCanvasRef.current);

    const renderHand = (h, now) => {
      const { ctx, cellList, cellSize: cs, baselineOffset, columns: cols, rows } = h;
      ctx.clearRect(0, 0, cols * cs, rows * cs);
      for (const cell of cellList) {
        const x = cell.col * cs;
        const y = cell.row * cs;
        const lit = cell.highlightEndTime > now;
        if (lit) { ctx.fillStyle = hoverColor; ctx.fillRect(x, y, cs, cs); }
        ctx.fillStyle = lit ? hoverCharColor : charColor;
        ctx.fillText(cell.char, x + cs / 2, y + baselineOffset);
      }
    };
    const draw = (now) => { for (const h of hands) renderHand(h, now); };

    const pointer = { x: 0, y: 0 };
    const drift = { x: 0, y: 0 };
    const curtain = { offset: reveal ? 125 : 0 };

    const hover = (h, cx, cy) => {
      const r = h.canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const mc = ((cx - r.left) / r.width) * h.columns;
      const mr = ((cy - r.top) / r.height) * h.rows;
      let best = null;
      let bestD = Infinity;
      for (const c of h.cellList) {
        const d = Math.hypot(mc - c.col, mr - c.row);
        if (d < bestD) { bestD = d; best = c; }
      }
      if (best && bestD <= hoverRadius) highlightCluster(h.cells, best);
    };
    const onMove = (e) => {
      const r = root.getBoundingClientRect();
      if (e.clientY < r.top - 40 || e.clientY > r.bottom) return;
      pointer.x = ((e.clientX - r.left) / (r.width || 1) - 0.5) * parallaxStrength * 2;
      pointer.y = ((e.clientY - r.top) / (r.height || 1) - 0.5) * parallaxStrength * 2;
      for (const h of hands) hover(h, e.clientX, e.clientY);
    };
    if (!reduce) window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0;
    let running = false;
    const frame = () => {
      draw(Date.now());
      drift.x += (pointer.x - drift.x) * PARALLAX_EASE;
      drift.y += (pointer.y - drift.y) * PARALLAX_EASE;
      const scale = 1 + (parallaxStrength * 2) / 200;
      wrappers.forEach((w, i) => {
        const dir = i === 0 ? 1 : -1;
        const rx = i === 0 ? -curtain.offset : curtain.offset;
        w.style.transform = `translateX(${rx}%) translate(${drift.x * dir || 0}px, ${-drift.y || 0}px) scale(${scale})`;
      });
      raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!running && !reduce) { running = true; raf = requestAnimationFrame(frame); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    const chars = gsap.utils.toArray(root.querySelectorAll("[data-af-char]"));
    const animateIn = () => {
      gsap.to(curtain, { offset: 0, duration: 1, ease: "power3.out", overwrite: true });
      gsap.to(chars, { yPercent: 0, duration: 1, ease: "power3.out", stagger: { each: 0.05, from: "center" }, overwrite: true });
    };
    const animateOut = () => {
      gsap.to(curtain, { offset: 125, duration: 0.4, ease: "power2.in", overwrite: true });
      gsap.to(chars, { yPercent: 125, duration: 0.4, ease: "power2.in", stagger: { each: 0.01, from: "center" }, overwrite: true });
    };

    let revealed = false;
    if (reveal) gsap.set(chars, { yPercent: 125 });
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        start();
        if (reveal && !revealed && entry.intersectionRatio >= 0.3) { revealed = true; animateIn(); }
      } else {
        stop();
        if (reveal && revealed) { revealed = false; animateOut(); }
      }
    }, { threshold: [0, 0.3] });
    io.observe(root);

    return () => {
      stop();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      gsap.killTweensOf([curtain, ...chars]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const off = reveal ? 125 : 0;
  return (
    <footer
      ref={rootRef}
      className={cn("relative w-full overflow-hidden", className)}
      style={{ backgroundColor: background, color: textColor, containerType: "inline-size" }}
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-between" aria-hidden="true">
        <div ref={leftWrapRef} className="relative w-2/5 min-w-[160px] will-change-transform" style={{ transform: `translateX(-${off}%)` }}>
          <canvas ref={leftCanvasRef} className="block h-auto w-full" />
        </div>
        <div ref={rightWrapRef} className="relative w-2/5 min-w-[160px] will-change-transform" style={{ transform: `translateX(${off}%)` }}>
          <canvas ref={rightCanvasRef} className="block h-auto w-full" />
        </div>
      </div>
      {children && <div className="relative z-10">{children}</div>}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-4 p-6 md:p-8">
        {headingLines.map((word, wi) => (
          <p key={`${word}-${wi}`} className="overflow-hidden font-semibold leading-none tracking-tight pb-[0.15em] -mb-[0.15em] m-0" style={{ fontSize: "clamp(3rem, 15cqw, 12rem)" }}>
            <span className="sr-only">{word}</span>
            {Array.from(word).map((ch, ci) => (
              <span key={ci} data-af-char aria-hidden="true" className="inline-block">{ch === " " ? " " : ch}</span>
            ))}
          </p>
        ))}
      </div>
    </footer>
  );
}

export default AnimatedFooter;
