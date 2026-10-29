// THE BELL (owner 2026-10-27, picked A2 from drawings on his real page): inside the OS, a bell in the header chip of every screen that says what arrived — a new price from a plant, Pending lines waiting for his
// match, an open plant auction — with filters and one button per line that goes to where the work is done (Quotes, Plants). It only reads (dashboard-summary view "bell") and links: it never sends, saves or decides.
// "Seen" is this browser's own memory (localStorage); the number on the bell counts what arrived since. A soft sound plays once when something new arrives while the OS is open (can be switched off in the panel).
(function(){
  var KINDS = { price: { label: 'Prices', color: '#2fbf71', ini: 'PR' }, answer: { label: 'Answers', color: '#c792ea', ini: 'AN' }, pending: { label: 'Pending', color: '#f0b429', ini: 'PM' }, auction: { label: 'Auction', color: '#6fb1ff', ini: 'AU' }, rates: { label: 'Rates', color: '#ff9f6b', ini: 'RT' } };
  function unseenCount(items, seenIso){ var t = seenIso ? new Date(seenIso).getTime() : 0; return (items || []).filter(function(i){ return new Date(i.at).getTime() > t; }).length; }
  function kindCounts(items){ var c = { all: (items || []).length, price: 0, answer: 0, pending: 0, auction: 0, rates: 0 }; (items || []).forEach(function(i){ if (c[i.kind] != null) c[i.kind]++; }); return c; }
  function ago(iso, now){ var m = Math.max(0, Math.round(((now || Date.now()) - new Date(iso).getTime()) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' d'; }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  window.btBellLogic = { unseenCount: unseenCount, kindCounts: kindCounts, ago: ago, esc: esc, KINDS: KINDS };
  if (!document || !document.getElementById) return;

  var chip = document.getElementById('userChip');
  if (!chip || /(?:^|[?&])embed=1/.test(location.search)) return;
  var items = [], filter = 'all', open = false, lastCount = null;
  function store(k, v){ try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  var css = document.createElement('style');
  css.textContent = '@keyframes btBellPulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.1);opacity:0}}'
    + '.btb{position:relative;width:34px;height:34px;border:1.5px solid #3d77d8;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(10,30,70,.6);cursor:pointer;flex:none;margin-right:4px;padding:0}'
    + '.btb svg{width:17px;height:17px}.btb-ring{position:absolute;inset:0;border-radius:50%;border:2px solid #2fbf71;animation:btBellPulse 1.8s infinite;display:none}.btb.on .btb-ring{display:block}'
    + '.btb-n{position:absolute;top:-6px;right:-6px;background:#e5484d;color:#fff;border-radius:10px;min-width:18px;height:18px;font:700 11px/18px "Space Grotesk",sans-serif;text-align:center;display:none;padding:0 4px}.btb.on .btb-n{display:block}'
    + '.btb-p{position:fixed;width:430px;max-width:calc(100vw - 20px);background:#13294f;border:1px solid #2b4a82;border-radius:14px;z-index:100000;color:#fff;font:14px/1.5 "Nunito",sans-serif;box-shadow:0 14px 34px rgba(0,0,0,.5);overflow:hidden;display:none}.btb-p.open{display:block}'
    + '.btb-h{padding:12px 14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;border-bottom:1px solid #223c6b}.btb-h b{margin-right:auto}'
    + '.btb-c{padding:4px 11px;border-radius:14px;font-size:12px;font-weight:700;border:1px solid var(--c);color:var(--c);background:transparent;cursor:pointer}.btb-c.sel{background:var(--c);color:#0b1d3f}'
    + '.btb-i{display:flex;gap:11px;padding:11px 14px;border-bottom:1px solid #223c6b;border-left:4px solid var(--c);cursor:pointer}.btb-i:hover{background:#17335f}.btb-i.new .btb-t:after{content:"NEW";margin-left:8px;color:#2fbf71;font-size:10px;font-weight:700}'
    + '.btb-a{width:34px;height:34px;border-radius:50%;background:color-mix(in srgb,var(--c) 18%,transparent);color:var(--c);display:flex;align-items:center;justify-content:center;font:700 12px sans-serif;flex:none}'
    + '.btb-b{flex:1;min-width:0}.btb-r{display:flex;justify-content:space-between;gap:8px}.btb-w{color:#9db4de;font-size:12px;flex:none}.btb-s{color:#c9d7f1;font-size:13px}'
    + '.btb-g{display:inline-block;margin-top:6px;border:1px solid var(--c);color:var(--c);border-radius:7px;padding:2px 10px;font-size:12px}'
    + '.btb-f{padding:9px 14px;color:#6fb1ff;font-size:13px;display:flex;justify-content:space-between}.btb-f span{cursor:pointer}.btb-e{padding:18px 14px;color:#9db4de;font-size:13px}';
  document.head.appendChild(css);
  var bell = document.createElement('button');
  bell.type = 'button'; bell.className = 'btb'; bell.setAttribute('aria-label', 'What arrived');
  bell.innerHTML = '<span class="btb-ring"></span><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/></svg><span class="btb-n"></span>';
  var panel = document.createElement('div'); panel.className = 'btb-p';
  chip.insertBefore(bell, chip.firstChild); document.body.appendChild(panel);

  function beep(){
    if (store('bt_bell_sound') === '0') return;
    try { var C = window.AudioContext || window.webkitAudioContext, a = new C(), o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = 880; g.gain.value = .06; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + .18); setTimeout(function(){ try { a.close(); } catch (e) {} }, 400); } catch (e) {}
  }
  function render(){
    var seen = store('bt_bell_seen'), n = unseenCount(items, seen), cnt = kindCounts(items), t = seen ? new Date(seen).getTime() : 0;
    bell.classList.toggle('on', n > 0); bell.querySelector('.btb-n').textContent = n > 99 ? '99+' : String(n);
    var chips = [['all', 'All ' + cnt.all, '#9db4de']].concat(Object.keys(KINDS).map(function(k){ return [k, KINDS[k].label + ' ' + cnt[k], KINDS[k].color]; }));
    var list = items.filter(function(i){ return filter === 'all' || i.kind === filter; });
    panel.innerHTML = '<div class="btb-h"><b>What arrived</b>' + chips.map(function(c){ return '<button type="button" class="btb-c' + (filter === c[0] ? ' sel' : '') + '" data-f="' + c[0] + '" style="--c:' + c[2] + '">' + esc(c[1]) + '</button>'; }).join('') + '</div>'
      + (list.length ? list.map(function(i, k){ var K = KINDS[i.kind] || KINDS.price; return '<div class="btb-i' + (new Date(i.at).getTime() > t ? ' new' : '') + '" data-h="' + esc(i.href) + '" style="--c:' + K.color + '"><div class="btb-a">' + esc(String(i.plant || K.ini).replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(function(w){ return w[0]; }).join('').toUpperCase() || K.ini) + '</div><div class="btb-b"><div class="btb-r"><b class="btb-t">' + esc(i.title) + '</b><span class="btb-w">' + esc(ago(i.at)) + '</span></div><div class="btb-s">' + esc(i.sub) + '</div><span class="btb-g">' + esc(i.action) + '</span></div></div>'; }).join('') : '<div class="btb-e">Nothing here right now.</div>')
      + '<div class="btb-f"><span data-seen="1">Mark all as seen</span><span data-snd="1" style="color:#9db4de">Sound: ' + (store('bt_bell_sound') === '0' ? 'off' : 'on') + '</span></div>';
    var r = bell.getBoundingClientRect(); panel.style.top = Math.round(r.bottom + 10) + 'px'; panel.style.left = Math.max(10, Math.round(Math.min(r.right, window.innerWidth - 10) - 430)) + 'px';
  }
  function load(){
    if (typeof window.callApi !== 'function') return;
    window.callApi('dashboard-summary', { view: 'bell' }).then(function(r){
      items = (r && r.bell) || [];
      var n = unseenCount(items, store('bt_bell_seen'));
      if (lastCount !== null && n > lastCount) beep();
      lastCount = n; render();
    }).catch(function(){});
  }
  bell.addEventListener('click', function(e){ e.stopPropagation(); open = !open; panel.classList.toggle('open', open); if (open) render(); });
  panel.addEventListener('click', function(e){
    e.stopPropagation();
    var c = e.target.closest('[data-f]'), it = e.target.closest('[data-h]');
    if (c) { filter = c.getAttribute('data-f'); render(); return; }
    if (e.target.closest('[data-seen]')) { store('bt_bell_seen', new Date().toISOString()); lastCount = 0; render(); return; }
    if (e.target.closest('[data-snd]')) { store('bt_bell_sound', store('bt_bell_sound') === '0' ? '1' : '0'); render(); return; }
    if (it) location.href = it.getAttribute('data-h');
  });
  document.addEventListener('click', function(){ if (open) { open = false; panel.classList.remove('open'); } });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && open) { open = false; panel.classList.remove('open'); } });
  window.addEventListener('resize', function(){ if (open) render(); });
  // starts once the screen's own login has finished (the chip shows the signed-in email), then looks again every 90 s while the OS is open
  var tries = 0, wait = setInterval(function(){
    var b = document.getElementById('userBadge');
    if ((b && (b.textContent || '').trim()) || ++tries > 40) { clearInterval(wait); if (b && (b.textContent || '').trim()) { load(); setInterval(function(){ if (!document.hidden) load(); }, 90000); } }
  }, 500);
})();
