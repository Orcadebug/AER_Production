const { createWorker } = require('tesseract.js');
let workerPromise = null;
let sharp = null;
try { sharp = require('sharp'); } catch {}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      // Newer tesseract.js workers are pre-loaded with default language
      const worker = await createWorker();
      return worker;
    })();
  }
  return workerPromise;
}

async function preprocess(imageBuffer) {
  if (!sharp) return imageBuffer;
  try {
    const img = sharp(imageBuffer, { failOnError: false });
    const meta = await img.metadata().catch(() => ({}));
    const width = Math.min(1600, (meta.width || 1600));
    return await img.resize({ width, withoutEnlargement: true }).grayscale().png().toBuffer();
  } catch { return imageBuffer; }
}

async function runOCR(imageBuffer) {
  const worker = await getWorker();
  const processed = await preprocess(imageBuffer);
  const { data: { text } } = await worker.recognize(processed);
  return text || '';
}

module.exports = { runOCR };
