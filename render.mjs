import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------------------------------------------
// Video & Rendering Configuration (Matching rules.md)
// -------------------------------------------------------------
const CONFIG = {
  width: 1920,
  height: 1080,
  fps: 30,
  duration: 10,                 // 10 seconds (Adobe Stock range: 5 - 15s)
  totalFrames: 300,             // 30 fps * 10s = 300 frames
  framesDir: path.join(__dirname, 'frames'),
  outputDir: path.join(__dirname, 'output'),
  outputFile: path.join(__dirname, 'output', 'quantum_nexus_1080p_30fps.mp4'),
  crf: 18,                      // Visually lossless quality for stock footage
  preset: 'fast'
};

// -------------------------------------------------------------
// Helper: Clean directory of previous frame files
// -------------------------------------------------------------
function cleanFramesDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return;
  }
  const files = fs.readdirSync(dir);
  let deletedCount = 0;
  for (const file of files) {
    if (file.startsWith('frame_') && file.endsWith('.png')) {
      fs.unlinkSync(path.join(dir, file));
      deletedCount++;
    }
  }
  if (deletedCount > 0) {
    console.log(`[Clean] Cleared ${deletedCount} old frame(s) from ${dir}`);
  }
}

// -------------------------------------------------------------
// Helper: Draw terminal progress bar
// -------------------------------------------------------------
function printProgress(current, total, startTime) {
  const percent = Math.floor((current / total) * 100);
  const barLength = 30;
  const filled = Math.round((current / total) * barLength);
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const eta = current > 0 ? (((total - current) / current) * elapsed).toFixed(1) : '--';

  process.stdout.write(`\r[Render] [${bar}] ${percent}% | Frame ${current}/${total} | Elapsed: ${elapsed}s | ETA: ${eta}s `);
}

// -------------------------------------------------------------
// Main Pipeline: Capture Frames & Encode with FFmpeg
// -------------------------------------------------------------
async function main() {
  console.log('=====================================================');
  console.log('   MOTION STOCK ENGINE - PLAYWRIGHT & FFMPEG PIPELINE');
  console.log('=====================================================');
  console.log(`- Target Resolution: ${CONFIG.width}x${CONFIG.height} (Full HD)`);
  console.log(`- Frame Rate:        ${CONFIG.fps} FPS`);
  console.log(`- Duration:          ${CONFIG.duration} Seconds (${CONFIG.totalFrames} total frames)`);
  console.log(`- Output Destination:${CONFIG.outputFile}\n`);

  // 1. Prepare directories
  cleanFramesDirectory(CONFIG.framesDir);
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // 2. Launch Playwright Headless Chromium
  console.log('[Playwright] Launching Chromium instance...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({
    viewport: { width: CONFIG.width, height: CONFIG.height },
    deviceScaleFactor: 1
  });

  const htmlUrl = `file://${path.resolve(__dirname, 'index.html').replace(/\\/g, '/')}`;
  console.log(`[Playwright] Loading page: ${htmlUrl}`);
  await page.goto(htmlUrl, { waitUntil: 'load' });

  // Ensure DOM and custom renderFrame hook are ready
  await page.waitForFunction(() => window.__READY__ === true);
  console.log('[Playwright] Page loaded and animation engine initialized.\n');

  // 3. Render and Capture Frames Loop
  console.log(`[Render] Starting deterministic capture of ${CONFIG.totalFrames} frames...`);
  const startTime = Date.now();

  for (let f = 0; f < CONFIG.totalFrames; f++) {
    // Step animation deterministically to exact frame
    await page.evaluate(({ frame, total }) => {
      window.renderFrame(frame, total);
    }, { frame: f, total: CONFIG.totalFrames });

    // Save PNG frame screenshot
    const frameFilename = `frame_${String(f).padStart(4, '0')}.png`;
    const framePath = path.join(CONFIG.framesDir, frameFilename);
    await page.screenshot({ path: framePath, type: 'png' });

    printProgress(f + 1, CONFIG.totalFrames, startTime);
  }

  console.log('\n[Render] Frame capture complete!');
  await browser.close();

  // 4. Encode Frames to Video via FFmpeg
  console.log('\n[FFmpeg] Compiling frames into high-quality MP4 (Adobe Stock spec)...');
  const framePattern = path.join(CONFIG.framesDir, 'frame_%04d.png').replace(/\\/g, '/');
  const targetOutput = CONFIG.outputFile.replace(/\\/g, '/');

  // FFmpeg command adhering to rules.md
  const ffmpegCmd = `ffmpeg -y -framerate ${CONFIG.fps} -i "${framePattern}" -c:v libx264 -pix_fmt yuv420p -crf ${CONFIG.crf} -preset ${CONFIG.preset} "${targetOutput}"`;
  
  console.log(`[FFmpeg] Executing: ${ffmpegCmd}\n`);
  try {
    execSync(ffmpegCmd, { stdio: 'inherit' });
  } catch (err) {
    console.error('[FFmpeg Error] Failed to compile video:', err.message);
    process.exit(1);
  }

  // 5. Output Verification & Summary
  if (fs.existsSync(CONFIG.outputFile)) {
    const stats = fs.statSync(CONFIG.outputFile);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log('\n=====================================================');
    console.log('   🎉 VIDEO RENDER COMPLETED SUCCESSFULLY!');
    console.log('=====================================================');
    console.log(`📁 File:        ${CONFIG.outputFile}`);
    console.log(`📦 Size:        ${sizeMB} MB`);
    console.log(`⏱️ Duration:    ${CONFIG.duration} Seconds`);
    console.log(`🎬 Format:      1920x1080 @ ${CONFIG.fps}fps (H.264 / yuv420p)`);
    console.log(`💎 Adobe Stock: Ready for commercial submission!`);
    console.log('=====================================================\n');
  } else {
    console.error('[Error] Output file was not found after FFmpeg execution.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
