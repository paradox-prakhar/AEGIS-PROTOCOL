/**
 * Copies the screenshot reader (tesseract.js) files into public/ocr so they are
 * served from the site's own origin. The hosting CSP (vercel.json, public/_headers)
 * only allows same-origin scripts and connections, so the default CDN cannot be used.
 *
 *   node scripts/copy-ocr-assets.mjs   (runs automatically before dev and build)
 *
 * Output (git-ignored): public/ocr/worker.min.js, public/ocr/core/*-lstm.wasm.js,
 * public/ocr/lang/eng.traineddata.gz. Only one core variant (~4 MB) and the
 * English data (~3 MB) are downloaded, and only when someone checks a screenshot.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/ocr');
const require = createRequire(import.meta.url);
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));

const files = [
  [join(pkgDir('tesseract.js'), 'dist/worker.min.js'), 'worker.min.js'],
  // LSTM-only cores (the app uses OEM 1); the worker picks the variant the browser supports.
  ...['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']
    .map((f) => [join(pkgDir('tesseract.js-core'), f), `core/${f}`]),
  [join(pkgDir('@tesseract.js-data/eng'), '4.0.0_best_int/eng.traineddata.gz'), 'lang/eng.traineddata.gz'],
];

for (const [from, to] of files) {
  const dest = join(OUT, to);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(from, dest);
}
console.log(`copied ${files.length} OCR files to public/ocr`);
