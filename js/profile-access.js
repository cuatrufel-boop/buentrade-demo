// Which screens each profile uses (owner 2026-11-01: "todo lo que está en el OS debe ser decidido por usuario"; Quotes, Offers, Orders, Clients, Products = trader; Plants, Market Flash = buyer;
// Carrier rates, Providers = logistics; Pay & Receive = collections). It only HIDES and BLOCKS what already exists: no screen, button or flow changes inside.
// Off unless the system says profiles are ON for this person (the status answer: enforced), whether or not the Bid funnel is switched on; in the real system they are off, so nothing here does anything. An admin sees everything.
// A screen not listed here (Dashboard, the public site, the trading tool) is not restricted. The internal role key of Pay & Receive stays 'payments'; its name for people is Collections.
(function (root) {
  var ACCESS = {
    'quotes.html': ['trader'], 'offers.html': ['trader'], 'orders.html': ['trader'], 'customers.html': ['trader'], 'products.html': ['trader'],
    'plants.html': ['buyer'], 'market-flash.html': ['buyer'],
    'providers.html': ['logistics'], 'carrier-rates.html': ['logistics'],
    'collections.html': ['payments']
  };
  function canOpen(file, roles) {
    var need = ACCESS[String(file || '').toLowerCase()];
    if (!need) return true;
    roles = roles || [];
    if (roles.indexOf('admin') !== -1) return true;
    return need.some(function (r) { return roles.indexOf(r) !== -1; });
  }
  function fileOf(href) { return String(href || '').split('#')[0].split('?')[0].split('/').pop().toLowerCase(); }
  var api = { ACCESS: ACCESS, canOpen: canOpen, fileOf: fileOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.btProfileAccess = api;
  if (typeof document === 'undefined') return;

  function apply(roles) {
    var here = fileOf(root.location && root.location.pathname) || 'index.html';
    var pills = document.querySelectorAll('.nav-row a[href]');
    for (var i = 0; i < pills.length; i++) { if (!canOpen(fileOf(pills[i].getAttribute('href')), roles)) pills[i].style.display = 'none'; }
    if (canOpen(here, roles)) return;
    var box = document.createElement('div');
    box.id = 'btNoAccess';
    box.style.cssText = 'position:fixed;inset:0;z-index:2147482000;background:#0b1220;color:#e5e7eb;display:flex;align-items:center;justify-content:center;font:600 16px/1.4 Inter,system-ui,sans-serif;text-align:center;padding:24px';
    box.innerHTML = '<div><div style="font-size:18px;margin-bottom:12px;">This screen is not part of your profile.</div><a href="dashboard.html" style="color:#60a5fa;">Go to your dashboard →</a></div>';
    document.body.appendChild(box);
  }
  function start() {
    try {
      if (typeof auth === 'undefined' || typeof API_ROOT === 'undefined' || typeof API_KEY === 'undefined') return;
      if (root.top && root.top !== root) return; // never inside an embedded frame (Quotes embeds the trading tool once per plant): the screen around it already did
      auth.onAuthStateChanged(function (user) {
        if (!user || !user.email) return;
        Promise.resolve(user.getIdToken ? user.getIdToken() : '').catch(function () { return ''; }).then(function (tok) {
          return fetch(API_ROOT + 'sent-offers-search' + (typeof API_REGION !== 'undefined' ? API_REGION : ''), {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_KEY, 'apikey': API_KEY },
            body: JSON.stringify({ funnel: { action: 'status', actor: user.email, id_token: tok } })
          });
        }).then(function (r) { return r.ok ? r.json() : null; }).then(function (st) {
          var lens = root.btViewAs && root.btViewAs.allowed(st) ? root.btViewAs.current() : null; // "View as" (js/view-as.js, owner 2026-11-09): the person with full access looking through ANOTHER profile; null = his own view, as always
          if (lens) apply([lens]); else if (st && st.enforced === true && Array.isArray(st.roles)) apply(st.roles);
          if (root.btViewAs) root.btViewAs.mount(st);
        }).catch(function () { /* any doubt: the screen stays exactly as it is */ });
      });
    } catch (e) { /* same */ }
  }
  // after the page's own scripts have declared the sign-in and the API (the Dashboard declares them below this tag)
  if (document.readyState === 'loading') root.addEventListener('load', start); else start();
})(typeof window !== 'undefined' ? window : this);
