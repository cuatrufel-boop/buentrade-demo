// Shared header account chip (all internal pages). The Market Flash header button was removed 2026-09-27 — the
// bulletin is now only a source inside Quotes → Messaging (Market tab).
// Each page's own login handler still just sets #userBadge's text to the signed-in email (that span
// is hidden now) — this derives the avatar initials and the chip's hover tooltip from that same
// text, so no page's auth code had to change.
(function(){
  var css = document.createElement('style');
  css.textContent =
    '.hdr-logout{width:19px;height:19px;border-radius:50%;background:rgba(255,255,255,.1);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;transition:background .18s;}' +
    '.hdr-logout:hover{background:rgba(255,255,255,.22);}' +
    // One small round icon button for the whole OS (owner 2026-10-23: the Dashboard refresh and the Quotes back arrow are the same logo): BuenTrade blue, fills on hover, spins while busy.
    '.bt-icon-btn{flex:0 0 30px;width:30px;height:30px;padding:0;margin:0;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:rgba(90,170,255,.14);color:#5AAAFF;border:1.5px solid #1E6ADB;cursor:pointer;transition:background .15s,color .15s,transform .15s;}' +
    '.bt-icon-btn:hover{background:#1E6ADB;color:#fff;}' +
    '.bt-icon-btn:active{transform:scale(.92);}' +
    '.bt-icon-btn:disabled{cursor:default;opacity:.8;}' +
    '.bt-icon-btn svg{width:15px;height:15px;}' +
    '.bt-icon-btn.spin svg{animation:btIconSpin .8s linear infinite;}' +
    '@keyframes btIconSpin{to{transform:rotate(360deg);}}' +
    '.nav-row{padding-left:76px;padding-right:76px;box-sizing:border-box;}' +
    // Phones (user 2026-10-05: "no están responsive en el celular"): the nav stacked one link per line and filled half
    // the screen, and iPhone zoomed the whole page in (and stayed zoomed) every time a box under 16px got focus.
    // Brand left and account chip right on one line, the 8 links in two compact lines, every input at 16px.
    '@media (max-width:760px){' +
      'header{padding:12px 16px !important;}' +
      'header .top-row{min-height:40px;}' +
      // the brand link, whatever its address — Netlify rewrites "dashboard.html" to "/dashboard" when it publishes
      'header .top-row > a{left:0 !important;}' +
      '#userChip{right:16px !important;top:19px !important;bottom:auto !important;}' +
      '.nav-row{padding-left:0;padding-right:0;margin-top:10px;gap:2px 0;}' +
      '.nav-pill{font-size:13.5px;padding:6px 9px;}' +
      'input:not([type=checkbox]):not([type=radio]):not([type=range]),select,textarea{font-size:16px !important;}' +
      // stat cards (same recipe on every page): two per line, smaller icon and number so labels and amounts fit
      '.stats-row{grid-template-columns:repeat(2,minmax(0,1fr)) !important;gap:10px !important;}' +
      '.stat-card{padding:12px !important;gap:9px !important;min-width:0;}' +
      '.stat-card > div:last-child{min-width:0;}' +
      '.stat-icon{width:30px !important;height:30px !important;display:flex !important;}' +
      '.stat-icon svg{width:15px;height:15px;}' +
      '.stat-value,.stat-card.hero .stat-value{font-size:clamp(14px,4vw,16px) !important;white-space:nowrap !important;}' +
      '.stat-label{font-size:10.5px;}' +
      // 3-to-6-column form/profile/filter grids (shared .grid3/.grid4/.grid5/.profile-grid, and inline ones like Offers'
      // Status/From/To/Search row, which made the Offers page 464px wide on a 375px phone): two columns
      '.grid3,.grid4,.grid5,.profile-grid,' +
      '[style*="grid-template-columns:1fr 1fr 1fr"],[style*="grid-template-columns:repeat(3"],[style*="grid-template-columns:repeat(4"],' +
      '[style*="grid-template-columns:repeat(5"],[style*="grid-template-columns:repeat(6"]{grid-template-columns:repeat(2,minmax(0,1fr)) !important;}' +
      '.seg-btn{padding:0 5px !important;}' +
      // form grids (the shared .grid3/.grid4/.grid5 of every edit form): one field per line — two per line cut the words inside them ("Productos Nez")
      '.grid3,.grid4,.grid5{grid-template-columns:minmax(0,1fr) !important;}' +
      // a "from … to …" pair of date boxes wraps instead of running off the screen (Pay & Receive's Delivered from / to)
      'span[style*="inline-flex"][style*="white-space:nowrap"]{flex-wrap:wrap !important;white-space:normal !important;}' +
      'input[type=date]{min-width:0;max-width:100%;}' +
      // a row of tabs wraps onto a second line instead of running past the card (Plants: Profile · Products & Prices · Locations · Pending · History)
      '.tab-row{flex-wrap:wrap !important;gap:4px !important;}' +
      '.tab-btn{flex:1 1 auto !important;}' +
      '.of-search-wrap,.of-search-input{width:100% !important;max-width:100% !important;box-sizing:border-box;}' +
      // a client's product row (Clients → Products): the name on top, the "how often do they buy it" box full width below, the × beside the icon
      '.cp-product-card{flex-wrap:wrap !important;}' +
      '.cp-product-info{flex:1 1 calc(100% - 60px) !important;}' +
      '.cp-cadence-display{flex:1 1 100% !important;order:3;}' +
      '.cp-cadence-display select,.cp-cadence-display .bt-select-wrap{width:100% !important;}' +
      '.cp-cadence-display{flex-wrap:wrap;}' +
      '.cp-cadence-display > span{min-width:0 !important;}' +
      '.cp-product-card{position:relative;}' +
      '.cp-product-info{padding-right:40px;}' +
      '.cp-remove-btn{position:absolute !important;top:10px;right:10px;width:32px !important;height:32px !important;}' +
      // tables inside their scroll box keep a readable width and size their columns to what is in them, sliding sideways instead of
      // squeezing fixed columns until the numbers run over each other (Offers' "$1.3500 → $1.5400" ran over its Sent tag at 285px)
      // the sign-in card kept 0 px of margin on a phone (user 2026-10-15: localhost orders.html): it touched both screen edges
      '#authGate{padding:16px;box-sizing:border-box;}' + '.auth-box{padding:26px 20px !important;box-sizing:border-box;}' +
      '.table-scroll > table{min-width:600px;table-layout:auto !important;}' +
      // Tables on a phone are CARDS (user 2026-10-10: "el cel no está responsive, todas las tablas se chocan para los lados, se cortan"): a table that
      // slides sideways hides its right-hand columns (price, status, the buttons). Each row becomes a card, each cell its own line with its column
      // name; the header row hides. Marked by the script below (it copies each column's name onto its cells as data-label).
      'table.bt-stack,table.bt-stack > tbody{display:block;width:100% !important;min-width:0 !important;}' +
      '.table-scroll > table.bt-stack{min-width:0 !important;}' +
      'table.bt-stack > thead{display:none;}' +
      'table.bt-stack tr[data-bt-empty]{display:none;}' +
      'table.bt-stack tr{display:block;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:6px 14px;margin:0 0 10px;}' +
      'table.bt-stack tr > td,table.bt-stack tr > th{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:8px 0 !important;border:0 !important;border-bottom:1px solid rgba(255,255,255,.07) !important;text-align:right !important;width:auto !important;min-width:0 !important;white-space:normal !important;}' +
      'table.bt-stack tr > td:last-child{border-bottom:0 !important;}' +
      'table.bt-stack tr > td[data-label]::before{content:attr(data-label);flex:0 0 auto;max-width:40%;font-size:10px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;color:rgba(255,255,255,.5);text-align:left;}' +
      'table.bt-stack tr > td[data-long]{flex-direction:column;align-items:flex-start;gap:4px;text-align:left !important;}' +
      'table.bt-stack tr > td[data-first]{display:block;text-align:left !important;font-weight:600;font-size:14.5px;padding-top:10px !important;}' +
      'table.bt-stack tr > td[data-first]::before{display:none;}' +
      // the pulsing red rail of a late load (Pay & Receive) sits on this cell's left edge: keep the order number off it; the product line has room on a card, so it wraps instead of cutting at 170px
      'table.bt-stack tr > td[data-first]{padding-left:14px !important;padding-bottom:10px !important;}' + 'table.bt-stack .pr-product{max-width:none !important;white-space:normal !important;overflow:visible !important;text-overflow:clip !important;}' +
      'table.bt-stack tr > td[colspan]{display:block;text-align:left !important;}' +
      'table.bt-stack tr > td:empty{display:none;}' +
    '}';
  document.head.appendChild(css);

  // Phones: a wide table that isn't already inside a sideways-scrolling box gets one, so the table scrolls
  // sideways instead of stretching (and shifting) the whole page. Tables are drawn after data loads, so keep watching.
  if (window.matchMedia && matchMedia('(max-width:760px)').matches && document.body) {
    var queued = false;
    var wrapTables = function(){
      queued = false;
      var tables = document.querySelectorAll('table');
      for (var i = 0; i < tables.length; i++) {
        var t = tables[i], scrolls = false;
        for (var p = t.parentElement; p && p !== document.body; p = p.parentElement) {
          var ox = getComputedStyle(p).overflowX;
          if (ox === 'auto' || ox === 'scroll') { scrolls = true; break; }
        }
        if (scrolls) continue;
        var w = document.createElement('div');
        w.style.cssText = 'overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;';
        t.parentNode.insertBefore(w, t);
        w.appendChild(t);
      }
    };
    // Every table with a header row becomes a stack of cards: the header's column names are copied onto the cells (data-label). A row that
    // does not line up with the header (a group title, an inline panel, "no rows") is left as a plain full-width block.
    var stackTables = function(){
      var tables = document.querySelectorAll('table');
      for (var i = 0; i < tables.length; i++) {
        var t = tables[i];
        var head = t.tHead && t.tHead.rows[0];
        if (!head || t.hasAttribute('data-no-stack')) continue;
        var labels = [];
        for (var h = 0; h < head.cells.length; h++) labels.push((head.cells[h].textContent || '').replace(/\s+/g, ' ').trim());
        if (!labels.length) continue;
        t.classList.add('bt-stack');
        var rows = t.querySelectorAll('tbody > tr');
        for (var r = 0; r < rows.length; r++) {
          var row = rows[r];
          // an empty row (a closed detail panel) is not a card: no empty boxes between the real ones
          if ((row.textContent || '').trim() === '' && !row.querySelector('input,button,select,textarea,img,svg,a')) row.setAttribute('data-bt-empty', '');
          else row.removeAttribute('data-bt-empty');
          if (row.getAttribute('data-bt') === String(row.cells.length)) continue;
          row.setAttribute('data-bt', String(row.cells.length));
          if (row.cells.length !== labels.length) continue;
          for (var c = 0; c < row.cells.length; c++) {
            var cell = row.cells[c];
            if (cell.hasAttribute('colspan')) continue;
            if (c === 0) cell.setAttribute('data-first', '');
            if (labels[c]) cell.setAttribute('data-label', labels[c]);
            if ((cell.textContent || '').trim().length > 24) cell.setAttribute('data-long', ''); // a sentence reads under its column name, not squeezed beside it
          }
        }
      }
    };
    new MutationObserver(function(){ if (!queued) { queued = true; setTimeout(function(){ wrapTables(); stackTables(); }, 60); } })
      .observe(document.body, { childList: true, subtree: true });
  }

  // Server calls that survive a busy moment (user 2026-10-06: "sistema muerto… quedamos de trabajar normal"). Every screen has its own
  // callApi; this wraps it once, for all of them, after the page defined it:
  //   • the database out of connections ("EMAXCONNSESSION / max clients reached") means the call never touched any data, so any call
  //     is tried again — up to 3 tries, 0.7s and 1.4s apart;
  //   • a lookup (…-search) that gets no answer in 25s, or fails on the network, is tried again too. A save is never re-sent on a
  //     network failure or a timeout, because it may already have gone through.
  // What still fails after that reaches the page as the same error it always did.
  function wrapCallApi(){
    var orig = window.callApi;
    if (typeof orig !== 'function' || orig.__retrying) return;
    var BUSY = /EMAXCONNSESSION|max clients reached/i;
    var NETWORK = /Failed to fetch|NetworkError|Load failed|timed out/i;
    var wrapped = function(fn, body){
      var isLookup = /-search$/.test(String(fn));
      var attempt = function(n){
        var call = orig(fn, body);
        if (isLookup) call = Promise.race([call, new Promise(function(_, rej){ setTimeout(function(){ rej(new Error('The server timed out')); }, 25000); })]);
        return call.catch(function(e){
          var msg = String((e && e.message) || e) + ' ' + JSON.stringify((e && e.data) || '');
          var retry = n < 3 && (BUSY.test(msg) || (isLookup && NETWORK.test(msg)));
          if (!retry) throw e;
          return new Promise(function(r){ setTimeout(r, 700 * n); }).then(function(){ return attempt(n + 1); });
        });
      };
      return attempt(1);
    };
    wrapped.__retrying = true;
    window.callApi = wrapped;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrapCallApi); else wrapCallApi();

  var badge = document.getElementById('userBadge');
  var avatar = document.getElementById('userAvatar');
  var chip = document.getElementById('userChip');

  // "Enable notifications" (user 2026-10-05, OS added to the iPhone home screen): iPhone only lets a page ask for
  // notification permission after a tap, so the automatic ask on login (orders/offers) never reached the phone.
  // Shown only where push works and this device hasn't answered yet; the tap asks, subscribes and saves the device
  // through push-subscribe (upsert on endpoint, safe to repeat).
  var VAPID_PUBLIC_KEY = 'BF6sg1hoRI0lW7rnTtrq0OjNTpx1QXWd775B30addUWlvqkJIsBuWZaB9mG-zvsIZ9C-cCP2Penh-eUxZTAFmiI';
  if (chip && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && Notification.permission === 'default') {
    var nb = document.createElement('button');
    nb.type = 'button';
    nb.className = 'hdr-notify';
    nb.textContent = 'Enable notifications';
    css.textContent += '.hdr-notify{font-family:"Space Grotesk",sans-serif;font-size:11px;font-weight:700;color:#fff;background:rgba(232,181,76,.18);border:1px solid rgba(232,181,76,.6);border-radius:999px;padding:3px 9px;cursor:pointer;white-space:nowrap;margin-right:2px;}' +
      '.hdr-notify:hover{background:rgba(232,181,76,.3);}';
    nb.addEventListener('click', function(){
      nb.disabled = true;
      Notification.requestPermission().then(function(permission){
        if (permission !== 'granted') { nb.remove(); return; }
        return navigator.serviceWorker.register('/sw.js').then(function(){ return navigator.serviceWorker.ready; }).then(function(reg){
          return reg.pushManager.getSubscription().then(function(sub){
            if (sub) return sub;
            var b64 = VAPID_PUBLIC_KEY + '='.repeat((4 - VAPID_PUBLIC_KEY.length % 4) % 4);
            var raw = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
            var key = new Uint8Array(raw.length);
            for (var i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i);
            return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
          });
        }).then(function(sub){
          var j = sub.toJSON();
          return callApi('push-subscribe', { actor: currentActor(), endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
        }).then(function(){ nb.remove(); });
      }).catch(function(e){
        nb.disabled = false;
        if (window.btAlert) btAlert('Notifications could not be enabled: ' + e.message); else alert('Notifications could not be enabled: ' + e.message);
      });
    });
    chip.insertBefore(nb, chip.firstChild);
  }

  if (!badge || !avatar) return;
  function sync(){
    var t = (badge.textContent || '').trim();
    var parts = t.split('@');
    avatar.textContent = !t ? '' : (parts.length === 2 && parts[0] && parts[1]) ? (parts[0][0] + parts[1][0]).toUpperCase() : t.slice(0, 2).toUpperCase();
    if (chip) chip.title = t;
  }
  new MutationObserver(sync).observe(badge, { childList: true, characterData: true, subtree: true });
  sync();
})();

// A READ NEVER HANGS THE SCREEN (owner 2026-10-26: "ni today ni monday ni nada carga"). The server sometimes lets ONE request hang (a database connection that died while the function was idle: about 1 in 8 calls of
// `messaging`, measured 2026-10-26), and a screen that waits for it stays on "Loading…" for ever. A READ that has not answered in 8 s is cancelled and asked again (up to 3 times); the next call lands on a healthy connection.
// ONLY reads are retried (the list below); a write is sent exactly once, exactly as before. callApi in every page calls this instead of fetch.
var btMqHigh = [], btMqLow = [], btMqBusy = false;
function btMqPump(){
  if (btMqBusy) return;
  var job = btMqHigh.shift() || btMqLow.shift(); if (!job) return;
  btMqBusy = true; var freed = false;
  var free = function(){ if (freed) return; freed = true; btMqBusy = false; btMqPump(); };
  var wd = setTimeout(free, 60000); // a call that never answers must not hold the line for ever
  job.run().then(function(v){ clearTimeout(wd); free(); job.res(v); }, function(e){ clearTimeout(wd); free(); job.rej(e); });
}
function btMqEnqueue(run, high){ return new Promise(function(res, rej){ (high ? btMqHigh : btMqLow).push({ run: run, res: res, rej: rej }); btMqPump(); }); }
async function btFetchOnce(url, opts, read){
  if (!read || typeof AbortController === 'undefined') return fetch(url, opts);
  var last;
  for (var attempt = 1; attempt <= 3; attempt++) {
    var ctl = new AbortController(), timer = setTimeout(function(){ ctl.abort(); }, 8000);
    try { var r = await fetch(url, Object.assign({}, opts, { signal: ctl.signal })); clearTimeout(timer); return r; }
    catch (e) { clearTimeout(timer); last = e; if (!(e && e.name === 'AbortError')) throw e; }
  }
  throw last;
}
// MESSAGING ONE AT A TIME (owner 2026-10-26, reproduced: three calls at once = two of them hang for ever). The function has ONE database connection and two requests at once on it hang in the pooler's transaction mode, so the
// page sends its `messaging` calls one after the other, the reads (list, weekly_summary) before the drafts. Nothing else changes.
window.btFetch = async function(url, opts){
  var fn = '', b = {};
  try { fn = String(url).split('/functions/v1/')[1].split('?')[0]; } catch (e) {}
  try { b = JSON.parse((opts && opts.body) || '{}') || {}; } catch (e) {}
  var read = fn === 'dashboard-summary'
    || (/-search$/.test(fn) && fn !== 'sent-offers-search') // every other search only reads (checked 2026-10-26: none of them writes)
    || (fn === 'customer-product-signal' && !b.log_notification)
    || (fn === 'messaging' && (b.action === 'list' || b.action === 'weekly_summary'))
    || (fn === 'sent-offers-search' && b.offer_sheet && (b.offer_sheet.action === 'list' || b.offer_sheet.action === 'get'));
  if (fn === 'messaging') return btMqEnqueue(function(){ return btFetchOnce(url, opts, read); }, read);
  return btFetchOnce(url, opts, read);
};
