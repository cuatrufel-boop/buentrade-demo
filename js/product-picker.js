// One product picker for every Pending screen (user 2026-10-05: "dame algo fácil que reconozca palabras clave y yo simplemente hago
// match y/o creo el nuevo producto… no tengo que poner ni recognize ni una lista larguísima… debe aprender solo con el match… en ningún
// módulo de pending"). One box per line:
//   • on focus it lists the catalog products closest to the line first (the page ranks them with its own matcher and only passes the
//     products that are allowed — same species, same temperature: fresh/frozen never cross);
//   • typing filters that list by whole words (English and Spanish full names);
//   • the last option is "+ Create new product", which opens the page's own product form with every existing check;
//   • picking only selects — the page's Match button applies it, and the match itself is what teaches.
// Usage: BTPicker.html(key, selectedLabel) inside the row; BTPicker.register(key, { options, suggested, onPick, onCreate }) once per row.
(function () {
  const reg = new Map();
  let openKey = null, active = -1;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9áéíóúñü#%/]+/).filter(Boolean);

  const css = document.createElement('style');
  // BuenTrade's own look, not a new one: the box is Offers' search pill (.of-search-wrap), the list is Quotes' freight dropdown
  // (.rq-ddown-panel / .rq-ddown-option), and a picked product reads like a filled field (.rq-ddown-btn.has-value).
  css.textContent =
    '.btp{position:relative;min-width:280px;max-width:520px;text-align:left;}' +
    '.btp-ico{position:absolute;left:14px;top:18.5px;transform:translateY(-50%);width:15px;height:15px;color:rgba(255,255,255,.55);pointer-events:none;}' +
    '.btp-in{width:100%;box-sizing:border-box;height:37px;padding:0 14px 0 37px;border-radius:999px;border:1.5px solid rgba(90,170,255,.4);background:rgba(255,255,255,.05);color:#fff;font-family:inherit;font-size:13px;transition:background .18s,border-color .18s;}' +
    '.btp-in::placeholder{color:rgba(255,255,255,.5);}' +
    '.btp-in:hover{border-color:var(--blue-bright,#5AAAFF);}' +
    '.btp-in:focus{outline:none;border-color:var(--blue-bright,#5AAAFF);background:rgba(255,255,255,.08);}' +
    '.btp-in.has{border-color:var(--blue,#1E6ADB);background:var(--blue-light,rgba(90,170,255,.14));font-weight:600;}' +
    '.btp-list{position:absolute;z-index:80;top:calc(100% + 6px);left:0;right:0;background:var(--navy-2,#0E3D8F);border:1px solid var(--line,rgba(255,255,255,.18));border-radius:12px;box-shadow:0 14px 34px rgba(4,12,26,.45);max-height:300px;overflow-y:auto;padding:6px;}' +
    '.btp-opt{padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12.5px;color:var(--ink,#fff);}' +
    '.btp-opt:hover,.btp-opt.act{background:var(--blue-light,rgba(90,170,255,.14));}' +
    '.btp-opt.cur{background:var(--blue-light,rgba(90,170,255,.14));color:var(--blue-bright,#5AAAFF);font-weight:600;}' +
    '.btp-sep{height:1px;background:var(--line,rgba(255,255,255,.18));margin:5px 2px;}' +
    '.btp-new{color:var(--blue-bright,#5AAAFF);font-weight:700;}' +
    '.btp-empty{padding:8px 10px;font-size:11.5px;color:var(--ink-soft,rgba(255,255,255,.55));}';
  document.head.appendChild(css);

  function items(key, q) {
    const cfg = reg.get(key);
    const opts = cfg.options();
    const qw = words(q);
    let list;
    if (!qw.length) {
      const byId = new Map(opts.map((o) => [o.id, o]));
      list = cfg.suggested().map((id) => byId.get(id)).filter(Boolean).slice(0, 8);
    } else {
      const rank = new Map(cfg.suggested().map((id, i) => [id, i]));
      list = opts.filter((o) => { const ow = words(o.search || o.label); return qw.every((w) => ow.some((x) => x.startsWith(w))); })
        .sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 1e6) - (rank.has(b.id) ? rank.get(b.id) : 1e6) || a.label.localeCompare(b.label))
        .slice(0, 60);
    }
    return list;
  }
  function render(key, q) {
    const box = document.querySelector(`.btp[data-btp="${CSS.escape(key)}"]`);
    if (!box) return;
    const list = items(key, q);
    const cfg = reg.get(key);
    const cur = (box.querySelector('.btp-in').dataset.label || '');
    const html = list.map((o, i) => `<div class="btp-opt${i === active ? ' act' : ''}${o.label === cur ? ' cur' : ''}" data-id="${esc(o.id)}">${o.label === cur ? '✓ ' : ''}${esc(o.label)}</div>`).join('') +
      (list.length ? '' : `<div class="btp-empty">${q ? 'No product matches' : 'No close product — type to search'}</div>`) +
      (cfg.onCreate ? `<div class="btp-sep"></div><div class="btp-opt btp-new${active === list.length ? ' act' : ''}" data-new="1">+ Create new product</div>` : '');
    const el = box.querySelector('.btp-list');
    el.innerHTML = html; el.hidden = false;
    box._list = list;
  }
  function close(key, restore) {
    const box = document.querySelector(`.btp[data-btp="${CSS.escape(key)}"]`);
    if (box) { box.querySelector('.btp-list').hidden = true; if (restore) { const inp = box.querySelector('.btp-in'); inp.value = inp.dataset.label || ''; } }
    if (openKey === key) openKey = null;
    active = -1;
  }
  function choose(key, el) {
    const cfg = reg.get(key);
    close(key, false);
    if (el.dataset.new) { cfg.onCreate && cfg.onCreate(); return; }
    cfg.onPick(el.dataset.id);
  }

  document.addEventListener('focusin', (e) => {
    const inp = e.target.closest && e.target.closest('.btp-in'); if (!inp) return;
    const key = inp.closest('.btp').dataset.btp; if (!reg.has(key)) return;
    if (openKey && openKey !== key) close(openKey, true);
    openKey = key; active = -1; inp.select(); render(key, '');
  });
  document.addEventListener('input', (e) => {
    const inp = e.target.closest && e.target.closest('.btp-in'); if (!inp) return;
    const key = inp.closest('.btp').dataset.btp; if (!reg.has(key)) return;
    openKey = key; active = -1; render(key, inp.value);
  });
  document.addEventListener('keydown', (e) => {
    const inp = e.target.closest && e.target.closest('.btp-in'); if (!inp) return;
    const box = inp.closest('.btp'); const key = box.dataset.btp; if (!reg.has(key)) return;
    const n = (box._list || []).length + (reg.get(key).onCreate ? 1 : 0);
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(n - 1, active + 1); render(key, inp.value); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); render(key, inp.value); }
    else if (e.key === 'Enter') { e.preventDefault(); const el = box.querySelectorAll('.btp-opt')[active < 0 ? 0 : active]; if (el) choose(key, el); }
    else if (e.key === 'Escape') { close(key, true); inp.blur(); }
  });
  document.addEventListener('mousedown', (e) => {
    const opt = e.target.closest && e.target.closest('.btp-opt');
    if (opt) { e.preventDefault(); choose(opt.closest('.btp').dataset.btp, opt); return; }
    if (openKey && !(e.target.closest && e.target.closest('.btp'))) close(openKey, true);
  });

  window.BTPicker = {
    html: (key, label) => `<div class="btp" data-btp="${esc(key)}"><svg class="btp-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg><input class="btp-in${label ? ' has' : ''}" value="${esc(label || '')}" data-label="${esc(label || '')}" placeholder="Pick or type a product…" autocomplete="off"><div class="btp-list" hidden></div></div>`,
    register: (key, cfg) => reg.set(key, cfg),
  };
})();
