const { spawn } = require('child_process');
const { clipboard } = require('electron');

function pickScreencaptureBinary() {
  // Try absolute path first, then fallback to PATH
  const candidates = ['/usr/sbin/screencapture', 'screencapture'];
  return candidates[0];
}

async function captureInteractive() {
  return new Promise((resolve, reject) => {
    const bin = pickScreencaptureBinary();
    const args = ['-i', '-c']; // interactive, clipboard
    const proc = spawn(bin, args);
    proc.on('error', (e) => reject(new Error('Unable to invoke screencapture: ' + e.message)));
    proc.on('exit', async (code) => {
      try {
        // Small delay to let clipboard settle
        await new Promise(r => setTimeout(r, 120));
        const img = clipboard.readImage();
        if (img.isEmpty()) {
          return reject(new Error('No image captured. If you didn’t cancel, grant Screen Recording permission to Electron in System Settings → Privacy & Security → Screen Recording.'));
        }
        const buf = img.toPNG();
        clipboard.clear();
        resolve(buf);
      } catch (e) {
        reject(new Error('Clipboard read failed. Grant Screen Recording permission to Electron.'));
      }
    });
  });
}

module.exports = { captureInteractive };
