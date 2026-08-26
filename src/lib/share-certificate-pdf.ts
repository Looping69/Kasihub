import { createHash } from "node:crypto";
import { degrees, PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type ShareCertificatePdfData = {
  certificateNumber: string;
  holderName: string;
  profileNumber: string;
  totalShares: number;
  issuedAt: string;
  status: string;
  campaignName?: string;
  paidShares?: number;
  bonusShares?: number;
};

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;

function fitText(value: string, font: PDFFont, initialSize: number, maxWidth: number) {
  let size = initialSize;
  while (size > 10 && font.widthOfTextAtSize(value, size) > maxWidth) size -= 0.5;
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return { value, size };
  let shortened = value;
  while (shortened.length > 1 && font.widthOfTextAtSize(`${shortened}...`, size) > maxWidth) shortened = shortened.slice(0, -1);
  return { value: `${shortened}...`, size };
}

function centeredText(page: PDFPage, value: string, y: number, size: number, font: PDFFont, color: ReturnType<typeof rgb>) {
  page.drawText(value, { x: (PAGE_WIDTH - font.widthOfTextAtSize(value, size)) / 2, y, size, font, color });
}

export async function generateShareCertificatePdf(data: ShareCertificatePdfData): Promise<Uint8Array> {
  if (!data.certificateNumber.trim()) throw new Error("certificate_number_required");
  if (!data.holderName.trim()) throw new Error("holder_name_required");
  if (!Number.isInteger(data.totalShares) || data.totalShares <= 0) throw new Error("invalid_share_quantity");
  if (data.paidShares !== undefined || data.bonusShares !== undefined) {
    if (!Number.isInteger(data.paidShares) || data.paidShares! <= 0 || !Number.isInteger(data.bonusShares) || data.bonusShares! < 0) {
      throw new Error("invalid_share_allocation");
    }
    if (data.paidShares! + data.bonusShares! !== data.totalShares) throw new Error("share_allocation_mismatch");
  }
  const issuedDate = new Date(data.issuedAt);
  if (Number.isNaN(issuedDate.getTime())) throw new Error("invalid_issue_date");

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const green = rgb(0.035, 0.35, 0.23);
  const deepGreen = rgb(0.025, 0.22, 0.15);
  const gold = rgb(0.82, 0.55, 0.09);
  const paleGold = rgb(0.99, 0.97, 0.88);
  const ink = rgb(0.09, 0.11, 0.1);
  const muted = rgb(0.37, 0.4, 0.38);
  const white = rgb(1, 1, 1);
  const revoked = data.status.toLowerCase() === "revoked";
  const issueLabel = new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(issuedDate);
  const validationCode = createHash("sha256")
    .update([data.certificateNumber, data.profileNumber, data.totalShares, issuedDate.toISOString()].join("|"))
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();

  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(0.975, 0.978, 0.96) });
  page.drawRectangle({ x: 22, y: 22, width: PAGE_WIDTH - 44, height: PAGE_HEIGHT - 44, borderColor: green, borderWidth: 5 });
  page.drawRectangle({ x: 31, y: 31, width: PAGE_WIDTH - 62, height: PAGE_HEIGHT - 62, borderColor: gold, borderWidth: 1.5 });
  page.drawRectangle({ x: 42, y: 42, width: PAGE_WIDTH - 84, height: PAGE_HEIGHT - 84, borderColor: green, borderWidth: 0.6 });

  page.drawRectangle({ x: 43, y: 477, width: PAGE_WIDTH - 86, height: 74, color: green });
  centeredText(page, "SOLIDUS HOLDINGS (PTY) LTD", 532, 10, bold, rgb(0.93, 0.82, 0.46));
  centeredText(page, "KaSiShares Certificate", 503, 29, serifBold, white);
  centeredText(page, "CLASS B PRIVATE SHARES", 487, 8.5, bold, rgb(0.8, 0.91, 0.85));

  centeredText(page, "THIS CERTIFIES THAT", 439, 8.5, bold, gold);
  const holder = fitText(data.holderName.trim(), serifBold, 24, 610);
  centeredText(page, holder.value, 403, holder.size, serifBold, ink);
  page.drawLine({ start: { x: 150, y: 394 }, end: { x: PAGE_WIDTH - 150, y: 394 }, thickness: 0.8, color: gold });
  centeredText(page, "is recorded in the share register as the holder of", 372, 11, serif, muted);
  centeredText(page, `${data.totalShares.toLocaleString("en-ZA")} Class B KaSiShare${data.totalShares === 1 ? "" : "s"}`, 335, 24, serifBold, deepGreen);
  if (data.campaignName) {
    const campaign = fitText(`Campaign: ${data.campaignName}`, bold, 9, 620);
    centeredText(page, campaign.value, 318, campaign.size, bold, muted);
  }
  if (data.paidShares !== undefined && data.bonusShares !== undefined) {
    centeredText(page, `Paid allocation: ${data.paidShares.toLocaleString("en-ZA")}  |  Bonus allocation: ${data.bonusShares.toLocaleString("en-ZA")}`, 304, 8.5, regular, muted);
  }

  const fieldY = 245;
  const fieldWidth = 224;
  const fieldX = [68, 309, 550];
  const field = (x: number, label: string, value: string) => {
    page.drawRectangle({ x, y: fieldY, width: fieldWidth, height: 54, color: paleGold, borderColor: rgb(0.88, 0.82, 0.62), borderWidth: 0.7 });
    page.drawText(label, { x: x + 12, y: fieldY + 36, size: 7.5, font: bold, color: gold });
    const fitted = fitText(value, bold, 11, fieldWidth - 24);
    page.drawText(fitted.value, { x: x + 12, y: fieldY + 15, size: fitted.size, font: bold, color: ink });
  };
  field(fieldX[0], "CERTIFICATE NUMBER", data.certificateNumber);
  field(fieldX[1], "PROFILE NUMBER", data.profileNumber);
  field(fieldX[2], "DATE ISSUED", issueLabel);

  page.drawRectangle({ x: 68, y: 147, width: 116, height: 90, color: gold, opacity: 0.12, borderColor: gold, borderWidth: 1.5 });
  page.drawCircle({ x: 126, y: 192, size: 36, color: gold, borderColor: green, borderWidth: 2 });
  page.drawText("KSH", { x: 101, y: 185, size: 17, font: bold, color: white });

  page.drawText("Certificate status", { x: 218, y: 216, size: 8, font: bold, color: muted });
  page.drawText(data.status.toUpperCase(), { x: 218, y: 195, size: 13, font: bold, color: revoked ? rgb(0.7, 0.12, 0.12) : green });
  page.drawText("Validation code", { x: 390, y: 216, size: 8, font: bold, color: muted });
  page.drawText(validationCode, { x: 390, y: 195, size: 11, font: bold, color: ink });

  page.drawText("This certificate reflects the authoritative KaSiHUB share register entry at the date of issue.", { x: 218, y: 167, size: 8.5, font: regular, color: muted });
  page.drawText("Share rights remain governed by the issuer's MOI, applicable law and the approved subscription terms.", { x: 218, y: 152, size: 8.5, font: regular, color: muted });

  if (revoked) {
    page.drawText("REVOKED", { x: 285, y: 278, size: 68, font: bold, color: rgb(0.72, 0.12, 0.12), opacity: 0.15, rotate: degrees(18) });
  }

  page.drawLine({ start: { x: 68, y: 116 }, end: { x: PAGE_WIDTH - 68, y: 116 }, thickness: 0.7, color: rgb(0.78, 0.8, 0.77) });
  page.drawText("Generated electronically from the KaSiHUB share register. No handwritten signature is required.", { x: 68, y: 94, size: 7.5, font: regular, color: muted });
  page.drawText(`Certificate ${data.certificateNumber}`, { x: 68, y: 77, size: 7.5, font: bold, color: deepGreen });
  const footer = "Solidus Holdings (Pty) Ltd | KaSiHUB";
  page.drawText(footer, { x: PAGE_WIDTH - 68 - bold.widthOfTextAtSize(footer, 7.5), y: 77, size: 7.5, font: bold, color: deepGreen });

  pdf.setTitle(`${data.certificateNumber} - KaSiShares Certificate`);
  pdf.setAuthor("Solidus Holdings (Pty) Ltd");
  pdf.setSubject(`Class B KaSiShares certificate for profile ${data.profileNumber}`);
  pdf.setCreator("KaSiHUB Share Register");
  pdf.setCreationDate(issuedDate);
  pdf.setModificationDate(issuedDate);
  return pdf.save();
}
