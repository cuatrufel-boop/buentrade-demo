// "VIEW AS" (owner 2026-11-09: "yo tengo full access, puedo cambiar a la vista de quien quiera"; "mi vista real es 100% de todo y desde esa misma real cambiar a la de trader, buyer, collections, logistics o volver a la mía"; "una sola
// versión, la demo es solo una copia"). The person with full access (an admin; in the real system today, everybody who signs in) gets a small selector inside the account chip of the header of every OS screen: Admin (everything, as always) / Trader / Buyer /
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
  // the look is the header chip's own (js/header-chip.js: Space Grotesk, the translucent chip, the gold pill of "Enable notifications" when something is switched on): a small "VIEWING AS  Admin ▾" inside the account chip, gold while I look through
  // another profile so it is never forgotten; below 1400 px (laptops, tablets, the phone) only the profile name shows so the chip never runs into the menu (the select is already 16px on the phone: header-chip's rule), the words "Viewing as" stay as its tooltip
  var CHEVRON = 'url("data:image/svg+xml;utf8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 10 6%27%3E%3Cpath d=%27M1 1l4 4 4-4%27 fill=%27none%27 stroke=%27white%27 stroke-width=%271.6%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E")';
  var EYE = 'url("data:image/svg+xml;utf8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27white%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0%27/%3E%3Cpath d=%27M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6%27/%3E%3C/svg%3E")';
  var CSS = '.hdr-viewas{display:inline-flex;align-items:center;gap:4px;margin-right:2px;padding:1px 3px 1px 7px;border-radius:999px;border:1px solid transparent;font-family:"Space Grotesk",sans-serif;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.65);white-space:nowrap;}' +
    'html body #userChip #btViewAs select{font:700 11px "Space Grotesk",sans-serif !important;letter-spacing:0 !important;text-transform:none !important;color:#fff !important;background:transparent ' + CHEVRON + ' no-repeat right 3px center !important;background-size:8px 5px !important;border:0 !important;border-radius:0 !important;box-shadow:none !important;outline:0;cursor:pointer;padding:2px 14px 2px 2px !important;margin:0 !important;width:auto !important;min-width:0 !important;height:auto !important;min-height:0 !important;-webkit-appearance:none;appearance:none;}' +
    'html body #userChip #btViewAs select option{color:#0f172a !important;background:#fff !important;}' +
    '.hdr-viewas.on{background:rgba(232,181,76,.18);border-color:rgba(232,181,76,.6);color:#fff;}' +
    '@media (max-width:1399px){.hdr-viewas .hdr-viewas-label{display:none;}.hdr-viewas{padding-left:4px;}}' +
    // the phone: the select must be 16px (the iPhone zooms the page on a smaller box) and that is too wide for the chip, so it shows only an eye (the gold pill says a profile is on; the picker lists the five)
    '@media (max-width:760px){html body #userChip #btViewAs select{font-size:16px !important;width:26px !important;padding:0 !important;color:transparent !important;background-image:' + EYE + ' !important;background-size:15px 15px !important;background-position:center !important;}.hdr-viewas{padding:1px 2px 1px 2px;}}';
  function mount(st) {
    try {
      if (typeof document === 'undefined' || !document.body || !allowed(st) || root.__btDemo) return; // the demo has its own accounts switch
      var chip = document.getElementById && document.getElementById('userChip'); // lives in the header's account chip; a screen without the OS header gets no selector
      if (!chip || document.getElementById('btViewAs')) return;
      if (!write(read())) return; // no storage here: the choice could not be kept, so no selector
      var cur = read();
      if (!document.getElementById('btViewAsCss')) { var css = document.createElement('style'); css.id = 'btViewAsCss'; css.textContent = CSS; document.head.appendChild(css); }
      var w = document.createElement('div');
      w.id = 'btViewAs'; w.className = 'hdr-viewas' + (cur === 'admin' ? '' : ' on'); w.title = 'Viewing as';
      var lab = document.createElement('span'); lab.className = 'hdr-viewas-label'; lab.textContent = 'Viewing as';
      var sel = document.createElement('select');
      sel.setAttribute('aria-label', 'Viewing as');
      var html = '';
      for (var i = 0; i < ROLES.length; i++) html += '<option value="' + ROLES[i][0] + '"' + (ROLES[i][0] === cur ? ' selected' : '') + '>' + ROLES[i][1] + '</option>';
      sel.innerHTML = html;
      sel.onchange = function () { if (write(sel.value)) root.location.reload(); };
      w.appendChild(lab);
      w.appendChild(sel);
      if (cur !== 'admin') chip.style.zIndex = '2147483001'; // above the "not part of your profile" cover of a blocked screen (profile-access): the way back is always in reach
      chip.insertBefore(w, chip.firstChild);
    } catch (e) { /* any doubt: the screen stays exactly as it is */ }
  }
  var api = { KEY: KEY, ROLES: ROLES, current: current, mount: mount, allowed: allowed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.btViewAs = api;
})(typeof window !== 'undefined' ? window : this);
