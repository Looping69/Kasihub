import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { degrees, PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type ShareCertificatePdfData = {
  certificateNumber: string;
  holderName: string;
  holderAddress?: string;
  profileNumber: string;
  orderReference?: string;
  totalShares: number;
  issuedAt: string;
  status: string;
  campaignName?: string;
  paidShares?: number;
  bonusShares?: number;
  distinctiveFrom?: number;
  distinctiveTo?: number;
  issuePricePerShare?: number;
  issuePriceCurrency?: string;
};

const TEMPLATE_PATH = path.join(process.cwd(), "public", "certificate-templates", "solidus-shareholder-certificate.pdf");
const NAVY = rgb(0.035, 0.105, 0.2);
const WHITE = rgb(1, 1, 1);

function fitText(value: string, font: PDFFont, initialSize: number, maxWidth: number, minimumSize = 6) {
  let size = initialSize;
  while (size > minimumSize && font.widthOfTextAtSize(value, size) > maxWidth) size -= 0.5;
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return { value, size };
  let shortened = value;
  while (shortened.length > 1 && font.widthOfTextAtSize(`${shortened}...`, size) > maxWidth) shortened = shortened.slice(0, -1);
  return { value: `${shortened}...`, size };
}

function centeredInBox(page: PDFPage, value: string, x: number, width: number, y: number, font: PDFFont, initialSize = 9) {
  const fitted = fitText(value, font, initialSize, width - 10);
  page.drawText(fitted.value, {
    x: x + (width - font.widthOfTextAtSize(fitted.value, fitted.size)) / 2,
    y,
    size: fitted.size,
    font,
    color: NAVY,
  });
}

function wrappedLines(value: string, font: PDFFont, size: number, maxWidth: number, maxLines: number) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.at(-1);
    const candidate = current ? `${current} ${word}` : word;
    if (!current || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      if (current) lines[lines.length - 1] = candidate;
      else lines.push(candidate);
    } else if (lines.length < maxLines) {
      lines.push(word);
    }
  }
  if (lines.length > maxLines) lines.length = maxLines;
  return lines;
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
  if ((data.distinctiveFrom === undefined) !== (data.distinctiveTo === undefined)) throw new Error("incomplete_distinctive_range");
  if (data.distinctiveFrom !== undefined && data.distinctiveTo !== undefined) {
    if (!Number.isInteger(data.distinctiveFrom) || !Number.isInteger(data.distinctiveTo)
      || data.distinctiveFrom <= 0 || data.distinctiveTo < data.distinctiveFrom
      || data.distinctiveTo - data.distinctiveFrom + 1 !== data.totalShares) {
      throw new Error("invalid_distinctive_range");
    }
  }
  if ((data.issuePricePerShare === undefined) !== (data.issuePriceCurrency === undefined)) throw new Error("incomplete_issue_price");
  if (data.issuePricePerShare !== undefined && (!Number.isFinite(data.issuePricePerShare) || data.issuePricePerShare < 0)) {
    throw new Error("invalid_issue_price");
  }
  const issuedDate = new Date(data.issuedAt);
  if (Number.isNaN(issuedDate.getTime())) throw new Error("invalid_issue_date");

  const pdf = await PDFDocument.load(await readFile(TEMPLATE_PATH));
  const page = pdf.getPage(0);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const issueLabel = new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(issuedDate);
  const issueLongLabel = new Intl.DateTimeFormat("en-ZA", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(issuedDate);
  const validationCode = createHash("sha256")
    .update([data.certificateNumber, data.profileNumber, data.totalShares, issuedDate.toISOString()].join("|"))
    .digest("hex")
    .slice(0, 16)
    .toUpperCase();
  const revoked = data.status.toLowerCase() === "revoked";

  centeredInBox(page, data.distinctiveFrom?.toLocaleString("en-ZA") ?? "N/A", 617, 53, 470, bold, 8);
  centeredInBox(page, data.distinctiveTo?.toLocaleString("en-ZA") ?? "N/A", 670, 54, 470, bold, 8);
  centeredInBox(page, data.totalShares.toLocaleString("en-ZA"), 724, 53, 470, bold, 8);

  const owner = fitText(data.holderName.trim().toUpperCase(), bold, 9, 158);
  page.drawText(owner.value, { x: 82, y: 178, size: owner.size, font: bold, color: NAVY });
  const addressLines = wrappedLines((data.holderAddress?.trim() || "ADDRESS HELD ON REGISTER").toUpperCase(), regular, 6.5, 158, 2);
  addressLines.forEach((line, index) => page.drawText(line, { x: 82, y: 147 - (index * 10), size: 6.5, font: regular, color: NAVY }));

  centeredInBox(page, "CLASS B", 244, 101, 165, bold, 9);
  const issuePriceLabel = data.issuePricePerShare === undefined
    ? "SEE REGISTER"
    : `${data.issuePriceCurrency!.trim().toUpperCase()} ${data.issuePricePerShare.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  centeredInBox(page, issuePriceLabel, 345, 86, 165, bold, 7.5);
  centeredInBox(page, data.orderReference?.trim() || data.profileNumber, 431, 86, 165, bold, 7.5);
  centeredInBox(page, issueLabel, 517, 86, 165, bold, 7.5);
  centeredInBox(page, data.certificateNumber, 603, 86, 165, bold, 7);
  centeredInBox(page, data.totalShares.toLocaleString("en-ZA"), 689, 87, 165, bold, 10);

  page.drawRectangle({ x: 95, y: 91, width: 550, height: 24, color: WHITE });
  page.drawText(`Given on behalf of the company electronically on ${issueLongLabel}.`, { x: 105, y: 100, size: 8.5, font: regular, color: NAVY });

  const directorSignature = "/s/ Lelanie Retief";
  const cfoSignature = "/s/ Tertius du Plessis";
  page.drawText(directorSignature, { x: 106, y: 64, size: 10, font: italic, color: NAVY });
  page.drawText(cfoSignature, { x: 393, y: 64, size: 10, font: italic, color: NAVY });
  page.drawRectangle({ x: 102, y: 37, width: 150, height: 16, color: WHITE });
  page.drawRectangle({ x: 397, y: 37, width: 145, height: 16, color: WHITE });
  page.drawText("LELANIE RETIEF - DIRECTOR", { x: 113, y: 43, size: 7.5, font: bold, color: NAVY });
  page.drawText("TERTIUS DU PLESSIS - CFO", { x: 402, y: 43, size: 7.5, font: bold, color: NAVY });
  if (revoked) {
    page.drawText("REVOKED", { x: 272, y: 260, size: 70, font: bold, color: rgb(0.72, 0.12, 0.12), opacity: 0.2, rotate: degrees(18) });
  }

  pdf.setTitle(`${data.certificateNumber} - Solidus Holdings Share Certificate`);
  pdf.setAuthor("Solidus Holdings (Pty) Ltd");
  pdf.setSubject(`Class B non-voting share certificate for profile ${data.profileNumber}`);
  pdf.setCreator("KaSiHUB Share Register");
  pdf.setProducer("KaSiHUB Share Register using approved Solidus certificate template");
  pdf.setKeywords(["Solidus Holdings", "Class B", "non-voting share", `validation:${validationCode}`]);
  pdf.setCreationDate(issuedDate);
  pdf.setModificationDate(issuedDate);
  return pdf.save();
}
