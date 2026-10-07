// usage: node render.cjs <startFrame> <endFrame(excl)> <out.mp4> [fps]
// page/index.html 의 renderAt(t)를 프레임 단위로 호출해 캡처 → ffmpeg(libx264)로 인코딩
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const path = require("path");
(async () => {
  const [a, b, out, fpsArg] = process.argv.slice(2);
  const fps = parseInt(fpsArg || "30", 10), start = parseInt(a, 10), end = parseInt(b, 10);
  const browser = await chromium.launch({ args: ["--allow-file-access-from-files", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("pageerror", e => console.error("PAGEERROR", e.message));
  await page.goto("file://" + path.resolve(__dirname, "page/index.html"));
  await page.evaluate(() => window.ready);
  const cdp = await page.context().newCDPSession(page);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-r", String(fps), out], { stdio: ["pipe", "inherit", "inherit"] });
  const t0 = Date.now();
  for (let f = start; f < end; f++) {
    await page.evaluate(t => window.renderAt(t), f / fps);
    const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 94, optimizeForSpeed: true });
    if (!ff.stdin.write(Buffer.from(data, "base64"))) await new Promise(r => ff.stdin.once("drain", r));
    if ((f - start) % 300 === 0) console.log(`[${out}] ${f - start}/${end - start} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on("close", r));
  await browser.close();
  console.log(`[${out}] done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
})();
