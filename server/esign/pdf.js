const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const drawCheckmark = (page, x, y, size) => {
  const strokeWidth = Math.max(1, size * 0.12);
  page.drawLine({
    start: { x, y: y + size * 0.45 },
    end: { x: x + size * 0.35, y: y + size * 0.1 },
    thickness: strokeWidth,
    color: rgb(0.1, 0.1, 0.1),
  });
  page.drawLine({
    start: { x: x + size * 0.32, y: y + size * 0.1 },
    end: { x: x + size * 0.85, y: y + size * 0.85 },
    thickness: strokeWidth,
    color: rgb(0.1, 0.1, 0.1),
  });
};

const applyFieldsToPdf = async ({ pdfBuffer, fields }) => {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();
  for (const field of fields) {
    if (!field || !field.value) continue;
    const pageIndex = Math.max(0, (field.page || 1) - 1);
    const page = pages[pageIndex];
    if (!page) continue;

    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const width = clamp(field.width, 0.01, 1) * pageWidth;
    const height = clamp(field.height, 0.01, 1) * pageHeight;
    const left = clamp(field.x, 0, 1) * pageWidth;
    const top = clamp(field.y, 0, 1) * pageHeight;
    const bottom = pageHeight - top - height;

    const fontSize = Math.max(8, Math.min(14, height * 0.65));

    if (field.type === "CHECKBOX") {
      drawCheckmark(page, left + 2, bottom + 2, Math.min(width, height) - 4);
      continue;
    }

    const text = String(field.value ?? "");
    page.drawText(text, {
      x: left + 4,
      y: bottom + (height - fontSize) / 2,
      size: fontSize,
      font,
      color: rgb(0.08, 0.08, 0.1),
      maxWidth: width - 8,
    });
  }

  return pdfDoc.save();
};

module.exports = {
  applyFieldsToPdf,
};
