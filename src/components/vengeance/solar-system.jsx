/* Vengeance UI — solar-system (MIT, © Ashutoshx7). Ported from src/components/ui/solar-system.tsx.
   Aegis adaptations: JSX, white & blue styling, keyframes/radius variables scoped to
   the component (not :root), orbit items supplied by the page, decorative motion
   hidden from screen readers (pass `label` for a text alternative), and animation
   paused for reduced-motion users. */
import React, { useState } from "react";
import { cn } from "@/lib/utils";

const CSS = `
.ss-root { --radius-inner: 150px; --radius-mid: 235px; --radius-outer: 320px; }
@media (max-width: 768px) { .ss-root { --radius-inner: 92px; --radius-mid: 140px; --radius-outer: 188px; } }
@media (max-width: 480px) { .ss-root { --radius-inner: 70px; --radius-mid: 108px; --radius-outer: 146px; } }
@keyframes ss-orbit { 0% { transform: translate(-50%, -50%) rotateZ(0deg) translateX(var(--orbit-radius)); } 100% { transform: translate(-50%, -50%) rotateZ(-360deg) translateX(var(--orbit-radius)); } }
@keyframes ss-billboard { 0% { transform: translate(-50%, -50%) rotateZ(0deg) rotateY(10deg) rotateX(-65deg); } 100% { transform: translate(-50%, -50%) rotateZ(360deg) rotateY(10deg) rotateX(-65deg); } }
@keyframes ss-pulse { 0% { transform: scale(0.9); opacity: 0.6; } 100% { transform: scale(1.1); opacity: 1; } }
@keyframes ss-cw { 0% { transform: rotateX(65deg) rotateY(-10deg) rotateZ(0deg); } 100% { transform: rotateX(65deg) rotateY(-10deg) rotateZ(360deg); } }
.ss-orbit { animation: ss-orbit var(--orbit-duration) linear infinite; animation-play-state: var(--orbit-play-state); }
.ss-billboard { animation: ss-billboard var(--orbit-duration) linear infinite; animation-play-state: var(--orbit-play-state); }
.ss-pulse { animation: ss-pulse 4s ease-in-out infinite alternate; }
.ss-card {
  position: absolute; left: 50%; top: 50%; display: flex; align-items: center; gap: 8px;
  padding: 0.45rem 0.9rem; background: rgba(255, 255, 255, 0.92); border: 1px solid #dbe5f6;
  border-radius: 100px; font-weight: 600; color: #0b1b3a; white-space: nowrap; user-select: none;
  pointer-events: auto; transition: border-color .3s, box-shadow .3s, scale .3s;
  box-shadow: 0 6px 18px -8px rgba(30, 58, 138, 0.28);
}
@media (prefers-reduced-motion: reduce) { .ss-orbit, .ss-billboard, .ss-pulse { animation-play-state: paused !important; } }
`;

export const SolarSystem = React.forwardRef(function SolarSystem(
  { center, orbits = [], isPaused = false, speedMultiplier = 1, accent = "#2563eb", label, className, ...props },
  ref,
) {
  const [hoveredId, setHoveredId] = useState(null);
  const play = isPaused ? "paused" : "running";
  const dust = [
    { delay: "-4s", radius: "140px" }, { delay: "-11s", radius: "220px" }, { delay: "-19s", radius: "290px" },
    { delay: "-28s", radius: "320px" }, { delay: "-7s", radius: "180px" }, { delay: "-15s", radius: "300px" },
  ];

  return (
    <div
      ref={ref}
      className={cn("ss-root relative flex items-center justify-center w-full max-w-[860px] h-[300px] md:h-[440px] select-none overflow-visible", className)}
      style={{ perspective: "1200px" }}
      {...props}
    >
      <style>{CSS}</style>
      {label && <p className="sr-only">{label}</p>}
      <div
        aria-hidden="true"
        className="absolute w-[360px] h-[360px] md:w-[860px] md:h-[860px] flex items-center justify-center"
        style={{ transform: "rotateX(65deg) rotateY(-10deg)", transformStyle: "preserve-3d" }}
      >
        <div
          className="absolute w-[100px] h-[100px] md:w-[130px] md:h-[130px] flex items-center justify-center z-20 pointer-events-none"
          style={{ transform: "rotateY(10deg) rotateX(-65deg)", transformStyle: "preserve-3d" }}
        >
          <div className="absolute w-[90px] h-[90px] md:w-[120px] md:h-[120px] rounded-full blur-md ss-pulse z-10" style={{ background: `${accent}26` }} />
          <div
            className="w-14 h-14 md:w-20 md:h-20 rounded-full z-20 flex items-center justify-center p-2 relative bg-white"
            style={{ border: `2px solid ${accent}55`, boxShadow: `0 0 30px ${accent}40`, color: accent }}
          >
            {center}
          </div>
        </div>

        {dust.map((d, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 w-1 h-1 rounded-full opacity-50 pointer-events-none ss-orbit"
            style={{
              background: accent, boxShadow: `0 0 6px ${accent}`, animationDelay: d.delay,
              "--orbit-radius": d.radius, "--orbit-duration": `${24 / speedMultiplier}s`, "--orbit-play-state": play,
            }}
          />
        ))}

        {orbits.map((orbit) => (
          <React.Fragment key={orbit.id}>
            <div
              className="absolute rounded-full border border-dashed pointer-events-none"
              style={{ width: `calc(2 * ${orbit.radius})`, height: `calc(2 * ${orbit.radius})`, borderColor: "#c9d6ee" }}
            />
            {orbit.items.map((item, idx, arr) => {
              const delay = -(orbit.speed / arr.length) * idx;
              const duration = orbit.speed / speedMultiplier;
              const hovered = hoveredId === item.id;
              const vars = { "--orbit-radius": orbit.radius, "--orbit-duration": `${duration}s`, "--orbit-play-state": play };
              return (
                <div
                  key={item.id}
                  className="absolute left-1/2 top-1/2 w-0 h-0 pointer-events-none ss-orbit"
                  style={{ ...vars, animationDelay: `${delay}s`, zIndex: hovered ? 30 : 10, transformStyle: "preserve-3d" }}
                >
                  <div
                    className="absolute right-0 top-1/2 h-[1.5px] origin-right -translate-y-1/2 pointer-events-none transition-opacity duration-300"
                    style={{ width: orbit.radius, opacity: hovered ? 1 : 0, background: `linear-gradient(90deg, transparent, ${accent})` }}
                  />
                  <div
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className="ss-card ss-billboard"
                    style={{
                      ...vars, animationDelay: `${delay}s`,
                      borderColor: hovered ? accent : undefined,
                      boxShadow: hovered ? `0 0 0 3px ${accent}22, 0 10px 24px -10px ${accent}88` : undefined,
                      scale: hovered ? 1.06 : 1,
                    }}
                  >
                    <span style={{ color: accent, display: "inline-flex" }}>{item.icon}</span>
                    <span className="text-[11px] md:text-[13px] tracking-tight">{item.label}</span>
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
});

export default SolarSystem;
