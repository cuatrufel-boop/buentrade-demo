// The Invoice PDF (to the customer, in English with the product's full Spanish name), drawn once for every page that makes it: orders.html
// (preview / resend), trading-tool.html (first send, unsigned) and sign-invoice.html (the customer's signed copy) — the signed and the unsigned
// invoice are the same document. Same layout as the Purchase Order and the Sales Order. orders-compose-so composes every value (document.invoice);
// this only prints it. Needs js/pdf-base.js and the page's COMPANY / CONTACT_EMAIL_SO.

// Where the customer pays (user 2026-10-04, exact text, all under WIRE INSTRUCTIONS).
const INVOICE_WIRE = ['Summar Financial LLC', '2299 SW 27th Ave.', 'Miami, FL 33145', 'Bank of America', 'Account number: 0036 6939 6990', 'ABA 026009593', 'SWIFT: BOFAUS3N', 'Summar Financial LLC c/o Buentrade LLC'];
const INVOICE_TERMS = "This Invoice is issued by BuenTrade LLC. By signing in acknowledgment, the Customer confirms receipt of the merchandise described under the terms stated herein and accepts the outstanding balance and payment due date. The product is delivered as described, subject to standard industry tolerances in weight and count. Any discrepancy must be reported to BuenTrade LLC in writing within 24 hours of signing this invoice.";

// INVOICE CLIENT (owner 2026-11-21, step 11 of the new 12-step flow): the e-mail and the WhatsApp to the client and the e-mail to the customs agency, his texts. f = { number: 'INV-BT-2026-1002', contact, boxes, weight, unit ('kg' or 'lbs'),
// total, pesos, signLink, clientName, agencyName }. The wire instructions printed on the invoice are written in the client's e-mail too, so nobody has to look for them in the PDF.
function bcInvoiceMoney(n, pesos){ return (pesos ? 'MX$' : '$') + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function bcInvoiceClientEmail(f){
  return {
    subject: `${f.number} | Tu Factura Definitiva y firma de recibo`,
    body: [
      `Hola${f.contact ? ' ' + f.contact : ''},`, '',
      `Te compartimos adjunta la Factura Definitiva de tu Orden ${f.number}, emitida con los datos reales verificados en cruce:`, '',
      `* Total ${f.countKind === 'combos' ? 'combos' : 'cajas'}: ${f.boxes}`,
      `* Peso neto real: ${Number(f.weight || 0).toLocaleString('en-US')} ${f.unit === 'kg' ? 'kg' : 'lbs'}`,
      `* Total a pagar: ${bcInvoiceMoney(f.total, f.pesos)}`, '',
      'WIRE INSTRUCTIONS', ...INVOICE_WIRE, '',
      'Para completar el cierre de entrega, por favor regálanos tu firma de recibido en esta liga:', '',
      `👉 ${f.signLink}`, '',
      'Quedamos a tus órdenes para cualquier consulta.', '',
      'Saludos,',
    ].join('\n'),
  };
}
function bcInvoiceClientWhatsApp(f){
  return [
    `Hola${f.contact ? ' ' + f.contact : ''}, te saludamos de BuenTrade 🤝.`, '',
    `Te enviamos por correo la Factura Definitiva de tu Orden ${f.number} (${f.boxes} ${f.countKind === 'combos' ? 'combos' : 'cajas'} | ${bcInvoiceMoney(f.total, f.pesos)}).`, '',
    'Para cerrar la entrega, por favor regálanos tu firma de recibido en esta liga:',
    `👉 ${f.signLink}`, '',
    'Quedamos a tus órdenes. ¡Muchas gracias!',
  ].join('\n');
}
function bcInvoiceCustomsEmail(f){
  return {
    subject: `${f.number} | Final Commercial Invoice – ${f.clientName}`,
    body: [
      `Hi${f.agencyName ? ' ' + f.agencyName : ''} team,`, '',
      `Please find attached the Final Commercial Invoice for Order ${f.number} (${f.clientName}), updated with the confirmed crossing weights and box count.`, '',
      'Best regards,',
    ].join('\n'),
  };
}

// inv = document.invoice of orders-compose-so; signature = { dataUrl, name, at } once the customer signed (at = when, default now), else null.
function bcRenderInvoice(inv, orderNumber, signature){
  const num = 'INV-BT-' + String(orderNumber || '').replace(/^BT-/, '');
  const day = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? `${m[2]}/${m[3]}/${m[1]}` : null; };
  const pesos = !!(inv.line_item && inv.line_item.unit === 'kg'); // a customer invoiced in pesos: kilos and MX$
  const money = (n) => (pesos ? 'MX$' : '$') + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const doc = pdfDoc();
  pdfHeader(doc, 'Invoice', num, CONTACT_EMAIL_SO);

  const blockLook = { labelSize: 9.5, size: 10.5, lineH: 14, gap: 17 };
  const rowLook = { size: 9.5, step: 20, lineH: 12 };
  const linesOf = (lines, width) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(blockLook.size); return lines.filter(Boolean).reduce((k, l) => k + doc.splitTextToSize(String(l), width).length, 0); };

  let y = 172;
  pdfInfoBlock(doc, 40, y, 'CUSTOMER', inv.customer, blockLook);
  pdfInfoBlock(doc, 320, y, 'DELIVER TO', inv.deliver_to, blockLook);
  y += blockLook.gap + Math.max(linesOf(inv.customer, 260), linesOf(inv.deliver_to, 260)) * blockLook.lineH + 22;

  const yLeft = pdfKeyValueRows(doc, 40, y, [
    ['INVOICE DATE', day(inv.invoice_date)],
    ['DELIVERY DATE', day(inv.delivery_date) || 'TBD'],
    ['DUE DATE', day(inv.due_date) || inv.due_label],
    ['PAYMENT TERMS', inv.payment_terms],
    ['INVOICE #', num],
  ], rowLook);
  const yRight = pdfKeyValueRows(doc, 320, y, [
    ['INCOTERMS', inv.incoterms],
    ['COUNTRY OF ORIGIN', inv.country_of_origin],
    ['CURRENCY', inv.currency],
  ], rowLook);

  const li = inv.line_item;
  const hasCount = Number(li.count) >= 1; // the real boxes (or combos) of the customs document, once the invoice was created (owner 2026-11-23)
  doc.autoTable({
    startY: Math.max(yLeft, yRight) + 8,
    head: [['Item Description', ...(hasCount ? [li.count_kind === 'combos' ? 'Combos' : 'Boxes'] : []), pesos ? 'Qty KG' : 'Qty LBS', pesos ? 'MXN / KG' : 'USD / LBS', 'Amount']],
    body: [[(li.description || '') + (li.brand ? '\nBrand: ' + li.brand : ''), ...(hasCount ? [Number(li.count).toLocaleString('en-US')] : []), Number(li.weight || 0).toLocaleString('en-US'), (pesos ? 'MX$' : '$') + Number(li.price || 0).toFixed(pesos ? 2 : 4), money(li.total)]],
    theme: 'grid',
    headStyles: { fillColor: [30, 106, 219], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 10.5, cellPadding: { top: 9, bottom: 9, left: 7, right: 7 } },
    columnStyles: hasCount ? { 1: { cellWidth: 56 }, 2: { cellWidth: 72 }, 3: { cellWidth: 78 }, 4: { cellWidth: 100, halign: 'right' } } : { 1: { cellWidth: 72 }, 2: { cellWidth: 78 }, 3: { cellWidth: 100, halign: 'right' } },
    margin: { left: 40, right: 40 },
  });

  // NOTES on the left (the Purchase Order's lines), the totals on the right.
  let ty = doc.lastAutoTable.finalY + 24;
  const notes = (inv.notes || []).filter(Boolean);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(30, 106, 219);
  doc.text('NOTES', 40, ty);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(100, 116, 139);
  notes.forEach((n, i) => doc.text(n, 40, ty + 15 + i * 13));
  [['Total', inv.line_item.total], ['Payments / Credits', inv.payments], ['Balance Due', inv.balance]].forEach(([label, amt], i) => {
    doc.setFont('helvetica', i === 2 ? 'bold' : 'normal'); doc.setFontSize(10); doc.setTextColor(15, 31, 51);
    doc.text(label, 392, ty + i * 16);
    doc.text(money(amt), 572, ty + i * 16, { align: 'right' });
  });
  doc.setDrawColor(205, 216, 230); doc.setLineWidth(0.75); doc.line(392, ty + 22, 572, ty + 22);
  ty += Math.max(15 + notes.length * 13, 3 * 16) + 22;

  // WIRE INSTRUCTIONS on the left, the customer's signature on the right.
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(30, 106, 219);
  doc.text('WIRE INSTRUCTIONS', 40, ty);
  doc.text('CUSTOMER SIGNATURE', 320, ty);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(15, 31, 51);
  INVOICE_WIRE.forEach((l, i) => doc.text(l, 40, ty + 14 + i * 11));
  const wireEnd = ty + 14 + INVOICE_WIRE.length * 11;
  const sigLineY = ty + 64;
  doc.btSigBox = { page: doc.internal.getCurrentPageInfo().pageNumber, x: 320, y: ty + 4, w: 252, h: 58, pw: doc.internal.pageSize.getWidth(), ph: doc.internal.pageSize.getHeight() }; // where the customer's signature goes: the signature page puts a tappable field right there (owner 2026-11-27: "firme el campo")
  if (signature && signature.dataUrl) doc.addImage(signature.dataUrl, 'PNG', 320, ty + 6, 165, 55);
  doc.setDrawColor(150, 160, 175); doc.setLineWidth(0.75); doc.line(320, sigLineY, 572, sigLineY);
  doc.setFontSize(8); doc.setTextColor(100, 116, 139);
  const sigText = signature && signature.dataUrl
    ? `${signature.name || 'Customer'} — ${new Date(signature.at || Date.now()).toLocaleString('en-US', { timeZone: 'America/New_York' })}`
    : 'Pending customer signature — see the confirmation link sent separately.';
  doc.splitTextToSize(sigText, 252).forEach((l, i) => doc.text(l, 320, sigLineY + 11 + i * 10));
  ty = Math.max(wireEnd, sigLineY + 21) + 20;

  pdfTerms(doc, ty, 'TERMS', INVOICE_TERMS, { titleSize: 9.5, size: 8, lineH: 10, gap: 14 });
  pdfFooter(doc, 'en');
  return doc;
}
