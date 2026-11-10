// THE OFFER EMAIL AS THE BLUE BARS TABLE (owner 2026-11-09: "emails?" / "Sí, constrúyela" — the same picture he approved for WhatsApp, "D me gusta… con link dentro"): in an EMAIL the links CAN sit inside the table. A customer's offer of ONE product with
// TWO OR MORE brands is drawn as the BuenTrade navy card: the product's name on top, one row per brand highest price first with a bar as long as its price and the price at the right in HIS currency ($ USD/lb at the border, $ MXN/kg for a pesos
// customer), the cheapest in green, and — beside a brand that has a spec sheet or a photo — a "ficha" link that opens it. HTML with inline styles and tables only (every mail app draws it, like the Monday card, js/weekly-card.js). Nothing here
// invents a number: brands, prices and links are the offer's own. The plain text stays as the message's own text (what shows if the trader edits it, and the part of the email a client without HTML reads).
(function (root) {
  const C = { navy: '#10244A', line: '#1A3160', blue: '#6AAAF5', green: '#3FCB7E', txt: '#FFFFFF', mut: '#9FB0C8', link: '#9EC5FA', linkLine: '#3B5F93' };
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const okUrl = (u) => (/^https?:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u) : '');
  const priceText = (p, cur) => (cur === 'mxn' ? '$' + Number(p).toFixed(2) + ' MXN/kg' : '$' + Number(p).toFixed(4) + ' USD/lb');
  const para = (t) => `<p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222;">${esc(t).replace(/\n/g, '<br>')}</p>`;

  // o: { name (the customer's first name), signalLine, title (the product), cur ('usd' | 'mxn'), isUpdate, delivery, pending, credit, rows: [{ brand, price, ficha }] }
  function offerCardHtml(o) {
    const rows = (o.rows || []).filter((r) => Number(r.price) > 0).slice().sort((a, b) => Number(b.price) - Number(a.price));
    if (rows.length < 1) return '';
    const max = Math.max(...rows.map((r) => Number(r.price))), min = Math.min(...rows.map((r) => Number(r.price)));
    const body = rows.map((r, i) => {
      const best = rows.length > 1 && Number(r.price) === min, color = best ? C.green : C.blue, pct = Math.max(6, Math.round(100 * Number(r.price) / max));
      const link = okUrl(r.ficha) ? `<a href="${esc(okUrl(r.ficha))}" style="color:${C.link};font-size:12px;font-weight:normal;text-decoration:none;border:1px solid ${C.linkLine};border-radius:6px;padding:1px 6px;margin-left:8px;white-space:nowrap;display:inline-block;">ficha</a>` : '';
      return `<tr>
        <td align="left" style="padding:12px 6px 4px 16px;border:0;border-top:1px solid ${C.line};font-size:15px;font-weight:bold;color:${C.txt};">${esc(r.brand)}${link}</td>
        <td align="right" style="padding:12px 16px 4px 6px;border:0;border-top:1px solid ${C.line};font-family:'Courier New',monospace;font-size:13px;font-weight:bold;color:${best ? C.green : C.txt};white-space:nowrap;">${esc(priceText(r.price, o.cur))}</td></tr>
      <tr><td colspan="2" style="padding:0 16px 12px 16px;border:0;"><table role="presentation" width="${pct}%" cellpadding="0" cellspacing="0" style="width:${pct}%;border-collapse:collapse;"><tr><td height="10" bgcolor="${color}" style="height:10px;padding:0;border:0;background:${color};border-radius:5px;font-size:1px;line-height:10px;">&nbsp;</td></tr></table></td></tr>`;
    }).join('');
    const card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;border-collapse:separate;background:${C.navy};border-radius:14px;font-family:Arial,Helvetica,sans-serif;"><tr><td colspan="2" style="padding:16px 16px 12px 16px;border:0;">
        <div style="font-size:12px;color:${C.mut};">Buen<span style="color:${C.blue};">Trade</span>${o.isUpdate ? ' · Lista actualizada' : ''}</div>
        ${o.title ? `<div style="font-size:19px;font-weight:bold;color:${C.txt};margin-top:3px;">${esc(o.title)}</div>` : ''}</td></tr>${body}
      <tr><td colspan="2" style="padding:0 0 6px 0;border:0;font-size:1px;line-height:6px;">&nbsp;</td></tr></table>`;
    return (o.name ? para(`Hola ${o.name},`) : '') + (o.signalLine ? para(o.signalLine) : '') + card
      + (o.delivery ? `<p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222;">Entrega ${esc(o.delivery)}</p>` : '')
      + (o.pending ? `<div style="height:12px;line-height:12px;">&nbsp;</div>${para(o.pending)}` : '') + (o.credit ? para(o.credit) : '');
  }

  const api = { offerCardHtml, priceText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BTOfferCard = api;
})(typeof window !== 'undefined' ? window : globalThis);
