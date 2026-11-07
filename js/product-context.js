// THE SAME FOUR FIELDS, ALWAYS, when a plant's line is matched to a catalog product (owner 2026-11-06: "si no das empaque, variación, contexto no puedo hacer matches";
// approved version "1 y 2 juntas"). Cut · Variation · Temperature · Packaging — on BOTH sides:
//   • the plant's line shows what the system read from it, and a dashed "?" for what the plant did not say;
//   • every product in the list shows its own four fields in fixed columns, and whatever the plant wrote that does not agree with that product is amber.
// Display only: it never picks, filters or changes a match — the trader's Match is still what teaches. Pure functions (the page gives the catalogs), exported for the tests.
(function (root) {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9%#]/g, '');
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // A catalog word inside the plant's line, as a whole word: "Bone-In" is also "Bone in" and "bonein"; "42%" is also "42"; "5%" is never inside "15%".
  function wordRegex(name) {
    const toks = String(name == null ? '' : name).toLowerCase().split(/[^a-z0-9%#]+/).filter(Boolean);
    if (!toks.length) return null;
    // Singular or plural, as the plant wrote it: Butt = Butts, Belly = Bellies, Rib = Ribs.
    const tok = (t) => /^\d+%$/.test(t) ? escRe(t.slice(0, -1)) + '%?'
      : /^[a-z]{3,}ies$/.test(t) ? escRe(t.slice(0, -3)) + '(?:y|ies)'
      : /^[a-z]{2,}y$/.test(t) ? escRe(t.slice(0, -1)) + '(?:y|ies)'
      : /^[a-z]{3,}s$/.test(t) && !/ss$/.test(t) ? escRe(t.slice(0, -1)) + 's?'
      : /^[a-z]{3,}$/.test(t) ? escRe(t) + 's?' : escRe(t);
    const body = toks.map(tok).join('[\\s\\-\\/.]*');
    return new RegExp('(^|[^a-z0-9%#])' + body + '(?=$|[^a-z0-9%#])', 'i');
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

  // The plant's line, split in the same four fields. A field the system could not read is a dashed "?" (a variation is often truly absent: neutral dashes).
  function chipsHtml(line) {
    const chip = (cls, t, title) => `<span class="pc-chip${cls ? ' ' + cls : ''}"${title ? ` title="${esc(title)}"` : ''}>${esc(t)}</span>`;
    const out = [];
    if (line.cuts.length) line.cuts.forEach((x) => out.push(chip('', x))); else out.push(chip('pc-q pc-warn', 'cut ?', 'The system did not recognize a cut in this line'));
    if (line.variations.length) line.variations.forEach((x) => out.push(chip('', x))); else out.push(chip('pc-q', 'no variation', 'No variation read in this line'));
    out.push(line.temp ? chip('pc-temp', line.temp) : chip('pc-q pc-warn', 'temp ?', 'The line does not say fresh or frozen'));
    out.push(line.pack ? chip('', line.pack) : chip('pc-q pc-warn', 'packaging ?', 'The line does not say the packaging'));
    return `<div class="pc-row"><small>Said</small>${out.join('')}</div>`;
  }

  // The product's four fields for the picker's columns (what to print, and which cells are amber with what the line said).
  function optionCols(p, line, ctx) {
    const f = productFields(p, ctx);
    const bad = mismatch(line, f);
    return {
      cut: f.cut, variation: f.variation, temp: f.temp, pack: f.pack, bad,
      said: { cut: line.cuts.join(', '), variation: line.variations.join(', '), temp: line.temp || '', pack: line.pack || '' },
    };
  }

  const css = '.pc-row{display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin-top:8px;}' +
    '.pc-row small{font-size:10.5px;font-weight:700;color:var(--ink-soft,rgba(255,255,255,.55));text-transform:uppercase;letter-spacing:.03em;margin-right:2px;}' +
    '.pc-chip{display:inline-block;font-size:11px;font-weight:600;padding:1px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.3);color:rgba(255,255,255,.85);white-space:nowrap;}' +
    '.pc-chip.pc-temp{border-color:rgba(90,170,255,.6);color:var(--blue-bright,#5AAAFF);background:var(--blue-light,rgba(90,170,255,.14));}' +
    '.pc-chip.pc-q{border-style:dashed;}' +
    '.pc-chip.pc-warn{border-color:rgba(255,200,118,.6);color:#FFC876;background:rgba(255,200,118,.1);}';

  const api = { wordRegex, readLine, productFields, mismatch, chipsHtml, optionCols, css };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else {
    root.BTProductContext = api;
    if (root.document) { const s = root.document.createElement('style'); s.textContent = css; root.document.head.appendChild(s); }
  }
})(typeof window !== 'undefined' ? window : globalThis);
