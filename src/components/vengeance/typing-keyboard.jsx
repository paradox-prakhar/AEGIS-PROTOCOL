/* Vengeance UI — typing-keyboard (MIT, © Ashutoshx7). Ported from the registry TSX.
   Aegis adaptations: JSX; text written with textContent (not innerHTML); the typing
   loop no longer restarts on every render (typingSpeed was a new array each time);
   scales to its container width; reduced-motion users see the full text, still;
   decorative (aria-hidden) — pages provide the text alternative. */
import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

function Key({ size = "", accent = "" }) {
  const s = size ? `--${size}` : "";
  const sized = (base) => `${base} tk-face${size ? ` ${base}${s}` : ""}`;
  const tone = (n) => (accent === "b" ? ` tk-face--b${n}` : accent === "o" ? ` tk-face--o${n}` : "");
  return (
    <div className={`tk-key tk-flex${size ? ` tk-key${s}` : ""}`}>
      <div className={sized("tk-key__front") + tone(3)} />
      <div className={sized("tk-key__back") + tone(1)} />
      <div className={sized("tk-key__right") + tone(1)} />
      <div className={sized("tk-key__left") + tone(2)} />
      <div className={sized("tk-key__top") + tone(1)} />
      <div className={sized("tk-key__bottom") + tone(2)} />
    </div>
  );
}

const KC_MAP = {
  81: 15, 87: 16, 69: 17, 82: 18, 84: 19, 89: 20, 85: 21, 73: 22, 79: 23, 80: 24,
  65: 29, 83: 30, 68: 31, 70: 32, 71: 33, 72: 34, 74: 35, 75: 36, 76: 37,
  90: 41, 88: 42, 67: 43, 86: 44, 66: 45, 78: 46, 77: 47,
  32: 56, 13: 39, 8: 27,
};

export function TypingKeyboard({
  className,
  autoTypeText = "Your KYC expires today. Update now: sbi-kyc.xyz",
  minDelay = 45,
  maxDelay = 120,
  scale = 0.8,
  accentColor = "#2563eb",
  secondaryAccent = "#0ea5e9",
  onCycle,
  ...props
}) {
  const wrapRef = useRef(null);
  const mainRef = useRef(null);
  const kbRef = useRef(null);
  const screenRef = useRef(null);
  const onCycleRef = useRef(onCycle);
  onCycleRef.current = onCycle;

  // Fit the 800px-wide scene into the container.
  useEffect(() => {
    const wrap = wrapRef.current;
    const main = mainRef.current;
    if (!wrap || !main) return undefined;
    const fit = () => {
      const k = Math.min(scale, (wrap.clientWidth / 800) * scale * 1.15);
      main.style.transform = `scale(${k})`;
      // The scene's visible part is the middle ~470px of its 600px box.
      main.style.margin = `${-65 * k}px 0`;
      wrap.style.height = `${470 * k}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [scale]);

  useEffect(() => {
    const kb = kbRef.current;
    const screen = screenRef.current;
    if (!kb || !screen) return undefined;
    kb.style.transform = "perspective(10000px) rotateX(60deg) rotateZ(-35deg)";

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      screen.textContent = autoTypeText;
      return undefined;
    }

    const allKeys = kb.querySelectorAll(".tk-key");
    let alive = true;
    let idx = 0;
    let timer;
    screen.textContent = "";

    const pressKey = (kc) => {
      const el = allKeys[KC_MAP[kc]];
      if (el) {
        el.classList.add("tk-key--down");
        setTimeout(() => el.classList.remove("tk-key--down"), 80);
      }
    };
    const typeNext = () => {
      if (!alive) return;
      const char = autoTypeText[idx];
      pressKey(char === " " ? 32 : char.toUpperCase().charCodeAt(0));
      screen.textContent += char;
      idx++;
      if (idx >= autoTypeText.length) {
        onCycleRef.current?.("typed");
        timer = setTimeout(() => {
          if (!alive) return;
          screen.textContent = "";
          idx = 0;
          onCycleRef.current?.("reset");
          timer = setTimeout(typeNext, 900);
        }, 3200);
      } else {
        timer = setTimeout(typeNext, minDelay + Math.random() * (maxDelay - minDelay));
      }
    };
    timer = setTimeout(typeNext, 1200);
    return () => { alive = false; clearTimeout(timer); };
  }, [autoTypeText, minDelay, maxDelay]);

  return (
    <div ref={wrapRef} className={cn("tk-container", className)} aria-hidden="true" {...props}>
      <style>{`
        .tk-container { width: 100%; display: flex; justify-content: center; align-items: center; overflow: visible;
          font-family: inherit; font-weight: 700; color: #0b1b3a; text-transform: uppercase; letter-spacing: 2px; }
        .tk-container * { transform-style: preserve-3d; }
        .tk-main { width: 800px; height: 600px; flex: none; position: relative; transform-origin: center center; }
        .tk-flex { display: flex; justify-content: center; align-items: center; }
        .tk-face { position: absolute; }
        .tk-keyboard { width: 500px; height: 160px; }
        .tk-keyboard__front { width: 500px; height: 25px; transform: rotateX(-90deg) translateZ(80px); background-color: #b9c6dd; }
        .tk-keyboard__back  { width: 500px; height: 25px; transform: rotateX(90deg) translateZ(80px); background-color: #ffffff; }
        .tk-keyboard__top   { display: flex; flex-direction: column; justify-content: space-around; width: 500px; height: 160px;
          transform: rotateY(0deg) translateZ(12.5px);
          background-image: linear-gradient(to bottom, color-mix(in srgb, ${accentColor} 22%, white), #e8eef9); }
        .tk-keyboard__bottom { width: 500px; height: 160px; transform: rotateY(180deg) translateZ(12.5px); background-color: #e6ecf7; }
        .tk-keyboard__right { width: 25px; height: 160px; transform: rotateY(90deg) translateZ(250px); background-color: #ffffff; }
        .tk-keyboard__left  { width: 25px; height: 160px; transform: rotateY(90deg) translateZ(-250px); background-color: #dfe7f5; }
        .tk-screen { width: 303px; height: 240px; transform: translateZ(100px) translateY(-200px) translateZ(50px) rotateX(270deg);
          background-color: #ffffff; border: 2px solid ${accentColor}; border-radius: 14px; padding: 18px;
          font-size: 19px; line-height: 1.45; word-wrap: break-word; white-space: pre-wrap; overflow: hidden;
          text-transform: none; letter-spacing: 0.2px; color: #0b1b3a; font-weight: 600;
          align-items: flex-start !important; justify-content: flex-start !important;
          box-shadow: 0 0 0 6px color-mix(in srgb, ${accentColor} 12%, transparent), 0 20px 50px -16px color-mix(in srgb, ${accentColor} 60%, transparent); }
        .tk-screen::after { content: ''; display: inline-block; width: 2px; height: 1.1em; margin-left: 2px; vertical-align: -2px; background: ${accentColor}; animation: tk-caret 1s steps(1) infinite; }
        @keyframes tk-caret { 50% { opacity: 0; } }
        .tk-keys { display: flex; justify-content: space-between; width: 100%; transform: translateZ(4px); padding: 0 2px; }
        .tk-key { width: 30px; height: 27px; transition: .05s ease; }
        .tk-key--w2 { width: 60px; } .tk-key--w3 { width: 90px; } .tk-key--w6 { width: 195px; }
        .tk-key__front { width: 30px; height: 8px; transform: rotateX(-90deg) translateZ(13.5px); background-color: #9fb0cf; }
        .tk-key__front--w2 { width: 60px; } .tk-key__front--w3 { width: 90px; } .tk-key__front--w6 { width: 195px; }
        .tk-key__back { width: 30px; height: 8px; transform: rotateX(90deg) translateZ(13.5px); background-color: #ffffff; }
        .tk-key__back--w2 { width: 60px; } .tk-key__back--w3 { width: 90px; } .tk-key__back--w6 { width: 195px; }
        .tk-key__top { width: 30px; height: 27px; transform: rotateY(0deg) translateZ(4px); background-color: #ffffff;
          background-image: linear-gradient(to bottom, color-mix(in srgb, ${accentColor} 10%, white), #ffffff);
          box-shadow: inset 0 0 0 0.5px rgba(30,58,138,0.16), 0 -1px 2px rgba(30,58,138,0.08); }
        .tk-key__top--w2 { width: 60px; } .tk-key__top--w3 { width: 90px; } .tk-key__top--w6 { width: 195px; }
        .tk-key__bottom { width: 30px; height: 27px; transform: rotateY(180deg) translateZ(4px); background-color: #9fb0cf; }
        .tk-key__bottom--w2 { width: 60px; } .tk-key__bottom--w3 { width: 90px; } .tk-key__bottom--w6 { width: 195px; }
        .tk-key__right { width: 8px; height: 27px; transform: rotateY(90deg) translateZ(15px); background-color: #9fb0cf; }
        .tk-key__right--w2 { transform: rotateY(90deg) translateZ(30px); } .tk-key__right--w3 { transform: rotateY(90deg) translateZ(45px); } .tk-key__right--w6 { transform: rotateY(90deg) translateZ(97.5px); }
        .tk-key__left { width: 8px; height: 27px; transform: rotateY(90deg) translateZ(-15px); background-image: linear-gradient(to bottom, #cdd8ea, #bfcbe1); }
        .tk-key__left--w2 { transform: rotateY(90deg) translateZ(-30px); } .tk-key__left--w3 { transform: rotateY(90deg) translateZ(-45px); } .tk-key__left--w6 { transform: rotateY(90deg) translateZ(-97.5px); }
        .tk-face--b1 { background: ${accentColor}; }
        .tk-face--b2 { background-image: linear-gradient(to bottom, color-mix(in srgb, ${accentColor} 80%, black), ${accentColor}); }
        .tk-face--b3 { background-color: color-mix(in srgb, ${accentColor} 60%, black); }
        .tk-face--o1 { background: ${secondaryAccent}; }
        .tk-face--o2 { background-image: linear-gradient(to bottom, color-mix(in srgb, ${secondaryAccent} 80%, black), ${secondaryAccent}); }
        .tk-face--o3 { background-color: color-mix(in srgb, ${secondaryAccent} 60%, black); }
        .tk-key--down { display: flex; justify-content: center; align-items: center; transform: translateZ(-5px); transition: .05s ease; }
        .tk-key--down > .tk-key__top { background: color-mix(in srgb, ${secondaryAccent} 70%, white) !important; }
        @media (prefers-reduced-motion: reduce) { .tk-screen::after { animation: none; } }
      `}</style>
      <div className="tk-main tk-flex" ref={mainRef}>
        <div className="tk-keyboard tk-flex" ref={kbRef}>
          <div className="tk-screen tk-flex" ref={screenRef} />
          <div className="tk-keyboard__front tk-face" />
          <div className="tk-keyboard__back tk-face" />
          <div className="tk-keyboard__right tk-face" />
          <div className="tk-keyboard__left tk-face" />
          <div className="tk-keyboard__top tk-face">
            <div className="tk-keys"><Key accent="b" />{Array.from({ length: 12 }, (_, i) => <Key key={i} />)}<Key size="w2" accent="b" /></div>
            <div className="tk-keys"><Key size="w2" accent="b" />{Array.from({ length: 12 }, (_, i) => <Key key={i} />)}<Key accent="b" /></div>
            <div className="tk-keys"><Key size="w3" accent="b" />{Array.from({ length: 10 }, (_, i) => <Key key={i} />)}<Key size="w2" accent="o" /></div>
            <div className="tk-keys"><Key size="w2" accent="b" />{Array.from({ length: 11 }, (_, i) => <Key key={i} />)}<Key size="w3" accent="b" /></div>
            <div className="tk-keys"><Key accent="b" /><Key accent="o" />{Array.from({ length: 2 }, (_, i) => <Key key={`a${i}`} accent="b" />)}<Key size="w6" />{Array.from({ length: 5 }, (_, i) => <Key key={`b${i}`} accent="b" />)}</div>
          </div>
          <div className="tk-keyboard__bottom tk-face" />
        </div>
      </div>
    </div>
  );
}

export default TypingKeyboard;
