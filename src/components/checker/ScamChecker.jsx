import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Check, Image as ImageIcon, Link2, Lock, MessageSquareText, Phone, RotateCcw, ScanLine, Sparkles, Upload, Wallet,
} from 'lucide-react';
import { Button } from '../ui';
import { Radar } from './Radar';
import { Verdict } from './Verdict';
import { checkContact, checkLink, checkMessage } from '../../lib/heuristics';
import { screenAddress } from '../../lib/screen';
import { lookupSubject } from '../../chain';
import { isEvmAddress } from '../../lib/format';
import { sampleAddress } from '../../risk';
import { useRegistry } from '../../state/registry';
import { useCursor } from '../cursor/CursorSystem';

const MODES = [
  { key: 'message', label: 'Message', icon: MessageSquareText, words: ['READING', 'PRESSURE', 'OTP ASKS', 'LINKS'],
    steps: ['Reading the message', 'Looking for fear and urgency tactics', 'Checking for OTP, PIN or payment requests', 'Inspecting any links', 'Preparing your result'],
    sample: 'Dear customer, your SBI KYC expires today and your account will be BLOCKED. Update immediately at http://sbi-kyc-update.xyz/login and share the OTP to verify.' },
  { key: 'link', label: 'Link', icon: Link2, words: ['DOMAIN', 'LOOKALIKE', 'REDIRECT', 'SECURE?'],
    steps: ['Reading the web address', 'Comparing against official brand websites', 'Checking for hidden redirects and look-alike letters', 'Preparing your result'],
    sample: 'bit.ly/paytm-cashback-claim' },
  { key: 'contact', label: 'Phone / UPI', icon: Phone, words: ['FORMAT', 'COUNTRY', 'UPI NAME'],
    steps: ['Reading the number or UPI ID', 'Checking country code and format', 'Looking for impersonation in the name', 'Preparing your result'],
    sample: '+92 301 5557788' },
  { key: 'wallet', label: 'Wallet address', icon: Wallet, words: ['REGISTRY', 'REPORTS', 'REVIEWS'],
    steps: ['Validating the address', 'Reading the onchain threat registry', 'Matching community reports', 'Preparing your result'],
    sample: sampleAddress },
  { key: 'screenshot', label: 'Screenshot', icon: ImageIcon, words: ['READING', 'TEXT', 'SIGNALS'],
    steps: ['Reading text from the image on your device', 'Looking for fear and urgency tactics', 'Checking for OTP, PIN or payment requests', 'Preparing your result'] },
];

const PLACEHOLDER = {
  message: 'Paste the SMS, WhatsApp or email message here…',
  link: 'Paste a link, e.g. https://example.com/offer',
  contact: 'Phone number (+91 98…) or UPI ID (name@bank)',
  wallet: '0x… wallet or contract address',
};

/** Normalise any checker output into what <Verdict> renders. */
function fromHeuristics(r) {
  return { verdict: r.verdict, findings: r.findings, checks: r.checks };
}
function fromWallet(r) {
  const verdict = r.tone === 'danger' ? 'dangerous' : r.tone === 'warning' ? 'suspicious' : 'unknown';
  return {
    verdict, demo: r.demo, matches: r.matches, label: r.level,
    findings: r.reasons.map((text) => ({ tone: r.tone === 'danger' ? 'danger' : r.tone === 'warning' ? 'warning' : 'info', text })),
  };
}

export function ScamChecker({ initialMode = 'message', initialValue = '' }) {
  const reg = useRegistry();
  const cursor = useCursor();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState(initialMode);
  const [values, setValues] = useState({ [initialMode]: initialValue });
  const [image, setImage] = useState(null); // { file, url } — url is a data: URL (the hosting CSP allows data: images, not blob:)
  const [phase, setPhase] = useState('idle'); // idle | scanning | done
  const [step, setStep] = useState(0);
  const [ocr, setOcr] = useState(null); // { progress, text }
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const timers = useRef([]);
  const resultRef = useRef(null);
  const cfg = MODES.find((m) => m.key === mode);

  useEffect(() => () => { timers.current.forEach(clearTimeout); cursor.setMode(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value = values[mode] || '';
  const setValue = (v) => setValues((s) => ({ ...s, [mode]: v }));

  function reset() {
    timers.current.forEach(clearTimeout);
    setPhase('idle'); setResult(null); setStep(0); setError(''); setOcr(null);
    cursor.setMode(null);
  }

  /** Walks through the visible steps, then reveals the verdict. */
  function reveal(res) {
    const stepMs = reduce ? 0 : 380;
    cfg.steps.forEach((_, i) => {
      timers.current.push(setTimeout(() => setStep(i + 1), stepMs * (i + 1)));
    });
    timers.current.push(setTimeout(() => {
      setResult(res);
      setPhase('done');
      cursor.setMode(null);
      requestAnimationFrame(() => resultRef.current?.focus({ preventScroll: false }));
    }, stepMs * (cfg.steps.length + 0.6)));
  }

  async function run(e) {
    e?.preventDefault();
    setError('');
    let res;
    const v = value.trim();
    if (mode === 'screenshot') {
      if (!image) { setError('Choose a screenshot to check.'); return; }
    } else if (!v) {
      setError('Paste something to check first.'); return;
    }
    if (mode === 'wallet' && !isEvmAddress(v)) { setError('Enter a valid wallet address: 0x followed by 40 letters/numbers.'); return; }

    timers.current.forEach(clearTimeout);
    timers.current = [];
    setResult(null); setStep(0); setPhase('scanning');
    cursor.setMode('scanning');

    if (mode === 'message') res = fromHeuristics(checkMessage(v));
    if (mode === 'link') res = fromHeuristics(checkLink(v));
    if (mode === 'contact') res = fromHeuristics(checkContact(v));
    if (mode === 'wallet') {
      // v2 registries index reports per address, so the whole history is checked;
      // on v1 lookupSubject scans the latest 100. If the lookup fails, use the rows already loaded.
      let rows = reg.rows;
      let full = false;
      let readOk = reg.available;
      if (reg.address) {
        try {
          const found = await lookupSubject(reg.address, v);
          rows = found.rows;
          full = found.complete;
          readOk = true;
        } catch { /* keep the loaded rows */ }
      }
      res = fromWallet(screenAddress(v, rows, readOk, full));
    }
    if (mode === 'screenshot') {
      try {
        setOcr({ progress: 0, text: '' });
        // The reader is WebAssembly. If the site's CSP doesn't allow compiling it
        // ('wasm-unsafe-eval'), say so immediately rather than failing inside the worker.
        try {
          await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
        } catch {
          setPhase('idle'); cursor.setMode(null);
          setError('Reading screenshots isn’t available on this site right now. Please type or paste the message text in the Message tab instead.');
          return;
        }
        // Lazy-loaded: text recognition runs entirely in this browser.
        const { createWorker } = await import('tesseract.js');
        // Served from this site (public/ocr), not a CDN: the hosting CSP only allows same-origin.
        const ocrBase = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href;
        // If the engine can't start (e.g. blocked by a CSP) the worker reports through errorHandler
        // and never resolves, so fail visibly instead of waiting forever.
        let fail;
        const failed = new Promise((_, reject) => { fail = reject; });
        failed.catch(() => {}); // only observed through the races below
        const timer = setTimeout(() => fail(new Error('OCR timed out')), 90000);
        const workerReady = createWorker('eng', 1, {
          workerPath: `${ocrBase}worker.min.js`,
          corePath: `${ocrBase}core`,
          langPath: `${ocrBase}lang`,
          workerBlobURL: false,
          errorHandler: (err) => fail(err),
          logger: (m) => { if (m.status === 'recognizing text') setOcr((o) => ({ ...o, progress: m.progress })); },
        });
        let data;
        try {
          const worker = await Promise.race([failed, workerReady]);
          ({ data } = await Promise.race([failed, worker.recognize(image.file)]));
        } finally {
          clearTimeout(timer);
          workerReady.then((w) => w.terminate()).catch(() => {});
        }
        const text = data.text.trim();
        setOcr({ progress: 1, text });
        res = text.length < 8
          ? { verdict: 'unknown', label: 'Could not read enough text', findings: [{ tone: 'info', text: 'Try a sharper screenshot, or paste the message text instead.' }] }
          : { ...fromHeuristics(checkMessage(text)), extracted: text };
      } catch {
        setPhase('idle'); cursor.setMode(null);
        setError('Could not read the image. Check your connection (the text reader downloads once) or paste the text instead.');
        return;
      }
    }
    reveal({ ...res, mode, input: mode === 'screenshot' ? image.file.name : v });
  }

  function pickImage(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file (PNG or JPG).'); return; }
    if (file.size > 15 * 1024 * 1024) { setError('That image is too large. Please choose one under 15 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => { setImage({ file, url: String(reader.result) }); setError(''); };
    reader.onerror = () => setError('Could not open that image. Please try another one.');
    reader.readAsDataURL(file);
  }

  const busy = phase === 'scanning';

  return (
    <div className="checker">
      <div className="checker-tabs" role="tablist" aria-label="What do you want to check?">
        {MODES.map(({ key, label, icon: Icon }) => (
          <button key={key} role="tab" type="button" aria-selected={mode === key} aria-controls="checker-panel"
            className={mode === key ? 'active' : ''} disabled={busy} onClick={() => { setMode(key); reset(); }}>
            {mode === key && <motion.span layoutId="checker-tab" className="checker-tab-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
            <Icon size={16} /><span>{label}</span>
          </button>
        ))}
      </div>

      <form id="checker-panel" role="tabpanel" className="checker-form" onSubmit={run} noValidate>
        {mode === 'screenshot' ? (
          <label className={`dropzone ${image ? 'has-image' : ''}`}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickImage(e.dataTransfer.files?.[0]); }}
            data-cursor="drag">
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickImage(e.target.files?.[0])} disabled={busy} />
            {image ? (
              <>
                <img src={image.url} alt="Screenshot you selected" data-cursor="media" />
                <span className="dropzone-name"><ImageIcon size={14} />{image.file.name} · tap to change</span>
              </>
            ) : (
              <span className="dropzone-empty"><Upload size={22} /><b>Drop a screenshot or tap to choose</b><small>PNG or JPG of a message, chat or payment request</small></span>
            )}
          </label>
        ) : mode === 'message' ? (
          <textarea aria-label="Message to check" rows={5} value={value} onChange={(e) => setValue(e.target.value)} placeholder={PLACEHOLDER.message} disabled={busy} maxLength={5000} />
        ) : (
          <div className="checker-input">
            <ScanLine size={18} aria-hidden="true" />
            <input aria-label={cfg.label} value={value} onChange={(e) => setValue(e.target.value)} placeholder={PLACEHOLDER[mode]}
              spellCheck={false} autoComplete="off" inputMode={mode === 'contact' ? 'text' : 'url'} disabled={busy} />
          </div>
        )}

        <p className="privacy-note"><Lock size={14} aria-hidden="true" />
          Checked on this device — nothing you paste is uploaded or saved. Never paste OTPs, PINs, passwords or card numbers.
        </p>
        {error && <p className="field-msg error" role="alert">{error}</p>}

        <div className="checker-actions">
          <Button type="submit" size="lg" icon={ScanLine} loading={busy}>{busy ? 'Checking…' : 'Check now'} {!busy && <ArrowRight size={16} />}</Button>
          {cfg.sample && phase === 'idle' && (
            <button type="button" className="link-btn" onClick={() => setValue(cfg.sample)}><Sparkles size={14} /> Try an example</button>
          )}
          {phase === 'done' && <Button type="button" variant="ghost" icon={RotateCcw} onClick={() => { reset(); setValue(''); setImage(null); }}>Check something else</Button>}
        </div>
      </form>

      <AnimatePresence mode="wait">
        {busy && (
          <motion.div key="scan" className="scan-stage" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} aria-live="polite">
            <Radar words={cfg.words} />
            <ol className="scan-steps">
              {mode === 'screenshot' && ocr && ocr.progress < 1 && (
                <li className="current"><span className="scan-step-dot" />Reading the image… {Math.round(ocr.progress * 100)}%</li>
              )}
              {cfg.steps.map((s, i) => (
                <li key={s} className={i < step ? 'done' : i === step ? 'current' : ''}>
                  <span className="scan-step-dot">{i < step && <Check size={11} />}</span>{s}
                </li>
              ))}
            </ol>
          </motion.div>
        )}
        {phase === 'done' && result && (
          <motion.div key="result" ref={resultRef} tabIndex={-1} className="verdict-wrap" aria-live="polite"
            initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 170, damping: 22 }}>
            <Verdict result={result} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
