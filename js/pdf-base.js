// The PDF building blocks every BuenTrade document is drawn with (Purchase Order, Sales Order, Freight Order, Invoice, signature certificate),
// loaded by orders.html, offers.html, trading-tool.html and sign-invoice.html so the four pages print the same way. Each page defines COMPANY.

function pdfDoc(){
  const { jsPDF } = window.jspdf;
  return new jsPDF({ unit: 'pt', format: 'letter' });
}

function pdfHeader(doc, docTitle, orderNumber, contactEmail){
  doc.setFillColor(10, 37, 71);
  doc.rect(0, 0, 612, 88, 'F');

  // Real correction 2026-09-14: "pon solo buentrade como esta en home y quita ese logo... no es de
  // buentrade" — the icon (circle/wave/rect) was only ever a decorative mark on the sign-in gate
  // screen, never the real persistent brand mark; the actual app header (dashboard.html and every
  // other page's nav) is plain text only — "Buen" white + "Trade" blue, no icon. Text-only here now
  // too, shifted to the header's own left margin since there's no icon to sit next to.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(255, 255, 255);
  doc.text(COMPANY.name1, 40, 46);
  const w = doc.getTextWidth(COMPANY.name1);
  doc.setTextColor(94, 175, 255);
  doc.text(COMPANY.name2, 40 + w, 46);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(178, 197, 222);
  doc.text(COMPANY.address, 40, 60);
  doc.text(`${contactEmail}  ·  ${COMPANY.phone}`, 40, 71);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(10, 37, 71);
  doc.text(docTitle, 40, 120);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const chipText = String(orderNumber);
  const chipW = doc.getTextWidth(chipText) + 26;
  doc.setFillColor(30, 106, 219);
  doc.roundedRect(572 - chipW, 105, chipW, 21, 5, 5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(chipText, 572 - chipW / 2, 119.5, { align: 'center' });

  doc.setDrawColor(226, 233, 242);
  doc.setLineWidth(1);
  doc.line(40, 134, 572, 134);
  doc.setTextColor(15, 31, 51);
}

// Real bug found live 2026-09-06 checking the Factura against the real MBG reference: a long
// Mexican address (common — full street + colonia + CP + city) ran past this column's width and
// bled straight into the second column's text with no line break, making both unreadable. Each
// line now wraps to the column width instead of printing as one unbroken run.
function pdfInfoBlock(doc, x, y, label, lines, o = {}){
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(o.labelSize || 9);
  doc.setTextColor(30, 106, 219);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(o.size || 10.5);
  doc.setTextColor(15, 31, 51);
  let cursorY = y + (o.gap || 16);
  (lines || []).filter(Boolean).forEach(line => {
    const wrapped = doc.splitTextToSize(String(line), 260);
    doc.text(wrapped, x, cursorY);
    cursorY += wrapped.length * (o.lineH || 13);
  });
}

function pdfKeyValueRows(doc, x, y, rows, o = {}){
  let cursorY = y;
  rows.forEach(([k, v]) => {
    if (!v) return;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(o.size || 9.5);
    doc.setTextColor(30, 106, 219);
    doc.text(k, x, cursorY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 31, 51);
    // A long value (a full incoterm such as "FCA – Smithfield Foods, Smithfield, VA") wraps inside its column instead of running off the page.
    const pageW = doc.internal.pageSize.getWidth();
    const limit = x < pageW / 2 ? pageW / 2 + 4 : pageW - 40;
    const valueLines = doc.splitTextToSize(String(v), Math.max(60, limit - (x + 150)));
    doc.text(valueLines, x + 150, cursorY);
    cursorY += Math.max(o.step || 17, valueLines.length * (o.lineH || 12) + 5);
  });
  return cursorY;
}

function pdfTerms(doc, y, title, text, o = {}){
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(o.titleSize || 9);
  doc.setTextColor(30, 106, 219);
  doc.text(title, 40, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(o.size || 8);
  doc.setTextColor(120, 130, 145);
  const split = doc.splitTextToSize(text, 532);
  doc.text(split, 40, y + (o.gap || 14));
  // Where the block ends, with the breathing room the layouts below it were built around.
  return y + (o.gap || 14) + split.length * (o.lineH || 10) + 22;
}

function pdfSignatureBlock(doc, y, leftLabel, rightLabel){
  const colW = 240, rx = 332;
  doc.setDrawColor(150, 160, 175);
  doc.setLineWidth(0.75);
  doc.line(40, y, 40 + colW, y);
  doc.line(rx, y, rx + colW, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(leftLabel, 40, y + 12);
  doc.text(rightLabel, rx, y + 12);
  doc.setFontSize(7.5);
  doc.setTextColor(150, 160, 175);
  doc.text('Date: ______________', 40, y + 26);
  doc.text('Date: ______________', rx, y + 26);
}

function pdfFooter(doc, lang){
  doc.setDrawColor(226, 233, 242);
  doc.setLineWidth(0.75);
  doc.line(40, 758, 572, 758);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(160, 170, 185);
  const stamp = lang === 'es'
    ? `Generado ${new Date().toLocaleString('es-MX')}`
    : `Generated ${new Date().toLocaleString('en-US')}`;
  doc.text(stamp, 40, 770);
  doc.text(lang === 'es' ? 'Página 1 de 1' : 'Page 1 of 1', 572, 770, { align: 'right' });
}
