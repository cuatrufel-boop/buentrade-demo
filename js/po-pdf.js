// The Purchase Order PDF (the document the plant receives, in English), drawn once for every page that sends it (orders.html and offers.html).
// orders-compose-po composes every field; this only prints it. Uses each page's own PDF helpers and constants (pdfDoc, pdfHeader, pdfInfoBlock,
// pdfKeyValueRows, pdfTerms, pdfFooter, CONTACT_EMAIL_PO, btNum, todayStr), which both pages define identically.

const PO_TERMS = "This Purchase Order is issued by BuenTrade LLC and is subject to our standard terms of purchase. Product must meet applicable USDA and food-safety requirements for the stated product and packaging. Vendor must confirm pickup readiness with the assigned carrier at least 24 hours in advance of the scheduled pickup date. Any change in product availability, weight, or pickup date must be reported to BuenTrade LLC immediately. This order is valid only for the product, quantity, and price stated above.";

// composed = document of orders-compose-po.
function bcRenderPO(composed, orderNumber){
  const isFob = composed.incoterms.startsWith('FCA');
  const doc = pdfDoc();
  pdfHeader(doc, 'Purchase Order', 'PO-BT-' + btNum(orderNumber), CONTACT_EMAIL_PO);

  const vendorLines = composed.vendor.split('\n');
  // The page is laid out over its whole height (header band to footer) instead of stacked at the top: roomier blocks and rows, then the
  // item table, the notes and the terms spaced down toward the footer.
  const blockLook = { labelSize: 10, size: 11.5, lineH: 16, gap: 19 };
  const rowLook = { size: 10.5, step: 28, lineH: 14 };
  pdfInfoBlock(doc, 40, 186, 'VENDOR', vendorLines, blockLook);
  pdfInfoBlock(doc, 320, 186, isFob ? 'SHIP TO / PICK UP LOCATION' : 'DELIVER TO', composed.ship_to.split('\n'), blockLook);

  const yLeft = pdfKeyValueRows(doc, 40, 304, [
    ['DATE', todayStr()],
    [isFob ? 'PICK-UP DATE' : 'DELIVERY DATE', composed.pick_up_date],
    ['SHIP VIA', 'Refrigerated Trucking'],
    ['PAYMENT TERMS', composed.payment_terms],
    ['ORDER #', 'PO-BT-' + btNum(orderNumber)],
  ], rowLook);
  const yRight = pdfKeyValueRows(doc, 320, 304, [
    ['INCOTERMS', composed.incoterms],
    ['SUPPLIER PO', composed.supplier_po || ''],
    ['COUNTRY OF ORIGIN', composed.country_of_origin],
  ], rowLook);
  const y = Math.max(yLeft, yRight);

  doc.autoTable({
    startY: y + 22,
    head: [['Item Description', 'Qty LBS', 'Unit Cost', 'Amount', isFob ? 'PU Date' : 'DEL Date', 'Buyer']],
    body: [[
      composed.line_item.description || '',
      (composed.line_item.weight || 0).toLocaleString('en-US'),
      '$' + (composed.line_item.purchase_price || 0).toFixed(4),
      '$' + (composed.line_item.total_cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
      composed.pick_up_date || '',
      composed.trader || '',
    ]],
    theme: 'grid',
    headStyles: { fillColor: [30, 106, 219], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 10.5, cellPadding: { top: 11, bottom: 11, left: 7, right: 7 } },
    columnStyles: { 1: { cellWidth: 62 }, 2: { cellWidth: 66 } }, // short headers (Qty LBS, Unit Cost) stay on one line
    margin: { left: 40, right: 40 },
  });

  // NOTES: one line each — the temperature to hold the load at (from the product's own temperature) and the export-docs line.
  let ty = doc.lastAutoTable.finalY + 34;
  const noteLines = composed.notes && composed.notes.length ? composed.notes : [composed.docs_note];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 106, 219);
  doc.text('NOTES', 40, ty);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  noteLines.forEach((n, i) => doc.text(n, 40, ty + 17 + i * 15));
  const notesEnd = ty + 17 + (noteLines.length - 1) * 15;

  pdfTerms(doc, notesEnd + 46, 'TERMS', PO_TERMS, { titleSize: 10, size: 8.5, lineH: 12, gap: 17 });
  pdfFooter(doc, 'en');
  return doc;
}
