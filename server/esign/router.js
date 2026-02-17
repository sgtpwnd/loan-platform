const express = require("express");
const crypto = require("crypto");
const puppeteer = require("puppeteer");
const { PrismaClient } = require("@prisma/client");
const { PDFDocument } = require("pdf-lib");
const {
  ensureStorage,
  saveTemplatePdf,
  saveEnvelopePdf,
  loadTemplatePdf,
  generateAccessToken,
} = require("./storage");
const { applyFieldsToPdf } = require("./pdf");
const { sendRecipientEmail } = require("./mailer");

const prisma = new PrismaClient();
const router = express.Router();

const requireApiKey = (req, res, next) => {
  const requiredKey = process.env.ESIGN_API_KEY;
  if (!requiredKey) return next();
  const provided = req.header("x-api-key");
  if (provided !== requiredKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
};

router.use(requireApiKey);

const resolveOrganizationId = async (payload) => {
  if (payload.organizationId) return payload.organizationId;
  if (payload.organizationSlug) {
    const org = await prisma.organization.findUnique({
      where: { slug: payload.organizationSlug },
      select: { id: true },
    });
    return org?.id ?? null;
  }
  return null;
};

const normalizeFields = (fields) => {
  if (!Array.isArray(fields)) return [];
  return fields
    .map((field) => ({
      role: String(field.role || "SIGNER"),
      type: field.type,
      label: field.label ? String(field.label) : null,
      page: Number(field.page || 1),
      x: Number(field.x || 0),
      y: Number(field.y || 0),
      width: Number(field.width || 0.2),
      height: Number(field.height || 0.05),
      required: field.required !== false,
      readOnly: field.readOnly === true,
    }))
    .filter((field) => field.type);
};

const createTemplateFromPdf = async ({
  organizationId,
  name,
  description,
  pdfBase64,
  roles,
  fields,
}) => {
  const templateId = crypto.randomUUID();
  const { url: fileUrl } = await saveTemplatePdf({
    templateId,
    pdfBase64,
  });
  const pdfDoc = await PDFDocument.load(await loadTemplatePdf(fileUrl));
  const pageCount = pdfDoc.getPageCount();

  const template = await prisma.template.create({
    data: {
      id: templateId,
      organizationId,
      name,
      description: description || null,
      fileUrl,
      pageCount,
      roles: roles || null,
    },
  });

  const normalizedFields = normalizeFields(fields);
  if (normalizedFields.length) {
    await prisma.field.createMany({
      data: normalizedFields.map((field) => ({ ...field, templateId: template.id })),
    });
  }

  return prisma.template.findUnique({
    where: { id: template.id },
    include: { fields: true },
  });
};

router.get("/templates", async (req, res) => {
  const orgId =
    req.query.organizationId ||
    (await resolveOrganizationId({ organizationSlug: req.query.slug }));
  if (!orgId) return res.status(400).json({ error: "organizationId is required" });
  const templates = await prisma.template.findMany({
    where: { organizationId: String(orgId) },
    orderBy: { createdAt: "desc" },
    include: { fields: true },
  });
  return res.json({ templates });
});

router.get("/templates/:id", async (req, res) => {
  const template = await prisma.template.findUnique({
    where: { id: req.params.id },
    include: { fields: true },
  });
  if (!template) return res.status(404).json({ error: "Template not found." });
  return res.json({ template });
});

router.post("/templates", async (req, res) => {
  const orgId = await resolveOrganizationId(req.body || {});
  if (!orgId) return res.status(400).json({ error: "organizationId is required" });
  if (!req.body?.name) return res.status(400).json({ error: "name is required" });
  if (!req.body?.pdfBase64) {
    return res.status(400).json({ error: "pdfBase64 is required" });
  }

  const withFields = await createTemplateFromPdf({
    organizationId: orgId,
    name: req.body.name,
    description: req.body.description,
    pdfBase64: req.body.pdfBase64,
    roles: req.body.roles,
    fields: req.body.fields,
  });

  return res.status(201).json({ template: withFields });
});

router.post("/templates/html", async (req, res) => {
  const orgId = await resolveOrganizationId(req.body || {});
  if (!orgId) return res.status(400).json({ error: "organizationId is required" });
  if (!req.body?.name) return res.status(400).json({ error: "name is required" });
  if (!req.body?.html) return res.status(400).json({ error: "html is required" });

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    const page = await browser.newPage();
    await page.setContent(req.body.html, { waitUntil: "networkidle0" });
    const pdfData = await page.pdf({
      format: "Letter",
      printBackground: true,
      scale: 1,
      preferCSSPageSize: true,
    });

    const pdfBase64 = Buffer.from(pdfData).toString("base64");
    const withFields = await createTemplateFromPdf({
      organizationId: orgId,
      name: req.body.name,
      description: req.body.description,
      pdfBase64,
      roles: req.body.roles,
      fields: req.body.fields,
    });
    return res.status(201).json({ template: withFields });
  } catch (error) {
    return res.status(500).json({ error: "Failed to render HTML to PDF." });
  } finally {
    if (browser) await browser.close();
  }
});

router.put("/templates/:id", async (req, res) => {
  const template = await prisma.template.findUnique({
    where: { id: req.params.id },
  });
  if (!template) return res.status(404).json({ error: "Template not found." });

  await prisma.template.update({
    where: { id: template.id },
    data: {
      name: req.body?.name ?? template.name,
      description: req.body?.description ?? template.description,
      roles: req.body?.roles ?? template.roles,
    },
  });

  if (Array.isArray(req.body?.fields)) {
    await prisma.field.deleteMany({ where: { templateId: template.id } });
    const fields = normalizeFields(req.body.fields);
    if (fields.length) {
      await prisma.field.createMany({
        data: fields.map((field) => ({ ...field, templateId: template.id })),
      });
    }
  }

  const withFields = await prisma.template.findUnique({
    where: { id: template.id },
    include: { fields: true },
  });
  return res.json({ template: withFields });
});

router.post("/envelopes", async (req, res) => {
  const orgId = await resolveOrganizationId(req.body || {});
  if (!orgId) return res.status(400).json({ error: "organizationId is required" });
  if (!req.body?.templateId) {
    return res.status(400).json({ error: "templateId is required" });
  }
  if (!Array.isArray(req.body?.recipients) || req.body.recipients.length === 0) {
    return res.status(400).json({ error: "recipients are required" });
  }

  const template = await prisma.template.findUnique({
    where: { id: req.body.templateId },
    include: { fields: true },
  });
  if (!template) return res.status(404).json({ error: "Template not found." });

  const envelope = await prisma.envelope.create({
    data: {
      organizationId: orgId,
      templateId: template.id,
      loanId: req.body.loanId || null,
      subject: req.body.subject || null,
      message: req.body.message || null,
    },
  });

  if (template.fields.length) {
    await prisma.field.createMany({
      data: template.fields.map((field) => ({
        role: field.role,
        type: field.type,
        label: field.label,
        page: field.page,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        required: field.required,
        readOnly: field.readOnly,
        envelopeId: envelope.id,
      })),
    });
  }

  const recipients = req.body.recipients.map((recipient) => ({
    envelopeId: envelope.id,
    role: recipient.role,
    name: recipient.name,
    email: recipient.email,
    signingOrder: Number(recipient.signingOrder ?? recipient.order ?? 1),
    accessToken: generateAccessToken(),
  }));

  await prisma.recipient.createMany({ data: recipients });
  await prisma.auditEvent.create({
    data: {
      envelopeId: envelope.id,
      type: "CREATED",
      actorEmail: req.body.createdBy ?? null,
    },
  });

  const withRelations = await prisma.envelope.findUnique({
    where: { id: envelope.id },
    include: { recipients: true, fields: true, template: true },
  });
  return res.status(201).json({ envelope: withRelations });
});

router.post("/envelopes/:id/send", async (req, res) => {
  const envelope = await prisma.envelope.findUnique({
    where: { id: req.params.id },
    include: { recipients: true },
  });
  if (!envelope) return res.status(404).json({ error: "Envelope not found." });

  const ordered = [...envelope.recipients].sort(
    (a, b) => a.signingOrder - b.signingOrder
  );
  if (ordered.length === 0) {
    return res.status(400).json({ error: "No recipients assigned." });
  }

  await prisma.recipient.updateMany({
    where: { envelopeId: envelope.id },
    data: { status: "PENDING" },
  });
  await prisma.recipient.update({
    where: { id: ordered[0].id },
    data: { status: "SENT" },
  });
  await prisma.envelope.update({
    where: { id: envelope.id },
    data: { status: "SENT" },
  });
  const mailResult = await sendRecipientEmail({
    envelope,
    recipient: ordered[0],
    type: "invite",
  });

  await prisma.recipient.update({
    where: { id: ordered[0].id },
    data: {
      lastSentAt: new Date(),
      sentCount: { increment: 1 },
    },
  });

  await prisma.auditEvent.create({
    data: {
      envelopeId: envelope.id,
      type: "SENT",
      actorEmail: req.body?.sentBy ?? null,
      payload: {
        recipient: ordered[0].email,
        delivered: mailResult.delivered,
        signUrl: mailResult.signUrl,
      },
    },
  });

  return res.json({ status: "sent" });
});

router.post("/envelopes/:id/remind", async (req, res) => {
  const envelope = await prisma.envelope.findUnique({
    where: { id: req.params.id },
    include: { recipients: true },
  });
  if (!envelope) return res.status(404).json({ error: "Envelope not found." });

  const recipient =
    (req.body?.recipientId &&
      envelope.recipients.find((item) => item.id === req.body.recipientId)) ||
    envelope.recipients
      .filter((item) => item.status !== "SIGNED")
      .sort((a, b) => a.signingOrder - b.signingOrder)[0];

  if (!recipient) {
    return res.status(400).json({ error: "No pending recipient found." });
  }

  const mailResult = await sendRecipientEmail({
    envelope,
    recipient,
    type: "reminder",
  });

  await prisma.recipient.update({
    where: { id: recipient.id },
    data: {
      lastSentAt: new Date(),
      sentCount: { increment: 1 },
    },
  });

  await prisma.auditEvent.create({
    data: {
      envelopeId: envelope.id,
      type: "REMINDER_SENT",
      actorEmail: req.body?.sentBy ?? null,
      payload: {
        recipient: recipient.email,
        delivered: mailResult.delivered,
        signUrl: mailResult.signUrl,
      },
    },
  });

  return res.json({ status: "reminded" });
});

router.post("/envelopes/:id/view", async (req, res) => {
  const envelope = await prisma.envelope.findUnique({
    where: { id: req.params.id },
    include: { recipients: true },
  });
  if (!envelope) return res.status(404).json({ error: "Envelope not found." });

  const recipient = envelope.recipients.find(
    (item) => item.accessToken === req.body?.accessToken
  );
  if (!recipient) return res.status(401).json({ error: "Invalid access token." });

  if (recipient.status === "SENT") {
    await prisma.recipient.update({
      where: { id: recipient.id },
      data: { status: "VIEWED" },
    });
    await prisma.auditEvent.create({
      data: {
        envelopeId: envelope.id,
        type: "VIEWED",
        actorEmail: recipient.email,
        actorRole: recipient.role,
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || null,
      },
    });
  }

  return res.json({ ok: true });
});

router.get("/envelopes/:id", async (req, res) => {
  const envelope = await prisma.envelope.findUnique({
    where: { id: req.params.id },
    include: { recipients: true, fields: true, template: true, auditEvents: true },
  });
  if (!envelope) return res.status(404).json({ error: "Envelope not found." });
  return res.json({ envelope });
});

router.get("/envelopes/:id/document", async (req, res) => {
  const envelope = await prisma.envelope.findUnique({
    where: { id: req.params.id },
    include: { template: true },
  });
  if (!envelope) return res.status(404).json({ error: "Envelope not found." });

  const pdfBuffer = await loadTemplatePdf(envelope.template.fileUrl);
  res.setHeader("Content-Type", "application/pdf");
  return res.send(pdfBuffer);
});

router.get("/envelopes/:id/audit", async (req, res) => {
  const events = await prisma.auditEvent.findMany({
    where: { envelopeId: req.params.id },
    orderBy: { createdAt: "asc" },
  });
  return res.json({ events });
});

router.post("/envelopes/:id/sign", async (req, res) => {
  const envelope = await prisma.envelope.findUnique({
    where: { id: req.params.id },
    include: { recipients: true, fields: true, template: true },
  });
  if (!envelope) return res.status(404).json({ error: "Envelope not found." });

  const { accessToken, fields } = req.body || {};
  const recipient = envelope.recipients.find(
    (item) => item.accessToken === accessToken
  );
  if (!recipient) return res.status(401).json({ error: "Invalid access token." });

  if (envelope.status !== "SENT") {
    return res.status(400).json({ error: "Envelope is not active." });
  }

  const pendingRecipients = envelope.recipients.filter((r) => r.status !== "SIGNED");
  if (pendingRecipients.length === 0) {
    return res.status(400).json({ error: "Envelope already completed." });
  }
  const currentOrder = Math.min(...pendingRecipients.map((r) => r.signingOrder));
  if (recipient.signingOrder !== currentOrder) {
    return res.status(403).json({ error: "Signing order enforced." });
  }

  if (!Array.isArray(fields)) {
    return res.status(400).json({ error: "fields are required." });
  }

  const updates = fields
    .map((field) => ({
      id: field.id,
      value: field.value,
    }))
    .filter((field) => field.id);

  for (const update of updates) {
    const target = envelope.fields.find((f) => f.id === update.id);
    if (!target) continue;
    if (target.role !== recipient.role) continue;
    await prisma.field.update({
      where: { id: target.id },
      data: {
        value: String(update.value ?? ""),
        signedAt: new Date(),
      },
    });
  }

  const updatedFields = await prisma.field.findMany({
    where: { envelopeId: envelope.id },
  });

  const pendingRequired = updatedFields.filter(
    (field) => field.role === recipient.role && field.required && !field.value
  );
  if (pendingRequired.length) {
    return res.json({ status: "partial", missing: pendingRequired.map((f) => f.id) });
  }

  await prisma.recipient.update({
    where: { id: recipient.id },
    data: { status: "SIGNED", signedAt: new Date() },
  });

  await prisma.auditEvent.create({
    data: {
      envelopeId: envelope.id,
      type: "SIGNED",
      actorEmail: recipient.email,
      actorRole: recipient.role,
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || null,
    },
  });

  const remaining = envelope.recipients
    .filter((r) => r.id !== recipient.id)
    .filter((r) => r.status !== "SIGNED")
    .sort((a, b) => a.signingOrder - b.signingOrder);

  if (remaining.length === 0) {
    const pdfBuffer = await loadTemplatePdf(envelope.template.fileUrl);
    const signedPdf = await applyFieldsToPdf({
      pdfBuffer,
      fields: updatedFields,
    });
    const saved = await saveEnvelopePdf({
      envelopeId: envelope.id,
      pdfBuffer: Buffer.from(signedPdf),
    });

    await prisma.envelope.update({
      where: { id: envelope.id },
      data: {
        status: "COMPLETED",
        lockedAt: new Date(),
        completedAt: new Date(),
        finalPdfUrl: saved.url,
      },
    });

    await prisma.auditEvent.create({
      data: {
        envelopeId: envelope.id,
        type: "COMPLETED",
      },
    });

    return res.json({ status: "completed", pdfUrl: saved.url });
  }

  const nextRecipient = remaining[0];
  await prisma.recipient.update({
    where: { id: nextRecipient.id },
    data: { status: "SENT" },
  });

  const mailResult = await sendRecipientEmail({
    envelope,
    recipient: nextRecipient,
    type: "invite",
  });

  await prisma.recipient.update({
    where: { id: nextRecipient.id },
    data: {
      lastSentAt: new Date(),
      sentCount: { increment: 1 },
    },
  });

  await prisma.auditEvent.create({
    data: {
      envelopeId: envelope.id,
      type: "SENT",
      payload: {
        recipient: nextRecipient.email,
        delivered: mailResult.delivered,
        signUrl: mailResult.signUrl,
      },
    },
  });

  return res.json({ status: "signed", nextRecipientId: nextRecipient.id });
});

module.exports = router;
