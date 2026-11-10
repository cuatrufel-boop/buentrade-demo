// "VIEW AS" (owner 2026-11-09: "yo tengo full access, puedo cambiar a la vista de quien quiera"; "mi vista real es 100% de todo y desde esa misma real cambiar a la de trader, buyer, collections, logistics o volver a la mía"; "una sola
// versión, la demo es solo una copia"). The person with full access (an admin; in the real system today, everybody who signs in) gets a small selector at the bottom right of every OS screen: Admin (everything, as always) / Trader / Buyer /
// Logistics / Collections. Choosing a profile looks at the OS THROUGH that profile: js/profile-access.js hides the menu entries and blocks the screens that are not that profile's (the same assignment the owner made, one place: ACCESS).
// It only hides and blocks, like the rest of the profiles: it never changes data, never calls the server, grants nothing (a person who is not an admin never sees the selector and a stored choice never applies to him). The choice is kept
// in this browser (phone and computer each have their own) and "Admin" is always the way back. Any doubt (no storage, an unknown value): the full view, exactly as before.
(function (root) {
  var KEY = 'bt_view_as';
  // the wording is the one the demo already uses ("Viewing as"; Admin / Trader / Buyer / Logistics / Collections); the internal key of Collections stays 'payments'
  var ROLES = [['admin', 'Admin'], ['trader', 'Trader'], ['buyer', 'Buyer'], ['logistics', 'Logistics'], ['payments', 'Collections']];
  function valid(v) { for (var i = 0; i < ROLES.length; i++) { if (ROLES[i][0] === v) return true; } return false; }
  function read() { try { var v = root.localStorage.getItem(KEY); return valid(v) ? v : 'admin'; } catch (e) { return 'admin'; } }
  function write(v) { try { root.localStorage.setItem(KEY, v); return read() === v; } catch (e) { return false; } }
  // the profile to look through; null = my own view (everything)
  function current() { var v = read(); return v === 'admin' ? null : v; }
  // can this person look through other profiles? Only full access: an admin, or anybody while profiles are not enforced (the real system today: nobody is restricted).
  function allowed(st) {
    if (st && st.enforced === true && Array.isArray(st.roles)) return st.roles.indexOf('admin') !== -1;
    return !!st;
  }
  function mount(st) {
    try {
      if (typeof document === 'undefined' || !document.body || !allowed(st) || root.__btDemo) return; // the demo has its own accounts switch
      if (document.getElementById && document.getElementById('btViewAs')) return;
      var probe = write(read()); if (!probe) return; // no storage here: the choice could not be kept, so no selector
      var cur = read(), phone = !!(root.matchMedia && root.matchMedia('(max-width:760px)').matches);
      var w = document.createElement('div');
      w.id = 'btViewAs';
      w.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483001;background:' + (cur === 'admin' ? '#0f766e' : '#b45309') + ';color:#fff;font:600 12px/1.2 Inter,system-ui,sans-serif;padding:5px 8px;border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.35);display:flex;align-items:center;gap:6px';
      var sel = document.createElement('select');
      sel.setAttribute('aria-label', 'Viewing as');
      sel.style.cssText = 'font:600 ' + (phone ? '16' : '12') + 'px Inter,system-ui,sans-serif;border-radius:6px;border:0;padding:3px 4px;background:#fff;color:#0f172a'; // 16px on the phone: the iPhone zooms the page on a smaller box
      var html = '';
      for (var i = 0; i < ROLES.length; i++) html += '<option value="' + ROLES[i][0] + '"' + (ROLES[i][0] === cur ? ' selected' : '') + '>' + ROLES[i][1] + '</option>';
      sel.innerHTML = html;
      sel.onchange = function () { if (write(sel.value)) root.location.reload(); };
      w.appendChild(document.createTextNode('Viewing as'));
      w.appendChild(sel);
      document.body.appendChild(w);
    } catch (e) { /* any doubt: the screen stays exactly as it is */ }
  }
  var api = { KEY: KEY, ROLES: ROLES, current: current, mount: mount, allowed: allowed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.btViewAs = api;
})(typeof window !== 'undefined' ? window : this);
