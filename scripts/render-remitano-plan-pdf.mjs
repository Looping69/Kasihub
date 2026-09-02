import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

// ( |╲ ) — Klaasvaakie. Renders the internal Remitano receiving-plan PDF.
const htmlPath = resolve('docs/KaSiShares-Remitano-Receiving-Plan.html');
const pdfPath = resolve('output/KaSiShares-Remitano-Receiving-Plan.pdf');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
await page.screenshot({ path: resolve('output/KaSiShares-Remitano-Receiving-Plan-preview.png'), fullPage: true });
await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
