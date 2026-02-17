const nodemailer = require("nodemailer");

const buildTransport = () => {
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const host =
    process.env.ESIGN_SMTP_HOST || (sendgridKey ? "smtp.sendgrid.net" : undefined);
  const port = Number(
    process.env.ESIGN_SMTP_PORT || (sendgridKey ? 587 : 587)
  );
  const user = process.env.ESIGN_SMTP_USER || (sendgridKey ? "apikey" : undefined);
  const pass = process.env.ESIGN_SMTP_PASS || sendgridKey;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

const formatFrom = () => {
  const name = process.env.ESIGN_FROM_NAME || "Loan Platform";
  const email = process.env.ESIGN_FROM_EMAIL || process.env.ESIGN_SMTP_USER;
  return email ? `${name} <${email}>` : name;
};

const buildSignUrl = (envelopeId, accessToken) => {
  const baseUrl = process.env.ESIGN_PUBLIC_BASE_URL || "http://localhost:3000";
  return `${baseUrl}/esign/envelopes/${envelopeId}/sign?token=${accessToken}`;
};

const sendRecipientEmail = async ({ envelope, recipient, type = "invite" }) => {
  const transporter = buildTransport();
  const signUrl = buildSignUrl(envelope.id, recipient.accessToken);
  const subject =
    type === "reminder"
      ? `Reminder: Please sign ${envelope.subject || "document"}`
      : `Please sign ${envelope.subject || "document"}`;

  const message = `
    <p>Hello ${recipient.name || recipient.email},</p>
    <p>Please sign the document: <strong>${envelope.subject || "Loan document"}</strong>.</p>
    <p><a href="${signUrl}">Open document to sign</a></p>
    <p>If you have questions, reply to this email.</p>
  `;

  if (!transporter) {
    return { delivered: false, signUrl };
  }

  try {
    await transporter.sendMail({
      from: formatFrom(),
      to: recipient.email,
      subject,
      html: message,
    });
    return { delivered: true, signUrl };
  } catch (error) {
    console.warn("ESIGN email failed:", error);
    return {
      delivered: false,
      signUrl,
      error: error instanceof Error ? error.message : "Email failed",
    };
  }
};

module.exports = {
  sendRecipientEmail,
  buildSignUrl,
};
