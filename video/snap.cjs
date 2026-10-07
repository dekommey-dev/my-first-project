// usage: node snap.cjs out_dir t1 t2 ...   (사전 점검용 스틸 캡처)
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const [out, ...ts] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on("pageerror", e => console.error("PAGEERROR", e.message));
  page.on("console", m => { if (m.type() === "error") console.error("CONSOLE", m.text()); });
  await page.goto("file://" + path.resolve(__dirname, "page/index.html"));
  await page.evaluate(() => window.ready);
  for (const t of ts) {
    await page.evaluate(t => window.renderAt(t), parseFloat(t));
    await page.screenshot({ path: `${out}/t_${String(t).padStart(6, "0")}.png` });
  }
  await browser.close();
})();
