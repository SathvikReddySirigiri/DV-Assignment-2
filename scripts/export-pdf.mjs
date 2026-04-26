import puppeteer from "puppeteer";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function exportPDF() {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  const url = process.env.SITE_URL || "http://localhost:5173";
  console.log(`Loading ${url}...`);
  await page.goto(url, {
    waitUntil: "networkidle0",
    timeout: 60000,
  });

  console.log("Waiting for fonts and animations...");
  await page.evaluateHandle("document.fonts.ready");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log("Triggering animations...");
  await page.evaluate(async () => {
    const distance = 100;
    const delay = 50;
    const totalHeight = document.body.scrollHeight;
    for (let i = 0; i < totalHeight; i += distance) {
      window.scrollTo(0, i);
      await new Promise((r) => setTimeout(r, delay));
    }
    window.scrollTo(0, 0);
  });

  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("Generating PDF...");
  const outputPath = join(__dirname, "..", "tpa-delays-export.pdf");
  await page.pdf({
    path: outputPath,
    format: "Letter",
    printBackground: true,
    preferCSSPageSize: true,
    margin: {
      top: "0.45in",
      bottom: "0.45in",
      left: "0.45in",
      right: "0.45in",
    },
    displayHeaderFooter: false,
  });

  console.log(`✓ PDF exported to: ${outputPath}`);
  await browser.close();
}

exportPDF().catch((err) => {
  console.error("Failed to export PDF:", err);
  process.exit(1);
});
