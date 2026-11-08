// CLEAN PRODUCT WITH PRODUCT, THE CONTEXT ON HOVER (owner 2026-11-07: "quiero algo limpio producto con producto, pero que el contexto para decidir qué producto escoger se vea si me paro encima";
// design approved with "hazlo así"). A Pending / Load Prices row shows ONLY the plant's product and the BuenTrade product. Standing over either one opens a card:
//   • over the plant's product: what the plant wrote, how the system read it (cut · variation · temperature · packaging, "?" for what it did not say), the email's reasons, pickup and date;
//   • over a product in the list (or the one already picked): "this product" next to "the plant wrote" in the same four fields — what disagrees is amber — plus the email's lines.
// Display only: it never picks, filters or changes a match. Pure functions (the page gives the catalogs), exported for the tests.
(function (root) {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9%#]/g, '');
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // A catalog word inside the plant's line, as a whole word: "Bone-In" is also "Bone in" and "bonein"; "42%" is also "42"; "5%" is never inside "15%"; Butt = Butts, Belly = Bellies.
  function wordRegex(name) {
    const toks = String(name == null ? '' : name).toLowerCase().split(/[^a-z0-9%#]+/).filter(Boolean);
    if (!toks.length) return null;
    const tok = (t) => /^\d+%$/.test(t) ? escRe(t.slice(0, -1)) + '%?'
      : /^[a-z]{3,}ies$/.test(t) ? escRe(t.slice(0, -3)) + '(?:y|ies)'
      : /^[a-z]{2,}y$/.test(t) ? escRe(t.slice(0, -1)) + '(?:y|ies)'
      : /^[a-z]{3,}s$/.test(t) && !/ss$/.test(t) ? escRe(t.slice(0, -1)) + 's?'
      : /^[a-z]{3,}$/.test(t) ? escRe(t) + 's?' : escRe(t);
    return new RegExp('(^|[^a-z0-9%#])' + toks.map(tok).join('[\\s\\-\\/.]*') + '(?=$|[^a-z0-9%#])', 'i');
  }

  // What the system reads from a line. ctx: { temperatures, packagings, cutNames, variations, aliasMap (term -> { cut_name, variation }), detected: { tempId, packagingId } }.
  function readLine(text, ctx) {
    const t = String(text == null ? '' : text);
    const c = ctx || {};
    const found = (list) => {
      const seen = new Map();
      (list || []).forEach((x) => [x.name_en, x.name_es || x.name].filter(Boolean).forEach((n) => {
        const re = wordRegex(n);
        if (re && re.test(t) && !seen.has(norm(x.name_en || n))) seen.set(norm(x.name_en || n), x.name_en || n);
      }));
      return [...seen.values()];
    };
    const cuts = found(c.cutNames), variations = found(c.variations);
    // The words this plant (or every plant) already taught: BNLS = Boneless, BI = Bone-In, pics = Picnic…
    for (const [term, meaning] of (c.aliasMap || [])) {
      const re = wordRegex(term);
      if (!re || !re.test(t) || !meaning) continue;
      const cn = meaning.cut_name && (c.cutNames || []).find((x) => x.id === meaning.cut_name);
      const vn = meaning.variation && (c.variations || []).find((x) => x.id === meaning.variation);
      if (cn && cn.name_en && !cuts.some((x) => norm(x) === norm(cn.name_en))) cuts.push(cn.name_en);
      if (vn && vn.name_en && !variations.some((x) => norm(x) === norm(vn.name_en))) variations.push(vn.name_en);
    }
    const d = c.detected || {};
    const tn = d.tempId && (c.temperatures || []).find((x) => x.id === d.tempId);
    const pn = d.packagingId && (c.packagings || []).find((x) => x.id === d.packagingId);
    return { cuts, variations, temp: tn ? (tn.name_en || tn.name) : null, pack: pn ? (pn.name_en || pn.name) : null };
  }

  // A catalog product's own four fields.
  function productFields(p, ctx) {
    const c = ctx || {};
    const tn = p.temperature_id && (c.temperatures || []).find((x) => x.id === p.temperature_id);
    const pn = p.packaging_id && (c.packagings || []).find((x) => x.id === p.packaging_id);
    return { cut: p.name_en || p.name || '', variation: p.subcategory_en || '', temp: tn ? (tn.name_en || tn.name) : '', pack: pn ? (pn.name_en || pn.name) : '' };
  }

  // Which of a product's fields disagree with what the line says (true = amber). Only a field the line DID say can disagree.
  function mismatch(line, prod) {
    const parts = String(prod.variation || '').split(/\s*(?:,|&|\band\b)\s*/i).map(norm).filter(Boolean);
    return {
      cut: !!(line.cuts.length && !line.cuts.some((x) => norm(x) === norm(prod.cut))),
      variation: !!(line.variations.length && !line.variations.some((v) => parts.includes(norm(v)))),
      temp: !!(line.temp && prod.temp && norm(line.temp) !== norm(prod.temp)),
      pack: !!(line.pack && prod.pack && norm(line.pack) !== norm(prod.pack)),
    };
  }

  const dash = '<span class="pc-m">—</span>';
  const said = (v) => (v ? esc(v) : '<span class="pc-m">not said</span>');
  const emailBlock = (lines) => {
    const L = (lines || []).map((x) => String(x == null ? '' : x).trim()).filter(Boolean);
    return L.length ? '<span class="pc-k">Email</span>' + L.map(esc).join('<br>') : '';
  };

  // The lines around this one in the SAME e-mail (already saved), each with its price and what happened to it (applied / pending / skipped); this line is highlighted.
  const nearBlock = (near) => (near && near.length)
    ? '<span class="pc-k">Same email · its other lines</span>' + near.map((n) => `<div class="pc-nr${n.me ? ' pc-me' : ''}"><span>${esc(n.raw_text)}</span><span>${n.price != null ? '$' + Number(n.price).toFixed(2) + ' · ' : ''}${esc(n.outcome || '')}</span></div>`).join('')
    : '';

  // The title a line sits under in the plant's e-mail: null = not saved (an older line), '' = no title above it. sections = every title of that e-mail.
  const titleText = (t) => (t === null || t === undefined ? '<span class="pc-m">not saved (older line)</span>' : t === '' ? '<span class="pc-m">no title above this line</span>' : esc(t));
  const titlesBlock = (tt) => {
    if (!tt || tt.section === undefined) return '';
    const all = (tt.sections || []).filter(Boolean);
    return '<span class="pc-k">Title above this line</span>' + titleText(tt.section) +
      (all.length ? '<span class="pc-k">All titles in this email</span>' + all.map((x) => `<span class="pc-chip${x === tt.section ? ' pc-temp' : ''}">${esc(x)}</span>`).join('') : '');
  };

  // THE CARD THAT DECIDES (owner 2026-11-07: "debe enfocar en el título, en las variaciones, en todo lo que me pueda decir cuál es; si es fresco debo saber si es combo o caja"): four questions — cut, temperature,
  // packaging, variation — each with the answer of THIS product and the evidence the e-mail gives: the title above the line, the line itself, the subject and (packaging) what this plant already sells.
  // ev: { title (string | null = not saved | '' = none | undefined = this screen has no titles), titleRead, subject, subjectRead, plant: {has, price, date} | null, sections, lines }.
  function decisionTip(label, p, line, ctx, ev) {
    ev = ev || {};
    const f = productFields(p, ctx);
    const vals = (v) => (Array.isArray(v) ? v : (v ? [v] : [])).filter(Boolean);
    const verdict = (pv, said, isVar) => {
      const sv = vals(said);
      if (!sv.length) return 'none';
      const mine = isVar ? String(pv || '').split(/\s*(?:,|&|\band\b)\s*/i).map(norm).filter(Boolean) : [norm(pv)];
      return sv.some((x) => mine.includes(norm(x))) ? 'ok' : 'bad';
    };
    const said = (v, kind) => (vals(v).length ? esc(vals(v).join(', ')) : `<span class="pc-m">${kind || 'not said'}</span>`);
    const titleCell = (read, key) => {
      if (ev.title === undefined) return null;
      if (ev.title === null) return '<span class="pc-m">not saved (older line)</span>';
      if (ev.title === '') return '<span class="pc-m">no title above</span>';
      const v = vals(read && read[key]);
      return v.length ? `<span class="pc-chip pc-temp">${esc(v.join(', '))}</span>` : '<span class="pc-m">—</span>';
    };
    const block = (name, pv, status, rows) => {
      const word = status === 'ok' ? 'matches' : status === 'bad' ? 'does not match' : 'no evidence';
      return `<div class="pc-qb"><div class="pc-qh"><span class="pc-qn">${name}</span><span class="pc-ans ${status === 'ok' ? 'pc-ok' : 'pc-warn'}">${pv ? esc(pv) : '—'} · ${word}</span></div><div class="pc-ev">` +
        rows.filter(Boolean).map((r) => `<span class="pc-es">${r[0]}</span><span>${r[1]}</span>`).join('') + '</div></div>';
    };
    const tr = ev.titleRead || null, sr = ev.subjectRead || null;
    const sub = (key) => (ev.subject == null ? null : (vals(sr && sr[key]).length ? `<span class="pc-chip pc-temp">${esc(vals(sr[key]).join(', '))}</span>` : '<span class="pc-m">—</span>'));
    const tcell = (key, label2) => { const c = titleCell(tr, key); return c == null ? null : ['Title', c]; };
    const scell = (key) => { const c = sub(key); return c == null ? null : ['Subject', c]; };
    const st = (pv, parts, isVar) => { const all = [].concat(...parts.map((x) => vals(x))); return verdict(pv, all, isVar); };
    const plantRow = ev.plant === undefined || ev.plant === null ? null
      : ['This plant sells', ev.plant.has ? `<span class="pc-ok">Already sells it</span>${ev.plant.price != null ? ' · $' + Number(ev.plant.price).toFixed(2) : ''}${ev.plant.date ? ' · ' + esc(String(ev.plant.date).slice(0, 10)) : ''}` : ev.plant.linked ? '<span class="pc-m">Linked, no price yet</span>' : '<span class="pc-warn">Has never had it</span>'];
    const html = `<div class="pc-t">${esc(label)}</div>` +
      block('Cut', f.cut, st(f.cut, [line.cuts, tr && tr.cuts], false), [['The line', said(line.cuts)], tcell('cuts')]) +
      block('Temperature', f.temp, st(f.temp, [line.temp, tr && tr.temp, sr && sr.temp], false), [tcell('temp'), ['The line', said(line.temp)], scell('temp')]) +
      block('Packaging', f.pack, st(f.pack, [line.pack, tr && tr.pack, sr && sr.pack], false), [tcell('pack'), ['The line', said(line.pack)], scell('pack'), plantRow]) +
      block('Variation', f.variation, st(f.variation, [line.variations, tr && tr.variations], true), [['The line', said(line.variations)], tcell('variations')]);
    const tt = ev.title === undefined ? '' : titlesBlock({ section: ev.title, sections: ev.sections });
    return html + tt + (ev.subject ? '<span class="pc-k">Subject</span>' + esc(ev.subject) : '') + emailBlock(ev.lines);
  }

  // The card over a product: this product next to what the plant wrote, in the same four fields; amber where they disagree. lines = the email's reasons / pickup / date.
  function productTip(label, p, line, ctx, lines) {
    const f = productFields(p, ctx), bad = mismatch(line, f);
    const cell = (v, b) => `<span class="${b ? 'pc-bad' : ''}">${v ? esc(v) : dash}</span>`;
    const rows = [['Cut', f.cut, line.cuts.join(', '), bad.cut], ['Variation', f.variation, line.variations.join(', '), bad.variation], ['Temp', f.temp, line.temp, bad.temp], ['Packaging', f.pack, line.pack, bad.pack]];
    return `<div class="pc-t">${esc(label)}</div><div class="pc-cmp"><span class="pc-h"></span><span class="pc-h">This product</span><span class="pc-h">The plant wrote</span>` +
      rows.map((r) => `<span class="pc-f">${r[0]}</span>${cell(r[1], r[3])}<span class="pc-f">${said(r[2])}</span>`).join('') + `</div>` + emailBlock(lines);
  }

  // The card over the plant's product: what it wrote, how it was read ("?" for what it did not say), and the email's own reasons.
  function plantTip(raw, line, lines, near, titles) {
    const read = [line.cuts.length ? line.cuts.join(', ') : 'cut ?', line.variations.length ? line.variations.join(', ') : 'no variation', line.temp || 'temp ?', line.pack || 'packaging ?'];
    return `<div class="pc-t">What the plant sent</div><span class="pc-k">The plant wrote</span>${esc(raw)}<span class="pc-k">Reads as</span>` +
      read.map((x) => `<span class="pc-chip${/\?$/.test(x) ? ' pc-q' : ''}">${esc(x)}</span>`).join('') + emailBlock(lines) + titlesBlock(titles) + nearBlock(near);
  }

  const css = '.pc-hv{border-bottom:1px dotted rgba(255,255,255,.45);cursor:help;}' +
    '#bt-tip{position:fixed;z-index:3000;display:none;pointer-events:none;width:min(400px,92vw);background:#0A2547;border:1.5px solid rgba(90,170,255,.55);border-radius:12px;padding:12px 14px;box-shadow:0 14px 34px rgba(4,12,26,.6);font-size:12.5px;line-height:1.5;color:#fff;text-align:left;font-weight:400;}' +
    '#bt-tip .pc-t,#bt-sheet .pc-t{font-family:"Space Grotesk",sans-serif;font-weight:600;font-size:13.5px;margin-bottom:8px;}' +
    '#bt-tip .pc-k,#bt-sheet .pc-k{display:block;margin-top:9px;margin-bottom:2px;color:rgba(255,255,255,.55);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;}' +
    '#bt-tip .pc-cmp,#bt-sheet .pc-cmp{display:grid;grid-template-columns:78px minmax(0,1fr) minmax(0,1fr);gap:4px 10px;font-size:12px;}' +
    '#bt-tip .pc-h,#bt-sheet .pc-h{font-size:10px;font-weight:700;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.03em;}' +
    '#bt-tip .pc-f,#bt-tip .pc-m,#bt-sheet .pc-f,#bt-tip .pc-m{color:rgba(255,255,255,.55);}' +
    '#bt-tip .pc-bad,#bt-sheet .pc-bad{color:#FFC876;font-weight:600;}' +
    '#bt-tip .pc-nr,#bt-sheet .pc-nr{display:flex;justify-content:space-between;gap:10px;padding:3px 7px;border-radius:6px;font-size:11.5px;color:rgba(255,255,255,.55);}' +
    '#bt-tip .pc-nr span:first-child,#bt-sheet .pc-nr span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '#bt-tip .pc-nr span:last-child,#bt-sheet .pc-nr span:last-child{flex-shrink:0;}' +
    '#bt-tip .pc-nr.pc-me,#bt-sheet .pc-nr.pc-me{background:rgba(90,170,255,.14);color:#fff;font-weight:600;}' +
    '#bt-tip .pc-chip,#bt-sheet .pc-chip{display:inline-block;font-size:11px;font-weight:600;padding:1px 9px;margin:2px 5px 2px 0;border-radius:999px;border:1px solid rgba(255,255,255,.3);color:rgba(255,255,255,.85);}' +
    '#bt-tip .pc-chip.pc-q,#bt-sheet .pc-chip.pc-q{border-style:dashed;border-color:rgba(255,200,118,.6);color:#FFC876;}' +
    '#bt-tip .pc-qb,#bt-sheet .pc-qb{border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:8px 10px;margin-bottom:7px;}' +
    '#bt-tip .pc-qh,#bt-sheet .pc-qh{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:3px;}' +
    '#bt-tip .pc-qn,#bt-sheet .pc-qn{font-size:10px;font-weight:700;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.04em;}' +
    '#bt-tip .pc-ans,#bt-sheet .pc-ans{font-family:"Space Grotesk",sans-serif;font-weight:600;font-size:13px;text-align:right;}' +
    '#bt-tip .pc-ok,#bt-sheet .pc-ok{color:#3FCB7E;}' +
    '#bt-tip .pc-warn,#bt-sheet .pc-warn{color:#FFC876;}' +
    '#bt-tip .pc-ev,#bt-sheet .pc-ev{display:grid;grid-template-columns:96px minmax(0,1fr);gap:2px 8px;font-size:11.5px;}' +
    '#bt-tip .pc-es,#bt-sheet .pc-es{color:rgba(255,255,255,.55);}' +
    // On a phone there is no mouse: the card opens from the bottom, with its own buttons.
    '#bt-sheet{position:fixed;inset:0;z-index:3100;}' +
    '#bt-sheet .pc-back{position:absolute;inset:0;background:rgba(0,0,0,.5);}' +
    '#bt-sheet .pc-sheet{position:absolute;left:8px;right:8px;bottom:8px;max-height:78vh;overflow-y:auto;background:#0A2547;border:1.5px solid rgba(90,170,255,.55);border-radius:16px;padding:14px;font-size:13px;line-height:1.5;color:#fff;text-align:left;-webkit-overflow-scrolling:touch;}' +
    '#bt-sheet .pc-acts{display:flex;gap:8px;margin-top:14px;}' +
    '#bt-sheet .pc-acts .btn{flex:1;}';

  // PHONE (no cursor — owner 2026-11-07, "en el cel uno no tiene cursor"; option C): tapping a product opens its card from the bottom with "Pick this product" and "Close" — first the context, then the choice.
  // Tapping the plant's product opens its card with "Close". Where there is a mouse nothing changes. Display only: the pick is the same call the click made.
  let sheetDoc = null, sheetWin = null, sheetEl = null, sheetAt = 0;
  const touchMode = () => !!(sheetWin && sheetWin.matchMedia && sheetWin.matchMedia('(hover: none)').matches);
  function closeSheet() { if (sheetEl) { try { sheetEl.remove(); } catch (e) {} sheetEl = null; } }
  function openSheet(html, onPick) {
    if (!sheetDoc) return;
    closeSheet();
    const box = sheetDoc.createElement('div'); box.id = 'bt-sheet';
    box.innerHTML = '<div class="pc-back"></div><div class="pc-sheet pc-card"><div class="pc-body">' + html + '</div><div class="pc-acts">' +
      (onPick ? '<button type="button" class="btn" data-act="pick">Pick this product</button>' : '') + '<button type="button" class="btn secondary" data-act="close">Close</button></div></div>';
    box.addEventListener('click', (e) => {
      // the click that belongs to the tap that opened the card is not a tap on the card (it must never close it or pick at once)
      if (Date.now() - sheetAt < 350) return;
      const a = e.target && e.target.closest && e.target.closest('[data-act]');
      if (a && a.dataset.act === 'pick') { closeSheet(); if (onPick) onPick(); }
      else if (a || (e.target && e.target.classList && e.target.classList.contains('pc-back'))) closeSheet();
    });
    sheetDoc.body.appendChild(box); sheetEl = box; sheetAt = Date.now();
  }
  const touch = { active: touchMode, open: openSheet, close: closeSheet };

  // One shared card for the whole page: anything with data-tip (the HTML of the card) shows it while the mouse is over it.
  function attachTips(doc, win) {
    doc = doc || root.document; win = win || root;
    if (!doc || doc.__btTips) return;
    doc.__btTips = true; sheetDoc = doc; sheetWin = win;
    let tip = null, on = null;
    const el = () => { if (!tip) { tip = doc.createElement('div'); tip.id = 'bt-tip'; tip.className = 'pc-card'; doc.body.appendChild(tip); } return tip; };
    // While the card is open the plain browser tooltip (title) of the same element is set aside, so two tooltips never stack; it comes back when the card closes.
    const hide = () => { if (on && on.dataset.btTitle != null) { on.setAttribute('title', on.dataset.btTitle); delete on.dataset.btTitle; } on = null; if (tip) tip.style.display = 'none'; };
    const place = (t, r) => {
      const vw = win.innerWidth || 1024, vh = win.innerHeight || 768, w = t.offsetWidth || 400, h = t.offsetHeight || 200;
      let left = r.right + 10, top = r.top - 4;
      if (left + w > vw - 8) left = r.left - w - 10;
      if (left < 8) { left = Math.max(8, Math.min(r.left, vw - w - 8)); top = r.bottom + 6; if (top + h > vh - 8) top = Math.max(8, r.top - h - 6); }
      t.style.left = left + 'px'; t.style.top = Math.max(8, Math.min(top, vh - h - 8)) + 'px';
    };
    doc.addEventListener('mouseover', (e) => {
      if (touchMode()) return;
      const host = e.target && e.target.closest && e.target.closest('[data-tip]');
      if (!host || !host.dataset.tip) { if (on) hide(); return; }
      if (host === on) return;
      if (on) hide();
      on = host; if (host.hasAttribute && host.hasAttribute('title')) { host.dataset.btTitle = host.getAttribute('title'); host.removeAttribute('title'); }
      const t = el(); t.innerHTML = host.dataset.tip; t.style.display = 'block'; place(t, host.getBoundingClientRect());
    });
    // a tap on the plant's product (its cell) opens its card from the bottom; a product in the list is handled by the picker (it asks for the card before picking)
    doc.addEventListener('click', (e) => {
      if (!touchMode()) return;
      const host = e.target && e.target.closest && e.target.closest('[data-tip]');
      if (!host || !host.dataset.tip || (host.classList && (host.classList.contains('btp-opt') || host.classList.contains('btp-in')))) return;
      openSheet(host.dataset.tip, null);
    });
    doc.addEventListener('mousedown', hide, true);
    doc.addEventListener('scroll', hide, true);
  }

  const api = { wordRegex, readLine, productFields, mismatch, productTip, decisionTip, plantTip, attachTips, touch, css };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.BTProductContext = api;
    if (root.document) {
      const s = root.document.createElement('style'); s.textContent = css; root.document.head.appendChild(s);
      if (root.document.body) attachTips(); else root.document.addEventListener('DOMContentLoaded', () => attachTips());
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
