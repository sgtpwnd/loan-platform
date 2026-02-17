require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const puppeteer = require("puppeteer");
const { PrismaClient } = require("@prisma/client");
const esignRouter = require("./esign/router");
const { STORAGE_ROOT, ensureStorage } = require("./esign/storage");

const app = express();
const PORT = process.env.STATEMENT_PORT || 5050;
const prisma = new PrismaClient();

app.use(express.json({ limit: "20mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  return next();
});

ensureStorage().catch(() => undefined);
app.use("/esign-files", express.static(STORAGE_ROOT));
app.use("/api/esign", esignRouter);

const parseOrgId = (value) => {
  if (!value || typeof value !== "string") return null;
  return value.trim() || null;
};

const toStartOfCurrentMonthUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

app.get("/api/dashboard/summary", async (req, res) => {
  const organizationId = parseOrgId(req.query.organizationId);
  const loanWhere = organizationId ? { organizationId } : {};
  const borrowerWhere = organizationId ? { organizationId } : {};
  const chargeWhere = organizationId
    ? { loan: { organizationId } }
    : {};
  const scheduledPaymentWhere = organizationId ? { organizationId } : {};
  const monthStart = toStartOfCurrentMonthUtc();

  try {
    const [
      totalLoans,
      fundedLoans,
      activeLoans,
      borrowers,
      pendingCharges,
      loansFundedThisMonth,
      dueThisMonthCount,
      dueThisMonthAmountRaw,
      scheduledFailed,
      scheduledTotal,
      statusBreakdownRaw,
      recentFundedLoans,
    ] = await Promise.all([
      prisma.loan.count({ where: loanWhere }),
      prisma.loan.count({ where: { ...loanWhere, status: "FUNDED" } }),
      prisma.loan.count({
        where: {
          ...loanWhere,
          status: { in: ["PRE_APPROVED", "IN_REVIEW", "APPROVED", "CLOSING", "FUNDED"] },
        },
      }),
      prisma.borrower.count({ where: borrowerWhere }),
      prisma.charge.count({ where: { ...chargeWhere, status: "PENDING" } }),
      prisma.loan.count({
        where: {
          ...loanWhere,
          fundedDate: { gte: monthStart },
        },
      }),
      prisma.charge.count({
        where: {
          ...chargeWhere,
          dueDate: { gte: monthStart },
        },
      }),
      prisma.charge.aggregate({
        where: {
          ...chargeWhere,
          dueDate: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
      prisma.scheduledPayment.count({
        where: { ...scheduledPaymentWhere, status: "FAILED" },
      }),
      prisma.scheduledPayment.count({ where: scheduledPaymentWhere }),
      prisma.loan.groupBy({
        by: ["status"],
        where: loanWhere,
        _count: { status: true },
      }),
      prisma.loan.findMany({
        where: { ...loanWhere, status: "FUNDED" },
        orderBy: { fundedDate: "desc" },
        take: 5,
        select: {
          id: true,
          fundedDate: true,
          amount: true,
          borrower: {
            select: {
              name: true,
            },
          },
        },
      }),
    ]);

    const delinquencyRate = scheduledTotal
      ? Number(((scheduledFailed / scheduledTotal) * 100).toFixed(1))
      : 0;

    const statusBreakdown = statusBreakdownRaw.map((entry) => ({
      status: entry.status,
      count: entry._count.status,
    }));

    return res.json({
      summary: {
        totalLoans,
        fundedLoans,
        activeLoans,
        borrowers,
        pendingCharges,
        loansFundedThisMonth,
        chargesDueThisMonthCount: dueThisMonthCount,
        chargesDueThisMonthAmount: dueThisMonthAmountRaw._sum.amount ?? 0,
        delinquencyRate30Plus: delinquencyRate,
      },
      statusBreakdown,
      recentFundedLoans: recentFundedLoans.map((loan) => ({
        id: loan.id,
        borrowerName: loan.borrower?.name ?? "Unknown",
        fundedDate: loan.fundedDate,
        amount: loan.amount,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard summary.";
    return res.status(500).json({ error: message });
  }
});

const templatePath = path.join(__dirname, "templates", "statement.html");
const stylePath = path.join(__dirname, "templates", "statement.css");

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatCurrency = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
};

const buildLogoBlock = (input) => {
  if (input && input.logoSvg) {
    return input.logoSvg;
  }
  if (input && input.logoUrl) {
    return `<img src="${escapeHtml(input.logoUrl)}" alt="Logo" />`;
  }
  return `
    <svg viewBox="0 0 48 48" aria-label="Logo" role="img">
      <rect width="48" height="48" rx="10" fill="#0f172a"></rect>
      <path d="M14 30l6-12 8 16 6-12" stroke="#ffffff" stroke-width="3" fill="none" />
    </svg>
  `;
};

const buildPaymentRows = (paymentHistory = []) => {
  if (!Array.isArray(paymentHistory) || paymentHistory.length === 0) {
    return `<tr><td class="empty" colspan="6">No payments recorded.</td></tr>`;
  }
  return paymentHistory
    .map((payment) => {
      return `
        <tr>
          <td>${escapeHtml(payment.date || "—")}</td>
          <td>${escapeHtml(payment.description || "—")}</td>
          <td class="amount">${formatCurrency(payment.amount)}</td>
          <td class="amount">${formatCurrency(payment.principal)}</td>
          <td class="amount">${formatCurrency(payment.interest)}</td>
          <td class="amount">${formatCurrency(payment.balance)}</td>
        </tr>
      `;
    })
    .join("");
};

const buildTotalsRows = (totals = {}) => {
  const rows = [
    ["Principal Paid", formatCurrency(totals.principalPaid)],
    ["Interest Paid", formatCurrency(totals.interestPaid)],
    ["Fees Paid", formatCurrency(totals.feesPaid)],
    ["Total Paid", formatCurrency(totals.totalPaid)],
    ["Remaining Balance", formatCurrency(totals.remainingBalance)],
    ["Next Payment Due", escapeHtml(totals.nextPaymentDue || "—")],
    ["Next Payment Amount", formatCurrency(totals.nextPaymentAmount)],
  ];
  return rows
    .map(
      ([label, value]) => `
        <div class="totals-row">
          <div>${escapeHtml(label)}</div>
          <div class="amount">${value}</div>
        </div>
      `
    )
    .join("");
};

const validatePayload = (payload) => {
  const required = ["borrowerName", "loanNumber", "statementDate"];
  const missing = required.filter((key) => !payload || !payload[key]);
  if (missing.length) {
    return `Missing required fields: ${missing.join(", ")}`;
  }
  if (!Array.isArray(payload.paymentHistory)) {
    return "paymentHistory must be an array.";
  }
  if (!payload.totals || typeof payload.totals !== "object") {
    return "totals must be an object.";
  }
  return null;
};

const renderStatementHtml = async (payload) => {
  const [template, styles] = await Promise.all([
    fs.readFile(templatePath, "utf-8"),
    fs.readFile(stylePath, "utf-8"),
  ]);

  const replacements = {
    styles,
    borrowerName: escapeHtml(payload.borrowerName),
    loanNumber: escapeHtml(payload.loanNumber),
    statementDate: escapeHtml(payload.statementDate),
    logoBlock: buildLogoBlock(payload),
    paymentRows: buildPaymentRows(payload.paymentHistory),
    totalsRows: buildTotalsRows(payload.totals),
    totalPaid: formatCurrency(payload.totals.totalPaid),
    interestPaid: formatCurrency(payload.totals.interestPaid),
    remainingBalance: formatCurrency(payload.totals.remainingBalance),
  };

  return template.replace(/{{\s*([\w]+)\s*}}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(replacements, key)
      ? replacements[key]
      : match;
  });
};

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);

app.post("/generate-statement", async (req, res) => {
  const error = validatePayload(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  let browser;
  try {
    const html = await renderStatementHtml(req.body);

    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=medium",
      ],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    await withTimeout(
      page.setContent(html, { waitUntil: "domcontentloaded" }),
      30000,
      "Render"
    );

    const pdfData = await withTimeout(
      page.pdf({
        format: "Letter",
        printBackground: true,
        scale: 1,
        preferCSSPageSize: true,
      }),
      30000,
      "PDF generation"
    );
    const pdfBuffer = Buffer.from(pdfData);

    const safeLoan = String(req.body.loanNumber).replace(/[^a-zA-Z0-9-_]+/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Loan-Statement-${safeLoan}.pdf"`
    );
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF generation failed.";
    console.error("[statement-pdf]", message);
    return res.status(500).json({ error: message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.post("/preview-term-sheet", (req, res) => {
  const html = req.body?.html;
  if (!html || typeof html !== "string") {
    return res.status(400).json({ error: "Missing html payload." });
  }
  return res.status(200).type("html").send(html);
});

app.post("/generate-term-sheet", async (req, res) => {
  const html = req.body?.html;
  const fileName = req.body?.fileName || "Term-Sheet.pdf";
  if (!html || typeof html !== "string") {
    return res.status(400).json({ error: "Missing html payload." });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=medium",
      ],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    await withTimeout(
      page.setContent(html, { waitUntil: "domcontentloaded" }),
      30000,
      "Render"
    );

    const pdfData = await withTimeout(
      page.pdf({
        format: "Letter",
        printBackground: true,
        scale: 1,
        preferCSSPageSize: true,
      }),
      30000,
      "PDF generation"
    );

    const pdfBuffer = Buffer.from(pdfData);
    const safeName = String(fileName).replace(/[^a-zA-Z0-9-_\.]+/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF generation failed.";
    console.error("[term-sheet-pdf]", message);
    return res.status(500).json({ error: message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

app.get("/generate-statement", (req, res) => {
  const examplePayload = {
    borrowerName: "Test Borrower",
    loanNumber: "LN-123",
    statementDate: "February 7, 2026",
    paymentHistory: [
      {
        date: "2026-01-01",
        description: "Monthly payment",
        amount: 1250,
        principal: 900,
        interest: 350,
        balance: 148750,
      },
    ],
    totals: {
      principalPaid: 900,
      interestPaid: 350,
      feesPaid: 0,
      totalPaid: 1250,
      remainingBalance: 148750,
      nextPaymentDue: "March 1, 2026",
      nextPaymentAmount: 1250,
    },
  };

  const exampleJson = JSON.stringify(examplePayload, null, 2);
  const exampleCurl = `curl -o statement.pdf -H "Content-Type: application/json" \\\n  -X POST http://localhost:${PORT}/generate-statement \\\n  --data '${exampleJson.replace(/'/g, "\\'")}'`;

  res.status(200).type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>PDF Statement Generator</title>
    <style>
      :root {
        color-scheme: light;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 32px;
        color: #0f172a;
        background: #f8fafc;
      }
      .card {
        max-width: 920px;
        background: #ffffff;
        border-radius: 16px;
        padding: 28px 32px;
        box-shadow: 0 20px 45px rgba(15, 23, 42, 0.1);
      }
      h1 {
        margin: 0 0 12px;
        font-size: 24px;
      }
      p {
        margin: 0 0 12px;
        color: #475569;
      }
      code,
      pre {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
          "Courier New", monospace;
      }
      pre {
        background: #0f172a;
        color: #f8fafc;
        padding: 16px;
        border-radius: 12px;
        overflow: auto;
        font-size: 13px;
        line-height: 1.5;
      }
      .label {
        font-weight: 600;
        color: #0f172a;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>PDF Statement Generator</h1>
      <p>This endpoint only accepts <span class="label">POST</span> requests with JSON.</p>
      <p>Use the example below to generate a PDF statement:</p>
      <pre>${exampleCurl}</pre>
      <p>JSON schema (example):</p>
      <pre>${exampleJson}</pre>
    </div>
  </body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`PDF statement server running on http://localhost:${PORT}`);
});
