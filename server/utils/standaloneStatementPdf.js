import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';

export const statementMoney = (amount, currency) => {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits;
  return `${currency} ${(amount / 10 ** digits).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};
export function renderStandaloneStatementPdf(report, { daily = false } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    doc.registerFont(
      'Regular',
      fileURLToPath(new URL('../assets/fonts/DejaVuSans.ttf', import.meta.url))
    );
    doc.registerFont(
      'Bold',
      fileURLToPath(new URL('../assets/fonts/LiberationSans-Bold.ttf', import.meta.url))
    );
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    let y = 120;
    const width = 515,
      bottom = 776;
    const centerName = (id) =>
      report.centers.find((c) => String(c._id) === String(id))?.name || 'Center';
    const newPage = () => {
      doc.addPage();
      y = 60;
      doc
        .font('Bold')
        .fontSize(10)
        .fillColor('#28564b')
        .text('CLEMIFY / TEACHER STATEMENT', 40, 30, { width, lineBreak: false });
    };
    const ensure = (h) => {
      if (y + h > bottom) newPage();
    };
    const text = (value, { size = 10, bold = false, color = '#233b36', gap = 10 } = {}) => {
      // The compact bold font lacks Vietnamese glyphs; use the full font for those labels.
      const font = bold && !/[^\u0000-\u00ff]/.test(String(value)) ? 'Bold' : 'Regular';
      doc.font(font).fontSize(size);
      const h = doc.heightOfString(String(value), { width });
      ensure(h + gap);
      doc.font(font).fontSize(size).fillColor(color).text(String(value), 40, y, { width });
      y += h + gap;
    };
    doc.rect(0, 0, 596, 100).fill('#183f37');
    doc
      .fillColor('#d1eadf')
      .font('Bold')
      .fontSize(10)
      .text('CLEMIFY  /  THE TEACHER STUDIO', 40, 24);
    doc
      .fillColor('white')
      .fontSize(23)
      .text(daily ? 'Your daily teaching summary' : 'Earnings statement', 40, 48);
    text(report.teacherName || 'Independent teacher', { size: 16, bold: true });
    text(
      report.centers.length === 1
        ? report.centers[0].name
        : 'All centers - separate center accounts',
      { bold: true }
    );
    text(`${report.from} to ${report.to}  |  ${report.timezone}`, { color: '#526760' });
    text('Completed classes', { size: 14, bold: true, gap: 12 });
    const cols = [
      { label: 'Completed / class', w: 213 },
      { label: 'Minutes', w: 47 },
      { label: 'Gross', w: 85 },
      { label: 'Charges', w: 85 },
      { label: 'Net', w: 85 },
    ];
    const header = () => {
      ensure(26);
      doc.rect(40, y, width, 24).fill('#e5eee9');
      let x = 40;
      for (const c of cols) {
        doc
          .font('Bold')
          .fontSize(9)
          .fillColor('#183f37')
          .text(c.label, x + 5, y + 7, { width: c.w - 10 });
        x += c.w;
      }
      y += 26;
    };
    header();
    if (!report.entries.length) text('No completed classes in this date range.');
    const sortedEntries = [...report.entries].sort(
      (a, b) =>
        centerName(a.centerId).localeCompare(centerName(b.centerId)) ||
        String(a.centerId).localeCompare(String(b.centerId)) ||
        +new Date(a.date) - +new Date(b.date)
    );
    for (const row of sortedEntries) {
      const date = new Intl.DateTimeFormat('en-GB', {
        timeZone: report.timezone,
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(row.date));
      const label = `${date}\n${row.title}\n${row.student} | ${centerName(row.centerId)}`;
      const values = [
        label,
        String(row.duration),
        statementMoney(row.amountMinor, row.currency),
        statementMoney(row.chargesMinor, row.currency),
        statementMoney(row.netMinor, row.currency),
      ];
      doc.font('Regular').fontSize(9);
      const height =
        Math.max(...values.map((v, i) => doc.heightOfString(v, { width: cols[i].w - 10 }))) + 16;
      if (y + height > bottom) {
        newPage();
        header();
      }
      let x = 40;
      values.forEach((v, i) => {
        doc
          .font('Regular')
          .fontSize(9)
          .fillColor('#233b36')
          .text(v, x + 5, y + 6, { width: cols[i].w - 10 });
        x += cols[i].w;
      });
      y += height;
      doc.moveTo(40, y).lineTo(555, y).strokeColor('#dce5df').stroke();
    }
    y += 16;
    text('Calculated charges', { size: 14, bold: true });
    if (!report.charges.length) text('No charges apply.');
    for (const charge of report.charges)
      text(
        `${charge.month} | ${centerName(charge.centerId)} | ${charge.name}${charge.kind === 'percent' ? ` (${charge.value / 100}%)` : ''}: ${statementMoney(charge.amountMinor, charge.currency)}`
      );
    text(
      "Charges follow UTC calendar months. Monthly charges are allocated by each class's share of gross earnings (equally if gross is zero). Partial-month figures can change until the month closes.",
      { size: 8, color: '#526760' }
    );
    y += 6;
    text('Payments received in this period', { size: 14, bold: true });
    if (!report.payments.length) text('No payments recorded in this date range.');
    for (const payment of report.payments)
      text(
        `${new Intl.DateTimeFormat('en-GB', { timeZone: report.timezone, dateStyle: 'medium' }).format(new Date(payment.receivedAt))} | ${centerName(payment.centerId)} | ${payment.note || 'Payment received'}: ${statementMoney(payment.amountMinor, payment.currency)}`
      );
    text(
      'Receipts are recorded by center, not linked to individual classes. The period balance below is net earnings less receipts dated in this period; it is not an all-time account balance.',
      { size: 8, color: '#526760' }
    );
    y += 8;
    for (const total of report.totals) {
      ensure(200);
      const cardTop = y;
      doc.rect(40, y, width, 190).fill('#edf4ef');
      y += 12;
      text(total.centerName || centerName(total.centerId), { size: 12, bold: true });
      text(`${total.currency} SALARY TOTALS  /  ${total.lessons} completed classes`, {
        bold: true,
        size: 11,
      });
      text(
        `Gross salary: ${statementMoney(total.gross, total.currency)}    Charges: ${statementMoney(total.charges, total.currency)}`,
        { size: 10 }
      );
      text(`FINAL SALARY: ${statementMoney(total.net, total.currency)}`, { bold: true, size: 17 });
      text(`Payments received: ${statementMoney(total.received, total.currency)}`, { size: 10 });
      text(
        `${total.outstanding < 0 ? 'Receipts exceed period net' : 'Outstanding for period'}: ${statementMoney(Math.abs(total.outstanding), total.currency)}`,
        { bold: true, size: 10 }
      );
      y = Math.max(y + 14, cardTop + 202);
    }
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc
        .font('Regular')
        .fontSize(8)
        .fillColor('#65796f')
        .text(
          `Clemify | Generated ${new Date(report.generatedAt).toISOString().slice(0, 10)}`,
          40,
          802,
          { lineBreak: false }
        );
      doc.text(`${i + 1} / ${range.count}`, 505, 802, { lineBreak: false });
    }
    doc.end();
  });
}
