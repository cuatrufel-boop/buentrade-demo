// The Monday summary card (owner 2026-10-17: "una tarjeta bonita con logo BuenTrade", approved example): BuenTrade logo + client name + "Resumen de la semana pasada · fecha",
// then Producto | Precio | Entrega en. Email carries it as HTML (table + inline styles, so every mail app draws it); WhatsApp has no HTML, so the same card is drawn as a PNG
// that downloads for the trader to drag into the chat. Both are built from the SAME data the server returns (messaging → weekly_summary); nothing here invents a number.
// It says "Precio", never "cierre": an offer is not a sale.
(function (root) {
  const LOGO = 'https://buentradegroup.com/icons/icon-192.png';
  const C = { bg: '#0b1f45', line: '#20386a', blue: '#5AAAFF', green: '#3FCB7E', txt: '#ffffff', mut: '#9db4d6' };
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const money = (p) => '$' + Number(p).toFixed(2);

  function weeklyCardHtml(c, label) {
    const th = (t, al) => `<td align="${al}" style="padding:8px 6px;font-size:12px;font-weight:700;color:${C.blue};border-bottom:1px solid ${C.line};">${t}</td>`;
    const rows = (c.products || []).map((p) => `<tr>
      <td align="left" style="padding:11px 6px;font-size:14px;color:${C.txt};border-bottom:1px solid ${C.line};">${esc(p.spec)}</td>
      <td align="center" style="padding:11px 6px;font-size:16px;font-weight:700;color:${C.green};border-bottom:1px solid ${C.line};white-space:nowrap;font-family:'Courier New',monospace;">${money(p.price)}</td>
      <td align="center" style="padding:11px 6px;font-size:14px;color:${C.txt};border-bottom:1px solid ${C.line};">${esc(c.city || '')}</td></tr>`).join('');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.bg};border-radius:14px;border:1px solid ${C.line};font-family:Arial,Helvetica,sans-serif;"><tr><td style="padding:20px 20px 12px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:12px;"><img src="${LOGO}" width="44" height="44" alt="BuenTrade" style="display:block;border-radius:10px;"></td>
        <td><div style="font-size:19px;font-weight:700;color:${C.txt};">${esc(String(c.trade_name || '').trim())}</div>
            <div style="font-size:13px;color:${C.mut};margin-top:2px;">Resumen de la semana pasada · ${esc(label)}</div></td></tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-collapse:collapse;">
        <tr>${th('Producto', 'left')}${th('Precio', 'center')}${th('Entrega en', 'center')}</tr>${rows}</table>
    </td></tr></table>`;
  }

  // The same card as an image (WhatsApp): 1080 px wide, product names wrapped to two lines at most.
  async function weeklyCardPng(c, label) {
    const W = 1080, PAD = 56, X_PRICE = 700, X_CITY = 800, ROW = 92, HEAD = 232;
    const rowsN = (c.products || []).length;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = HEAD + rowsN * ROW + 48;
    const g = cv.getContext('2d');
    try { await document.fonts.load('600 30px Inter'); await document.fonts.load('700 30px "Space Grotesk"'); } catch (e) { /* the system font is used */ }
    const grad = g.createLinearGradient(0, 0, W, cv.height); grad.addColorStop(0, '#07142b'); grad.addColorStop(1, '#0b2250');
    g.fillStyle = grad; g.fillRect(0, 0, W, cv.height);
    g.strokeStyle = 'rgba(90,170,255,.35)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, W - 3, cv.height - 3);
    const logo = await new Promise((res) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = LOGO; });
    if (logo) { g.save(); g.beginPath(); g.roundRect(PAD, 44, 96, 96, 22); g.clip(); g.drawImage(logo, PAD, 44, 96, 96); g.restore(); }
    else { g.fillStyle = '#0f2d66'; g.beginPath(); g.roundRect(PAD, 44, 96, 96, 22); g.fill(); g.fillStyle = '#fff'; g.font = '700 44px "Space Grotesk", sans-serif'; g.fillText('BT', PAD + 18, 106); }
    g.textBaseline = 'alphabetic'; g.fillStyle = C.txt; g.font = '700 46px "Space Grotesk", Inter, sans-serif'; g.fillText(String(c.trade_name || '').trim(), PAD + 120, 92);
    g.fillStyle = C.mut; g.font = '500 28px Inter, sans-serif'; g.fillText(`Resumen de la semana pasada · ${label}`, PAD + 120, 134);
    g.fillStyle = C.blue; g.font = '700 24px Inter, sans-serif';
    g.textAlign = 'left'; g.fillText('Producto', PAD, 204); g.textAlign = 'center'; g.fillText('Precio', X_PRICE, 204); g.fillText('Entrega en', X_CITY + 110, 204); g.textAlign = 'left';
    g.strokeStyle = C.line; g.lineWidth = 2; g.beginPath(); g.moveTo(PAD, 220); g.lineTo(W - PAD, 220); g.stroke();
    const wrap = (txt, max) => { const words = String(txt).split(' '), out = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > max && cur) { out.push(cur); cur = w; } else cur = t; } if (cur) out.push(cur); return out.slice(0, 2); };
    (c.products || []).forEach((p, i) => {
      const top = HEAD + i * ROW;
      g.fillStyle = C.txt; g.font = '500 28px Inter, sans-serif'; g.textAlign = 'left';
      const lines = wrap(p.spec, X_PRICE - PAD - 90);
      lines.forEach((ln, k) => g.fillText(ln, PAD, top + (lines.length === 1 ? 52 : 40 + k * 34)));
      g.fillStyle = C.green; g.font = '700 34px "Courier New", monospace'; g.textAlign = 'center'; g.fillText(money(p.price), X_PRICE, top + 54);
      g.fillStyle = C.txt; g.font = '500 28px Inter, sans-serif'; g.fillText(c.city || '', X_CITY + 110, top + 52);
      g.strokeStyle = C.line; g.lineWidth = 1.5; g.beginPath(); g.moveTo(PAD, top + ROW - 1); g.lineTo(W - PAD, top + ROW - 1); g.stroke();
    });
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    const safe = String(c.trade_name || 'cliente').trim().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
    return { bytes: new Uint8Array(await blob.arrayBuffer()), filename: `Resumen-semanal-${safe}.png` };
  }

  const api = { weeklyCardHtml, weeklyCardPng, LOGO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BTWeeklyCard = api;
})(typeof window !== 'undefined' ? window : globalThis);
