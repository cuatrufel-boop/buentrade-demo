// THE BELL (owner 2026-10-27 picked A2; REDESIGNED 2026-10-31: "esto no está bien hecho ni de diseño ni de funcionalidad… revisa cómo operan los mejores feeds de notificaciones"): inside the OS, a bell in the header chip of every screen that says what arrived — a new price from a plant, Pending lines waiting for his
// match, an open plant auction, a carrier's rates. It works like an inbox (Linear / GitHub / Superhuman): unread dot per item, Unread | All, grouped by day, one click opens the work and marks it read, hover for ✓ read / ✕ dismiss, keyboard ↑ ↓ Enter E D Esc.
// It only reads (dashboard-summary view "bell") and links: it never sends, saves or decides in the system. Read / dismissed live in this browser's own memory (localStorage), per item; an item that gets NEW activity is unread again.
// "Seen" is this browser's own memory (localStorage); the number on the bell counts what arrived since. A soft sound plays once when something new arrives while the OS is open (can be switched off in the panel).
(function(){
  var KINDS = { price: { label: 'Prices', color: '#2fbf71', ini: 'PR' }, answer: { label: 'Answers', color: '#c792ea', ini: 'AN' }, pending: { label: 'Pending', color: '#f0b429', ini: 'PM' }, auction: { label: 'Auction', color: '#6fb1ff', ini: 'AU' }, rates: { label: 'Rates', color: '#ff9f6b', ini: 'RT' } };
  function unseenCount(items, seenIso){ var t = seenIso ? new Date(seenIso).getTime() : 0; return (items || []).filter(function(i){ return new Date(i.at).getTime() > t; }).length; }
  function kindCounts(items){ var c = { all: (items || []).length, price: 0, answer: 0, pending: 0, auction: 0, rates: 0 }; (items || []).forEach(function(i){ if (c[i.kind] != null) c[i.kind]++; }); return c; }
  function ago(iso, now){ var m = Math.max(0, Math.round(((now || Date.now()) - new Date(iso).getTime()) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' d'; }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // ---- the inbox logic (pure, tested) ----
  // an item is the same item while its kind, plant and title are the same; new activity (a later `at`) makes it unread / visible again
  function itemKey(i){ return [i.kind, i.plant, i.title].join('|'); }
  // state = { seen: ms (Mark all read), base: ms (first-run baseline: what was already old is read), read: {key: ms}, dismissed: {key: ms} }
  function isUnread(i, st){ var t = new Date(i.at).getTime(); return t > Math.max(st.seen || 0, st.base || 0, (st.read || {})[itemKey(i)] || 0); }
  function isHidden(i, st){ return ((st.dismissed || {})[itemKey(i)] || 0) >= new Date(i.at).getTime(); }
  var TZ = 'America/New_York';
  function dayKey(ms){ return new Date(ms).toLocaleDateString('en-CA', { timeZone: TZ }); }
  // Today / Yesterday / Earlier, in the business's own day (Miami), newest first
  function groupByDay(list, now){
    var today = dayKey(now || Date.now()), yest = dayKey((now || Date.now()) - 86400000), out = [], by = {};
    list.slice().sort(function(a, b){ return String(b.at).localeCompare(String(a.at)); }).forEach(function(i){
      var k = dayKey(new Date(i.at).getTime()), g = k === today ? 'Today' : k === yest ? 'Yesterday' : 'Earlier';
      if (!by[g]) { by[g] = { label: g, items: [] }; out.push(by[g]); } by[g].items.push(i);
    });
    return out;
  }
  window.btBellLogic = { unseenCount: unseenCount, kindCounts: kindCounts, ago: ago, esc: esc, KINDS: KINDS, itemKey: itemKey, isUnread: isUnread, isHidden: isHidden, groupByDay: groupByDay };
  if (!document || !document.getElementById) return;

  var chip = document.getElementById('userChip');
  if (!chip || /(?:^|[?&])embed=1/.test(location.search)) return;
  var items = [], tab = 'unread', filter = 'all', open = false, lastCount = null, sel = -1, lastLoad = 0;
  function store(k, v){ try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function json(k){ try { return JSON.parse(store(k) || '{}') || {}; } catch (e) { return {}; } }
  function state(){
    var base = store('bt_bell_base'); if (!base) { base = new Date(Date.now() - 86400000).toISOString(); store('bt_bell_base', base); }
    var seen = store('bt_bell_seen');
    return { seen: seen ? new Date(seen).getTime() : 0, base: new Date(base).getTime(), read: json('bt_bell_read'), dismissed: json('bt_bell_dismissed') };
  }
  function mark(k, key, ms){ var m = json(k); m[key] = ms; var keys = Object.keys(m); if (keys.length > 400) { keys.sort(function(a, b){ return m[a] - m[b]; }).slice(0, keys.length - 400).forEach(function(x){ delete m[x]; }); } store(k, JSON.stringify(m)); }
  var ICON = {
    price: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    answer: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    pending: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
    auction: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    rates: '<path d="M1 4h13v12H1z"/><path d="M14 8h4l4 4v4h-8z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="17.5" cy="18.5" r="2"/>'
  };
  var svg = function(d, s){ return '<svg viewBox="0 0 24 24" width="' + (s || 16) + '" height="' + (s || 16) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var css = document.createElement('style');
  css.textContent = '@keyframes btBellPulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.1);opacity:0}}@keyframes btbIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}'
    + '.btb{position:relative;width:34px;height:34px;border:1.5px solid #3d77d8;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(10,30,70,.6);cursor:pointer;flex:none;margin-right:4px;padding:0}'
    + '.btb svg{width:17px;height:17px}.btb-ring{position:absolute;inset:0;border-radius:50%;border:2px solid #2fbf71;animation:btBellPulse 1.8s infinite;display:none}.btb.on .btb-ring{display:block}'
    + '.btb-n{position:absolute;top:-6px;right:-6px;background:#e5484d;color:#fff;border-radius:10px;min-width:18px;height:18px;font:700 11px/18px "Space Grotesk",sans-serif;text-align:center;display:none;padding:0 4px}.btb.on .btb-n{display:block}'
    + '.btb-p{position:fixed;width:420px;max-width:calc(100vw - 20px);background:linear-gradient(180deg,#112a56,#0d2148);border:1px solid rgba(111,177,255,.22);border-radius:16px;z-index:100000;color:#fff;font:14px/1.45 "Nunito",system-ui,sans-serif;box-shadow:0 18px 44px rgba(0,0,0,.55);overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;display:none}.btb-p.open{display:block;animation:btbIn .14s ease-out}'
    + '.btb-hd{position:sticky;top:0;z-index:2;background:#112a56;padding:12px 14px 10px;border-bottom:1px solid rgba(111,177,255,.14)}.btb-row1{display:flex;align-items:center;gap:8px}.btb-row1 b{font:700 15px "Space Grotesk",sans-serif;margin-right:auto}'
    + '.btb-seg{display:inline-flex;background:rgba(255,255,255,.07);border-radius:9px;padding:2px}.btb-seg button{border:0;background:transparent;color:#9db4de;font:600 12px "Nunito",sans-serif;padding:4px 11px;border-radius:7px;cursor:pointer}.btb-seg button.sel{background:#2a5db8;color:#fff}.btb-seg i{font-style:normal;opacity:.8;margin-left:5px}'
    + '.btb-ib{width:28px;height:28px;border:0;border-radius:8px;background:transparent;color:#9db4de;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0}.btb-ib:hover{background:rgba(255,255,255,.09);color:#fff}'
    + '.btb-chips{display:flex;gap:6px;margin-top:10px;overflow-x:auto;scrollbar-width:none}.btb-chips::-webkit-scrollbar{display:none}'
    + '.btb-c{flex:none;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;border:1px solid rgba(255,255,255,.14);color:#b9c8e6;background:transparent;cursor:pointer}.btb-c.sel{border-color:var(--c);color:var(--c);background:color-mix(in srgb,var(--c) 14%,transparent)}'
    + '.btb-gl{padding:12px 16px 4px;font:700 11px "Nunito",sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#7f95bd}'
    + '.btb-i{position:relative;display:flex;gap:11px;align-items:center;padding:9px 14px 9px 22px;cursor:pointer;border-radius:10px;margin:1px 6px}.btb-i:hover,.btb-i.sel{background:rgba(255,255,255,.07)}.btb-i:focus-visible{outline:2px solid #6fb1ff;outline-offset:-2px}'
    + '.btb-dot{position:absolute;left:8px;top:50%;width:8px;height:8px;margin-top:-4px;border-radius:50%;background:#4d9bff;display:none}.btb-i.unread .btb-dot{display:block}'
    + '.btb-ico{width:32px;height:32px;border-radius:9px;background:color-mix(in srgb,var(--c) 18%,transparent);color:var(--c);display:flex;align-items:center;justify-content:center;flex:none}'
    + '.btb-b{flex:1;min-width:0}.btb-t{font-weight:600;color:#cfdaf0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.btb-i.unread .btb-t{font-weight:700;color:#fff}.btb-s{color:#8ea4cc;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.btb-side{flex:none;min-width:52px;text-align:right;color:#7f95bd;font-size:12px}.btb-act{display:none;gap:2px;justify-content:flex-end}.btb-i:hover .btb-w,.btb-i.sel .btb-w{display:none}.btb-i:hover .btb-act,.btb-i.sel .btb-act{display:inline-flex}'
    + '.btb-e{padding:36px 20px 40px;text-align:center;color:#8ea4cc}.btb-e svg{display:block;margin:0 auto 10px;color:#2fbf71}.btb-e b{display:block;color:#fff;font-size:14px;margin-bottom:2px}'
    + '@media (hover:none){.btb-side{display:flex;flex-direction:column;align-items:flex-end;gap:2px}.btb-i:hover .btb-w,.btb-i.sel .btb-w{display:block}.btb-act{display:inline-flex}.btb-ib{width:34px;height:34px}.btb-i{padding-block:8px}}' // a phone has no hover: the time and the ✓ / ✕ are always there, finger-sized
    + '@media (max-width:480px){.btb-p{width:calc(100vw - 20px)}.btb-chips{margin-top:8px}}'
    + '@media (prefers-reduced-motion:reduce){.btb-p.open,.btb-ring{animation:none}}';
  document.head.appendChild(css);
  var bell = document.createElement('button');
  bell.type = 'button'; bell.className = 'btb'; bell.setAttribute('aria-label', 'Notifications'); bell.setAttribute('aria-haspopup', 'dialog');
  bell.innerHTML = '<span class="btb-ring"></span><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/></svg><span class="btb-n"></span>';
  var panel = document.createElement('div'); panel.className = 'btb-p'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Notifications');
  chip.insertBefore(bell, chip.firstChild); document.body.appendChild(panel);

  function beep(){
    if (store('bt_bell_sound') === '0') return;
    try { var C = window.AudioContext || window.webkitAudioContext, a = new C(), o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = 880; g.gain.value = .06; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + .18); setTimeout(function(){ try { a.close(); } catch (e) {} }, 400); } catch (e) {}
  }
  function visible(st){ return items.filter(function(i){ return !isHidden(i, st); }); }
  function unreadN(st){ return visible(st).filter(function(i){ return isUnread(i, st); }).length; }
  var shown = []; // what the list shows now, in order (for the keyboard)
  function render(){
    var st = state(), vis = visible(st), n = vis.filter(function(i){ return isUnread(i, st); }).length;
    bell.classList.toggle('on', n > 0); bell.querySelector('.btb-n').textContent = n > 99 ? '99+' : String(n);
    var pool = tab === 'unread' ? vis.filter(function(i){ return isUnread(i, st); }) : vis;
    var cnt = kindCounts(pool);
    if (filter !== 'all' && !cnt[filter]) filter = 'all';
    var list = pool.filter(function(i){ return filter === 'all' || i.kind === filter; });
    shown = [];
    var chips = ['all'].concat(Object.keys(KINDS).filter(function(k){ return cnt[k]; })).map(function(k){ var c = k === 'all' ? '#9db4de' : KINDS[k].color; return '<button type="button" class="btb-c' + (filter === k ? ' sel' : '') + '" data-f="' + k + '" style="--c:' + c + '">' + esc(k === 'all' ? 'All' : KINDS[k].label) + ' ' + cnt[k === 'all' ? 'all' : k] + '</button>'; }).join('');
    var snd = store('bt_bell_sound') !== '0';
    var head = '<div class="btb-hd"><div class="btb-row1"><b>Notifications</b>'
      + '<div class="btb-seg" role="tablist"><button type="button" data-tab="unread" class="' + (tab === 'unread' ? 'sel' : '') + '">Unread<i>' + n + '</i></button><button type="button" data-tab="all" class="' + (tab === 'all' ? 'sel' : '') + '">All</button></div>'
      + '<button type="button" class="btb-ib" data-readall="1" title="Mark all as read" aria-label="Mark all as read">' + svg('<path d="M2 12l5 5L18 6"/><path d="M12 17l1.5 1.5L22 10"/>') + '</button>'
      + '<button type="button" class="btb-ib" data-snd="1" title="Sound: ' + (snd ? 'on' : 'off') + '" aria-label="Sound ' + (snd ? 'on' : 'off') + '">' + svg(snd ? '<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14"/>' : '<path d="M11 5L6 9H2v6h4l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/>') + '</button></div>'
      + '<div class="btb-chips">' + chips + '</div></div>';
    var body = '';
    if (!list.length) body = '<div class="btb-e">' + svg('<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>', 28) + '<b>' + (tab === 'unread' ? 'You’re all caught up' : 'Nothing here yet') + '</b>' + (tab === 'unread' ? 'New prices, answers and matches will show up here.' : 'What arrives will be listed here.') + '</div>';
    else groupByDay(list).forEach(function(g){
      body += '<div class="btb-gl">' + g.label + '</div>';
      g.items.forEach(function(i){
        var K = KINDS[i.kind] || KINDS.price, un = isUnread(i, st), idx = shown.push(i) - 1;
        body += '<div class="btb-i' + (un ? ' unread' : '') + (idx === sel ? ' sel' : '') + '" role="button" tabindex="0" data-idx="' + idx + '" data-h="' + esc(i.href) + '" title="' + esc(i.action) + '" style="--c:' + K.color + '"><span class="btb-dot"></span><span class="btb-ico">' + svg(ICON[i.kind] || ICON.price) + '</span>'
          + '<div class="btb-b"><div class="btb-t">' + esc(i.title) + '</div><div class="btb-s">' + esc(i.sub) + '</div></div>'
          + '<div class="btb-side"><span class="btb-w">' + esc(ago(i.at)) + '</span><span class="btb-act">' + (un ? '<button type="button" class="btb-ib" data-read="' + idx + '" title="Mark as read" aria-label="Mark as read">' + svg('<path d="M20 6L9 17l-5-5"/>') + '</button>' : '') + '<button type="button" class="btb-ib" data-dismiss="' + idx + '" title="Dismiss" aria-label="Dismiss">' + svg('<path d="M18 6L6 18M6 6l12 12"/>') + '</button></span></div></div>';
      });
    });
    panel.innerHTML = head + body;
    var r = bell.getBoundingClientRect(); panel.style.top = Math.round(r.bottom + 10) + 'px'; panel.style.maxHeight = Math.max(160, Math.round(window.innerHeight - r.bottom - 22)) + 'px'; // the list scrolls inside the panel, never the page behind it (owner 2026-10-28)
    var w = Math.min(420, window.innerWidth - 20); panel.style.width = w + 'px'; panel.style.right = 'auto'; panel.style.left = Math.max(10, Math.min(Math.round(r.right - w), window.innerWidth - w - 10)) + 'px'; // under the bell, its right edge on the bell's, always inside the window (a phone included)
  }
  function load(force){
    if (typeof window.callApi !== 'function') return;
    if (!force && Date.now() - lastLoad < 15000) return; lastLoad = Date.now();
    window.callApi('dashboard-summary', { view: 'bell' }).then(function(r){
      items = (r && r.bell) || [];
      var n = unreadN(state());
      if (lastCount !== null && n > lastCount) beep();
      lastCount = n; render();
    }).catch(function(){});
  }
  function close(){ open = false; sel = -1; panel.classList.remove('open'); }
  function readIdx(i){ var it = shown[i]; if (it) mark('bt_bell_read', itemKey(it), Math.max(Date.now(), new Date(it.at).getTime())); }
  function go(i){ var it = shown[i]; if (!it) return; readIdx(i); lastCount = unreadN(state()); location.href = it.href; }
  bell.addEventListener('click', function(e){ e.stopPropagation(); open = !open; panel.classList.toggle('open', open); if (open) { sel = -1; render(); load(true); } });
  panel.addEventListener('click', function(e){
    e.stopPropagation();
    var el;
    if ((el = e.target.closest('[data-tab]'))) { tab = el.getAttribute('data-tab'); sel = -1; render(); return; }
    if ((el = e.target.closest('[data-f]'))) { filter = el.getAttribute('data-f'); sel = -1; render(); return; }
    if (e.target.closest('[data-readall]')) { store('bt_bell_seen', new Date().toISOString()); lastCount = 0; render(); return; }
    if (e.target.closest('[data-snd]')) { store('bt_bell_sound', store('bt_bell_sound') === '0' ? '1' : '0'); render(); return; }
    if ((el = e.target.closest('[data-read]'))) { readIdx(+el.getAttribute('data-read')); lastCount = unreadN(state()); render(); return; }
    if ((el = e.target.closest('[data-dismiss]'))) { var it = shown[+el.getAttribute('data-dismiss')]; if (it) { mark('bt_bell_dismissed', itemKey(it), new Date(it.at).getTime()); lastCount = unreadN(state()); render(); } return; }
    if ((el = e.target.closest('[data-idx]'))) go(+el.getAttribute('data-idx'));
  });
  document.addEventListener('click', function(){ if (open) close(); });
  document.addEventListener('keydown', function(e){
    if (!open) return;
    if (e.key === 'Escape') { close(); bell.focus(); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) return;
    if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); sel = Math.min(shown.length - 1, sel + 1); render(); var a = panel.querySelector('.btb-i.sel'); if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); sel = Math.max(0, sel - 1); render(); var b = panel.querySelector('.btb-i.sel'); if (b && b.scrollIntoView) b.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); go(sel); }
    else if ((e.key === 'e' || e.key === 'E') && sel >= 0) { readIdx(sel); lastCount = unreadN(state()); render(); }
    else if ((e.key === 'd' || e.key === 'D') && sel >= 0) { var it = shown[sel]; if (it) { mark('bt_bell_dismissed', itemKey(it), new Date(it.at).getTime()); lastCount = unreadN(state()); sel = Math.min(sel, shown.length - 2); render(); } }
  });
  window.addEventListener('resize', function(){ if (open) render(); });
  // starts once the screen's own login has finished (the chip shows the signed-in email), then looks again every 90 s while the OS is open
  var tries = 0, wait = setInterval(function(){
    var b = document.getElementById('userBadge');
    if ((b && (b.textContent || '').trim()) || ++tries > 40) { clearInterval(wait); if (b && (b.textContent || '').trim()) { load(true); setInterval(function(){ if (!document.hidden) load(true); }, 90000); } }
  }, 500);
})();
