import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import { cv, telephoneHref, telephoneLabel } from './catalogue';
import { site } from '../data/public';

export async function makeCvPdf() {
  // Astro invokes this server-side at build time from the repository root.
  const assets = resolve(process.cwd(), 'assets');
  const pdf = new PDFDocument({
    size: 'A4', margins: { top: 40, bottom: 35, left: 45, right: 45 },
    info: { Title: `${cv.name} — Curriculum Vitae`, Author: cv.name, CreationDate: new Date('2000-01-01T00:00:00Z') },
  });
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((accept, reject) => {
    pdf.on('data', chunk => chunks.push(chunk));
    pdf.once('end', () => accept(Buffer.concat(chunks)));
    pdf.once('error', reject);
  });
  pdf.registerFont('regular', resolve(assets, 'fonts/dm-sans-400.ttf'));
  pdf.registerFont('bold', resolve(assets, 'fonts/dm-sans-700.ttf'));
  pdf.image(resolve(process.cwd(), 'public/brand/apple-touch-icon.png'), 489, 38, { width: 61 });
  pdf.fillColor('#201f1c').font('bold').fontSize(27).text(cv.name, { width: 425 });
  pdf.fillColor('#a42018').fontSize(11).text(cv.title);
  pdf.moveDown(.3).font('regular').fontSize(9.5).fillColor('#423e39').text(cv.location);
  pdf.text(cv.email, { link: `mailto:${cv.email}`, underline: true, continued: true });
  pdf.text('   /   ', { continued: true, underline: false, link: null });
  pdf.text(new URL(site).hostname, { link: site, underline: true });
  pdf.text(telephoneLabel, { link: telephoneHref, underline: true });
  cv.links.forEach((profile, index) => {
    if (index) pdf.text('   /   ', { continued: true, link: null, underline: false });
    pdf.text(profile.title, { link: profile.url, underline: true, continued: index < cv.links.length - 1 });
  });
  pdf.moveDown(.55).fillColor('#33302c').text(cv.summary, { lineGap: 1.5 });
  for (const section of cv.sections) {
    if (!section.items.length) continue;
    pdf.moveDown(.65);
    const line = pdf.y;
    pdf.moveTo(45, line).lineTo(550, line).strokeColor('#d7d1c9').stroke();
    pdf.y += 6;
    pdf.font('bold').fontSize(11).fillColor('#a42018').text(section.title);
    for (const item of section.items) {
      const link = 'url' in item && typeof item.url === 'string' ? item.url : undefined;
      pdf.moveDown(.2).font('bold').fontSize(9.5).fillColor('#201f1c').text(item.title, { link, underline: Boolean(link) });
      pdf.font('regular').fontSize(9.2).fillColor('#423e39').text(item.summary, { lineGap: 1.2 });
    }
  }
  pdf.end();
  return finished;
}
