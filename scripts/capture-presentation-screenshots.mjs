import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";

const baseUrl = process.env.PRESENTATION_BASE_URL || "http://127.0.0.1:5173";
const outputDir = path.resolve(process.cwd(), process.env.PRESENTATION_SCREENSHOT_DIR || "presentation/video/screens");

const shots = [
  {
    name: "01-login",
    route: "/",
    waitForText: "LendFlow Enterprise Platform",
  },
  {
    name: "02-dashboard",
    route: "/dashboard",
    waitForText: "Loan Pipeline",
  },
  {
    name: "03-origination",
    route: "/origination",
    waitForText: "Loan Origination",
  },
  {
    name: "04-underwriting",
    route: "/underwriting",
    waitForText: "Underwriting & Decisioning",
  },
  {
    name: "05-servicing",
    route: "/servicing",
    waitForText: "Loan Servicing",
  },
  {
    name: "06-borrower-dashboard",
    route: "/borrower/dashboard",
    waitForText: "Welcome back, Michael",
  },
  {
    name: "07-borrower-applications",
    route: "/borrower/applications",
    waitForText: "My Applications",
  },
  {
    name: "08-admin-settings",
    route: "/settings",
    waitForText: "Admin Settings",
  },
  {
    name: "09-admin-underwriting-settings",
    route: "/settings",
    waitForText: "Underwriting Settings",
    postLoad: async (page) => {
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const target = buttons.find((btn) => btn.textContent?.trim() === "Underwriting Settings");
        if (!target) return false;
        target.click();
        return true;
      });
      if (!clicked) {
        throw new Error("Could not find Underwriting Settings tab button.");
      }
      await waitForText(page, "Liquidity Calculation Settings", 10000);
    },
  },
];

const chromeCandidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].filter(Boolean);

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveChromePath() {
  for (const candidate of chromeCandidates) {
    if (await fileExists(candidate)) return candidate;
  }
  throw new Error(
    "No Chrome executable found. Set CHROME_PATH to your Chrome/Chromium binary path."
  );
}

async function waitForText(page, text, timeout = 20000) {
  await page.waitForFunction(
    (needle) => document.body && document.body.innerText.includes(needle),
    { timeout },
    text
  );
}

async function captureShot(page, shot) {
  const url = new URL(shot.route, baseUrl).toString();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

  if (shot.waitForText) {
    await waitForText(page, shot.waitForText, 20000);
  }

  // Allow charts/transitions/API state to settle for a cleaner frame.
  await new Promise((resolve) => setTimeout(resolve, 1200));

  if (shot.postLoad) {
    await shot.postLoad(page);
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  const outputPath = path.join(outputDir, `${shot.name}.png`);
  await page.screenshot({ path: outputPath, fullPage: false });
  return outputPath;
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const executablePath = await resolveChromePath();

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    for (const shot of shots) {
      const saved = await captureShot(page, shot);
      console.log(`captured ${saved}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
