import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

if (!ffmpegPath) {
  throw new Error("ffmpeg-static path was not resolved.");
}

const root = process.cwd();
const screensDir = path.resolve(root, "presentation/video/screens");
const buildDir = path.resolve(root, "presentation/video/build");
const fontPath = process.env.PRESENTATION_FONT || "/System/Library/Fonts/Supplemental/Arial.ttf";

const brandName = (process.env.PRESENTATION_BRAND_NAME || "LendFlow").trim();
const tagline = (
  process.env.PRESENTATION_TAGLINE ||
  "Scale without the Chaos - Smarter Workflows. Seamless Funding."
).trim();
const variant = (process.env.PRESENTATION_VARIANT || "full").trim().toLowerCase();
const narrated = String(process.env.PRESENTATION_NARRATED || "false").toLowerCase() === "true";
const voice = process.env.PRESENTATION_VOICE || "Samantha";
const rate = process.env.PRESENTATION_RATE || "176";

function interpolate(template) {
  return template.replaceAll("{BRAND}", brandName).replaceAll("{TAGLINE}", tagline);
}

const fullSegmentsTemplate = [
  {
    name: "01-intro",
    image: "01-login.png",
    title: "{BRAND}",
    subtitle: "{TAGLINE}",
    narration:
      "Welcome to {BRAND}. {TAGLINE}",
    duration: 6,
  },
  {
    name: "02-dashboard",
    image: "02-dashboard.png",
    title: "Lender Dashboard",
    subtitle: "Real Time Pipeline and Portfolio Visibility",
    narration:
      "From the lender dashboard, teams monitor portfolio performance, live pipeline movement, and real time borrower submissions in one place.",
    duration: 7,
  },
  {
    name: "03-origination",
    image: "03-origination.png",
    title: "Loan Origination",
    subtitle: "Guided Intake Across Borrower Property and Docs",
    narration:
      "Loan origination is streamlined through a guided four step workflow that captures borrower details, property data, loan terms, and required documents.",
    duration: 7,
  },
  {
    name: "04-underwriting",
    image: "04-underwriting.png",
    title: "AI Underwriting",
    subtitle: "Decision Support with Confidence and Risk Flags",
    narration:
      "Underwriting and decisioning include AI powered recommendations, confidence scoring, risk flags, and structured evaluator notes for faster decisions.",
    duration: 7,
  },
  {
    name: "05-servicing",
    image: "05-servicing.png",
    title: "Loan Servicing",
    subtitle: "Collections Delinquency and Payment Operations",
    narration:
      "After funding, servicing teams track active loans, collections, delinquencies, and payment operations through a clear operational dashboard.",
    duration: 7,
  },
  {
    name: "06-borrower-dashboard",
    image: "06-borrower-dashboard.png",
    title: "Borrower Portal",
    subtitle: "Self Service Payments Documents and Status Tracking",
    narration:
      "Borrowers receive a dedicated portal to manage payments, upload documents, and stay aligned with every milestone in the loan lifecycle.",
    duration: 7,
  },
  {
    name: "07-borrower-applications",
    image: "07-borrower-applications.png",
    title: "Workflow Continuation",
    subtitle: "Event Driven Progress from Submission to Underwriting",
    narration:
      "The applications workspace supports event driven status transitions and continuation workflows, reducing back and forth between lenders and borrowers.",
    duration: 7,
  },
  {
    name: "08-admin-settings",
    image: "08-admin-settings.png",
    title: "Admin Controls",
    subtitle: "Role Based Access and System Configuration",
    narration:
      "Administrators can manage roles, permissions, and system controls so each lender can operate with governance that matches internal policy.",
    duration: 7,
  },
  {
    name: "09-admin-underwriting-settings",
    image: "09-admin-underwriting-settings.png",
    title: "Tailored Underwriting",
    subtitle: "Configurable Liquidity Logic and Risk Parameters",
    narration:
      "Underwriting settings are configurable, allowing each organization to tailor liquidity formulas and risk thresholds to their own credit strategy.",
    duration: 7,
  },
  {
    name: "10-close",
    image: "02-dashboard.png",
    title: "{BRAND}",
    subtitle: "{TAGLINE}",
    narration:
      "{BRAND} combines automation, AI integration, and lender specific configurability to deliver a scalable platform from origination through servicing. {TAGLINE}",
    duration: 7,
  },
];

const shortSegmentsTemplate = [
  {
    name: "01-intro-short",
    image: "01-login.png",
    title: "{BRAND}",
    subtitle: "{TAGLINE}",
    narration:
      "{BRAND}. {TAGLINE}",
    duration: 5,
  },
  {
    name: "02-dashboard-short",
    image: "02-dashboard.png",
    title: "Automation in One View",
    subtitle: "Pipeline Performance and Team Activity",
    narration:
      "Operations teams get real time visibility across pipeline activity, portfolio performance, and borrower submissions.",
    duration: 6,
  },
  {
    name: "03-underwriting-short",
    image: "04-underwriting.png",
    title: "AI Powered Decisioning",
    subtitle: "Recommendations Confidence and Risk Insights",
    narration:
      "AI assisted underwriting accelerates decisions using recommendations, confidence scoring, and structured risk insights.",
    duration: 6,
  },
  {
    name: "04-servicing-short",
    image: "05-servicing.png",
    title: "Servicing and Borrower Experience",
    subtitle: "Payments Collections and Portal Collaboration",
    narration:
      "Servicing workflows and borrower portal tools keep communication, payments, and loan progress aligned.",
    duration: 6,
  },
  {
    name: "05-tailored-short",
    image: "09-admin-underwriting-settings.png",
    title: "{BRAND}",
    subtitle: "{TAGLINE}",
    narration:
      "Configurable underwriting and admin controls let lenders tailor the platform to their policy and growth strategy. {TAGLINE}",
    duration: 6,
  },
];

const chosenTemplate = variant === "short" ? shortSegmentsTemplate : fullSegmentsTemplate;
const segments = chosenTemplate.map((segment) => ({
  ...segment,
  title: interpolate(segment.title),
  subtitle: interpolate(segment.subtitle),
  narration: interpolate(segment.narration),
}));

function defaultOutputPath() {
  if (variant === "short" && narrated) return path.resolve(root, "presentation/video/lendflow-presentation-short-narrated.mp4");
  if (variant === "short") return path.resolve(root, "presentation/video/lendflow-presentation-short.mp4");
  if (narrated) return path.resolve(root, "presentation/video/lendflow-presentation-narrated.mp4");
  return path.resolve(root, "presentation/video/lendflow-presentation.mp4");
}

const outputFile = process.env.PRESENTATION_OUTPUT
  ? path.resolve(root, process.env.PRESENTATION_OUTPUT)
  : defaultOutputPath();

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });

    let stderr = "";
    let stdout = "";

    child.stdout.on("data", (data) => {
      stdout += String(data);
    });

    child.stderr.on("data", (data) => {
      stderr += String(data);
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} failed with code ${code}\n${stderr || stdout}`
        )
      );
    });
  });
}

async function ensureReadable(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

function escapeDrawText(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/'/g, "\\'")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

async function synthesizeNarration({ text, outPath }) {
  await run("say", ["-v", voice, "-r", rate, "-o", outPath, text]);
  const stats = await fs.stat(outPath);
  if (stats.size <= 4096) {
    throw new Error(
      "Narration audio generation returned empty output. Re-run with elevated permissions so macOS speech synthesis can access audio services."
    );
  }
}

async function renderSegment({ name, image, title, subtitle, narration, duration }, index) {
  const imagePath = path.join(screensDir, image);
  await ensureReadable(imagePath);

  const prefix = `${String(index + 1).padStart(2, "0")}-${name}`;
  const videoPath = path.join(buildDir, `${prefix}.mp4`);

  const overlayStartY = 1080 - 210;
  const fadeOutStart = Math.max(duration - 0.6, 0.5);
  const safeTitle = escapeDrawText(title);
  const safeSubtitle = escapeDrawText(subtitle);

  const vf = [
    "scale=1920:1080",
    "format=yuv420p",
    `fade=t=in:st=0:d=0.4`,
    `fade=t=out:st=${fadeOutStart}:d=0.5`,
    `drawbox=x=0:y=${overlayStartY}:w=iw:h=210:color=black@0.58:t=fill`,
    `drawtext=fontfile='${fontPath}':text='${safeTitle}':fontcolor=white:fontsize=56:x=(w-text_w)/2:y=${overlayStartY + 35}`,
    `drawtext=fontfile='${fontPath}':text='${safeSubtitle}':fontcolor=white:fontsize=34:x=(w-text_w)/2:y=${overlayStartY + 115}`,
  ].join(",");

  if (narrated) {
    const audioPath = path.join(buildDir, `${prefix}.aiff`);
    await synthesizeNarration({ text: narration, outPath: audioPath });
    await run(ffmpegPath, [
      "-y",
      "-loop",
      "1",
      "-i",
      imagePath,
      "-i",
      audioPath,
      "-vf",
      vf,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-r",
      "30",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-shortest",
      videoPath,
    ]);
  } else {
    await run(ffmpegPath, [
      "-y",
      "-loop",
      "1",
      "-i",
      imagePath,
      "-f",
      "lavfi",
      "-t",
      String(duration),
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-t",
      String(duration),
      "-vf",
      vf,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-r",
      "30",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-shortest",
      videoPath,
    ]);
  }

  console.log(`rendered ${videoPath}`);
  return videoPath;
}

async function concatSegments(segmentPaths) {
  const concatFile = path.join(buildDir, "concat.txt");
  const concatBody = segmentPaths
    .map((segmentPath) => `file '${segmentPath.replace(/'/g, "'\\''")}'`)
    .join("\n");

  await fs.writeFile(concatFile, `${concatBody}\n`, "utf8");

  await run(ffmpegPath, [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatFile,
    "-c",
    "copy",
    outputFile,
  ]);
}

async function main() {
  await fs.mkdir(buildDir, { recursive: true });
  await ensureReadable(fontPath);

  const rendered = [];
  for (let i = 0; i < segments.length; i += 1) {
    const pathToSegment = await renderSegment(segments[i], i);
    rendered.push(pathToSegment);
  }

  await concatSegments(rendered);
  console.log(`presentation video created: ${outputFile}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
