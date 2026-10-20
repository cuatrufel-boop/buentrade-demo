// The Sales Order PDF (the document the customer receives, in English; the email / WhatsApp that carry it are in Spanish), drawn once for
// every page that sends it (orders.html and offers.html), in the Purchase Order's layout: CUSTOMER / DELIVER TO blocks, label / value rows, one
// blue-header table, NOTES and TERMS. Uses each page's own PDF helpers and constants (pdfDoc, pdfHeader, pdfInfoBlock, pdfKeyValueRows, pdfTerms,
// pdfFooter, CONTACT_EMAIL_SO, btNum, fmtDateStr, todayStr), which both pages define identically.

const SO_TERMS_EN = "This Sales Order is issued by BuenTrade LLC. By accepting this Sales Order, Buyer agrees to the quantity, price, and delivery terms stated above. Product is sold as described, subject to normal industry tolerances in weight and count. Payment is due per the terms stated above from the date of delivery unless otherwise agreed in writing. Any discrepancy in product, weight, or condition must be reported to BuenTrade LLC in writing within 24 hours of delivery.";

// s = document.sales_order of orders-compose-so.
function bcRenderSO(s, orderNumber){
  const doc = pdfDoc();
  pdfHeader(doc, 'Sales Order', 'SO-BT-' + btNum(orderNumber), CONTACT_EMAIL_SO);

  const blockLook = { labelSize: 10, size: 11.5, lineH: 16, gap: 19 };
  const rowLook = { size: 10.5, step: 28, lineH: 14 };
  pdfInfoBlock(doc, 40, 186, 'CUSTOMER', s.customer, blockLook);
  pdfInfoBlock(doc, 320, 186, 'DELIVER TO', s.deliver_to, blockLook);
  // pdfInfoBlock draws without saying where it ends: a long customer address must push the rows down instead of running into them.
  doc.setFont('helvetica', 'normal'); doc.setFontSize(blockLook.size);
  const blockLines = Math.max(...[s.customer, s.deliver_to].map(lines => lines.filter(Boolean).reduce((k, l) => k + doc.splitTextToSize(String(l), 260).length, 0)));
  const rowsY = Math.max(304, 186 + blockLook.gap + blockLines * blockLook.lineH + 34);

  const yLeft = pdfKeyValueRows(doc, 40, rowsY, [
    ['DATE', todayStr()],
    ['DELIVERY DATE', fmtDateStr(s.delivery_date) || 'TBD'],
    ['PAYMENT TERMS', s.payment_terms],
    ['ORDER #', 'SO-BT-' + btNum(orderNumber)],
  ], rowLook);
  const yRight = pdfKeyValueRows(doc, 320, rowsY, [
    ['INCOTERMS', s.incoterms],
    ['COUNTRY OF ORIGIN', s.country_of_origin],
    ['CURRENCY', s.currency],
  ], rowLook);

  const li = s.line_item;
  doc.autoTable({
    startY: Math.max(yLeft, yRight) + 22,
    head: [['Item Description', li.unit === 'kg' ? 'Qty KG' : 'Qty LBS', li.unit === 'kg' ? 'MXN / KG' : 'USD / LBS', 'Amount', 'DEL Date', 'Sales Rep']], // a customer invoiced in pesos: kilos and MX$
    body: [[
      li.description || '',
      (li.weight || 0).toLocaleString('en-US'),
      (li.unit === 'kg' ? 'MX$' : '$') + (li.price || 0).toFixed(li.unit === 'kg' ? 2 : 4),
      (li.unit === 'kg' ? 'MX$' : '$') + (li.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
      fmtDateStr(s.delivery_date) || 'TBD',
      s.sales_rep || '',
    ]],
    theme: 'grid',
    headStyles: { fillColor: [30, 106, 219], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 10.5, cellPadding: { top: 11, bottom: 11, left: 7, right: 7 } },
    columnStyles: { 1: { cellWidth: 62 }, 2: { cellWidth: 70 } }, // short headers (Qty LBS, USD / LBS) stay on one line, as on the PO
    margin: { left: 40, right: 40 },
  });

  let ty = doc.lastAutoTable.finalY + 34;
  if (s.mxn_equivalent){
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100, 116, 139);
    doc.text('MXN EQUIVALENT: $' + Number(s.mxn_equivalent.amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) + ` (FX rate ${s.mxn_equivalent.rate})`, 40, ty - 10);
    ty += 18;
  }

  // NOTES: the Purchase Order's own lines (temperature, export docs).
  const noteLines = (s.notes || []).filter(Boolean);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(30, 106, 219);
  doc.text('NOTES', 40, ty);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
  noteLines.forEach((n, i) => doc.text(n, 40, ty + 17 + i * 15));
  const notesEnd = ty + 17 + Math.max(0, noteLines.length - 1) * 15;

  pdfTerms(doc, notesEnd + 46, 'TERMS', SO_TERMS_EN, { titleSize: 10, size: 8.5, lineH: 12, gap: 17 });
  pdfFooter(doc, 'en');
  return doc;
}
