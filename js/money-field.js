// THE money field of the whole system (owner 2026-10-16: "el campo de los precios está muy inseguro, se pueden poner más ceros o menos ceros … un formato blindado, y no dejar seguir si está mal").
// One implementation, here. Any <input data-money> (or data-money="4" for $/lb with 4 decimals) becomes a USD field like the big payment apps have:
//   - a text box with the decimal keyboard, no arrows and no mouse-wheel (type=number let the wheel change a price, and accepted 1e3, -5, 9 decimals);
//   - only digits and ONE dot; the thousands commas appear while typing ("1000" shows 1,000 — "10000" shows 10,000), so an extra zero is seen at once;
//   - a typed comma is refused and a pasted European "12,50" is refused with a message (1,5 would otherwise become 15 — ten times the price);
//   - two decimals when the person leaves the box (1,000.00), at most 9 digits before the dot;
//   - `$` before and `USD` after (unless the page already draws them).
// The page's own code does not change: input.value still returns the clean machine number ("1000.5"), and setting input.value shows it formatted.
// btMoney.confirmChange(rows) is the "Antes → Ahora" review before a changed price is saved (Wise-style review screen).
// Pure functions are exported for the tests (module.exports); in the page everything hangs from window.btMoney.
(function (root) {
  'use strict';
  var MAX_INT = 9;
  var es = function () { try { return /^es/i.test(document.documentElement.lang || ''); } catch (e) { return false; } };
  var T = function (en, sp) { return es() ? sp : en; };

  // What is being typed: digits and one dot, no leading zeros, decimals cut to `dec`. "." → "0.", "" → "".
  function typing(text, dec) {
    var s = String(text == null ? '' : text).replace(/[^0-9.]/g, '');
    if (s === '') return '';
    var i = s.indexOf('.'), hasDot = i >= 0;
    var ip = (hasDot ? s.slice(0, i) : s).replace(/^0+(?=\d)/, '').slice(0, MAX_INT);
    var fp = hasDot ? s.slice(i + 1).replace(/\./g, '').slice(0, dec == null ? 2 : dec) : '';
    return hasDot ? (ip || '0') + '.' + fp : ip;
  }
  // The clean machine number as text: "1,000.50" → "1000.50"; "5." → "5"; "" → "".
  function canonical(text, dec) { var t = typing(text, dec); return t.replace(/\.$/, ''); }
  function group(t) { var i = t.indexOf('.'), ip = i >= 0 ? t.slice(0, i) : t; return ip.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (i >= 0 ? t.slice(i) : ''); }
  // What is shown once the person leaves the box: grouped, at least 2 decimals.
  function fixed(t, dec) {
    if (t === '') return '';
    t = t.replace(/\.$/, '');
    var i = t.indexOf('.'), ip = i >= 0 ? t.slice(0, i) : t, fp = i >= 0 ? t.slice(i + 1) : '';
    while (fp.length < 2) fp += '0';
    return group(ip + '.' + fp.slice(0, Math.max(2, dec == null ? 2 : dec)));
  }
  // Where the caret goes in the grouped text so that `n` digits/dots are before it (commas move while typing).
  function caretFor(shown, n) { var c = 0, p = 0; while (p < shown.length && c < n) { if (/[0-9.]/.test(shown[p])) c++; p++; } return p; }
  function parse(text, dec) { var c = canonical(text, dec); return c === '' ? null : Number(c); }
  // A pasted "12,50" or "1.234,56" is a decimal comma — refused, never guessed (1,5 read as 15 would be ten times the price). "1,500" is a US thousand and is fine.
  function looksEuropean(text) {
    var s = String(text == null ? '' : text).trim();
    return /^\$?\s*\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s) || /^\$?\s*\d+,\d{1,2}$/.test(s);
  }
  // true when the number is a sane USD amount: a number, ≥ 0 (> 0 with positive), at most `dec` decimals.
  function valid(text, o) {
    o = o || {};
    var c = canonical(text, o.dec); if (c === '') return !!o.empty;
    var n = Number(c); if (!isFinite(n) || n < 0) return false;
    return o.positive ? n > 0 : true;
  }

  // ---------- the field in the page ----------
  var nativeGet = null, nativeSet = null;
  try { var d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); nativeGet = d.get; nativeSet = d.set; } catch (e) {}

  var css = '.bt-money-wrap{display:flex;align-items:center;gap:6px;max-width:100%}.bt-money-wrap .bt-money-cur{font-weight:700;font-size:12px;color:#64748B;white-space:nowrap}' +
    '.bt-money-wrap input{min-width:0;flex:1 1 auto;text-align:right}.bt-money-bad{border-color:#E5533D !important}.bt-money-msg{font-size:11.5px;font-weight:600;color:#E5533D;margin-top:3px;line-height:1.35}' +
    '.bt-mrv-ov{position:fixed;inset:0;background:rgba(10,25,48,.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.bt-mrv{background:#fff;color:#0F1F33;border-radius:14px;max-width:460px;width:100%;max-height:86vh;overflow:auto;padding:18px;font-family:Inter,system-ui,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.35)}' +
    '.bt-mrv h3{margin:0 0 4px;font-size:17px}.bt-mrv p{margin:0 0 10px;font-size:13px;color:#64748B}.bt-mrv .r{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid #E2E8F2;font-size:14px}' +
    '.bt-mrv .r b{white-space:nowrap}.bt-mrv .r s{color:#64748B;font-weight:500;margin-right:6px}.bt-mrv .bt{display:flex;gap:8px;margin-top:14px}.bt-mrv button{flex:1;border-radius:10px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit}' +
    '.bt-mrv .ok{background:#0F8A5F;color:#fff;border:none}.bt-mrv .no{background:#fff;color:#1E6ADB;border:1.5px solid #1E6ADB}';
  function ensureCss() { if (typeof document === 'undefined' || document.getElementById('bt-money-css')) return; var s = document.createElement('style'); s.id = 'bt-money-css'; s.textContent = css; (document.head || document.documentElement).appendChild(s); }

  function msgEl(el) {
    var host = el.closest('.bt-money-wrap') || el.closest('.inputwrap') || el;
    var m = host.nextElementSibling;
    if (!m || !m.classList || !m.classList.contains('bt-money-msg')) { m = document.createElement('div'); m.className = 'bt-money-msg'; m.hidden = true; host.parentNode.insertBefore(m, host.nextSibling); }
    return m;
  }
  function flag(el, text) {
    var m = msgEl(el); el.classList.add('bt-money-bad'); m.textContent = text; m.hidden = false;
    clearTimeout(el.__btMoneyT); el.__btMoneyT = setTimeout(function () { unflag(el); }, 3500);
  }
  function unflag(el) { el.classList.remove('bt-money-bad'); var m = msgEl(el); m.hidden = true; m.textContent = ''; }

  function attach(el) {
    if (!el || el.__btMoney || !nativeGet) return;
    var dec = Math.max(2, parseInt(el.getAttribute('data-money'), 10) || 2);
    el.__btMoney = { dec: dec };
    ensureCss();
    var initial = nativeGet.call(el);
    var focusedNow = document.activeElement === el;
    try { el.type = 'text'; } catch (e) {}
    el.setAttribute('inputmode', 'decimal'); el.setAttribute('autocomplete', 'off'); el.setAttribute('spellcheck', 'false');
    el.removeAttribute('step'); el.removeAttribute('min'); el.removeAttribute('max');
    // The page keeps reading .value and gets the clean number; writing .value shows it formatted.
    Object.defineProperty(el, 'value', {
      configurable: true,
      get: function () { return canonical(nativeGet.call(el), dec); },
      set: function (v) {
        var on = document.activeElement === el, c = (v == null || v === '') ? '' : (on ? typing(v, dec) : canonical(v, dec));
        nativeSet.call(el, c === '' ? '' : (on ? group(c) : fixed(c, dec)));
      }
    });
    // $ before and USD after, unless the page already draws its own (Trading Tool boxes, MX$ pesos…).
    var inWrap = el.closest('.inputwrap');
    if (!inWrap && !el.closest('.bt-money-wrap') && !focusedNow) {
      var w = document.createElement('span'); w.className = 'bt-money-wrap';
      var pf = document.createElement('span'); pf.className = 'bt-money-cur'; pf.textContent = '$';
      var sf = document.createElement('span'); sf.className = 'bt-money-cur'; sf.textContent = 'USD';
      if (el.parentNode) { el.parentNode.insertBefore(w, el); w.appendChild(pf); w.appendChild(el); w.appendChild(sf); }
    }
    // the value the page rendered, shown formatted
    if (initial !== '') {
      var shown0 = focusedNow ? group(typing(initial, dec)) : fixed(canonical(initial, dec), dec);
      if (shown0 !== initial) { var at = el.selectionStart, n0 = initial.slice(0, at == null ? initial.length : at).replace(/[^0-9.]/g, '').length; nativeSet.call(el, shown0); if (focusedNow) { var q = caretFor(shown0, n0); try { el.setSelectionRange(q, q); } catch (e) {} } }
    }

    el.addEventListener('beforeinput', function (e) {
      if (e.inputType === 'insertText' && e.data) {
        if (looksEuropean(e.data)) { e.preventDefault(); flag(el, T('Use a dot for decimals: 12.50', 'Usa punto para los decimales: 12.50')); return; }
        // a whole chunk (voice, autocorrect, drop) is cleaned, not refused; one typed key that is not a number is refused
        if (e.data.length > 1 && /[^0-9.,]/.test(e.data)) el.__btStripped = true;
        else if (/[^0-9.]/.test(e.data) && e.data.length === 1) { e.preventDefault(); flag(el, e.data === ',' ? T('Use a dot for decimals: 12.50', 'Usa punto para los decimales: 12.50') : T('Only numbers and one dot', 'Solo números y un punto')); return; }
        if (e.data.indexOf('.') >= 0) {
          var cur = nativeGet.call(el), a = el.selectionStart, b = el.selectionEnd;
          if (cur.slice(0, a).indexOf('.') >= 0 || cur.slice(b).indexOf('.') >= 0) { e.preventDefault(); flag(el, T('Only one dot', 'Solo un punto')); }
        }
      }
    });
    el.addEventListener('paste', function (e) {
      var txt = (e.clipboardData && e.clipboardData.getData('text')) || '';
      if (looksEuropean(txt)) { e.preventDefault(); flag(el, T('Use a dot for decimals: 12.50', 'Usa punto para los decimales: 12.50')); }
    });
    el.addEventListener('input', function () {
      var raw = nativeGet.call(el), pos = el.selectionStart == null ? raw.length : el.selectionStart;
      var before = raw.slice(0, pos).replace(/[^0-9.]/g, '').length;
      if (el.__btStripped) { el.__btStripped = false; flag(el, T('Only numbers and one dot', 'Solo números y un punto')); }
      var t = typing(raw, dec), shown = group(t);
      if (shown !== raw) {
        nativeSet.call(el, shown);
        var p = caretFor(shown, before);
        try { el.setSelectionRange(p, p); } catch (e) {}
      }
    });
    el.addEventListener('blur', function () {
      var c = canonical(nativeGet.call(el), dec);
      nativeSet.call(el, c === '' ? '' : fixed(c, dec));
      unflag(el);
    });
  }

  function scan(rootEl) {
    if (typeof document === 'undefined') return;
    var r = rootEl && rootEl.querySelectorAll ? rootEl : document;
    if (r !== document && r.matches && r.matches('input[data-money]')) attach(r);
    var list = r.querySelectorAll('input[data-money]');
    for (var i = 0; i < list.length; i++) attach(list[i]);
  }

  // A field that must be filled with a real amount: marks it red with the reason and returns false.
  function check(el, o) {
    o = o || {};
    if (!el) return true;
    var t = nativeGet ? nativeGet.call(el) : el.value, c = canonical(t, 4);
    if (c === '') { if (o.optional) return true; flag(el, T('Enter the amount in USD', 'Escribe el monto en USD')); try { el.focus(); } catch (e) {} return false; }
    if (!valid(c, { positive: o.positive !== false })) { flag(el, T('Enter an amount greater than 0', 'Escribe un monto mayor que 0')); try { el.focus(); } catch (e) {} return false; }
    return true;
  }

  // The review before a changed price is saved: rows [{label, before, after}] (numbers; before may be null = new). Resolves true on Confirm, false on Fix.
  function confirmChange(rows, o) {
    o = o || {};
    return new Promise(function (resolve) {
      ensureCss();
      var trim = function (x) { while (/\.\d\d+0$/.test(x)) x = x.slice(0, -1); return x; };
      var fmt = function (n) { return n == null ? T('new', 'nueva') : '$' + trim(fixed(String(Number(n)), 4)) + ' USD'; };
      var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
      var ov = document.createElement('div'); ov.className = 'bt-mrv-ov';
      ov.innerHTML = '<div class="bt-mrv" role="dialog" aria-modal="true"><h3>' + esc(o.title || T('Review before saving', 'Revisa antes de enviar')) + '</h3><p>' + esc(o.note || T('Check every amount: is it the one you mean?', '¿Es este el monto que quieres? Revisa cada uno.')) + '</p>' +
        rows.map(function (r) { return '<div class="r"><span>' + esc(r.label) + '</span><span>' + (r.before == null ? '' : '<s>' + fmt(r.before) + '</s>→ ') + '<b>' + fmt(r.after) + '</b></span></div>'; }).join('') +
        '<div class="bt"><button class="no" type="button">' + esc(o.fixLabel || T('Fix', 'Corregir')) + '</button><button class="ok" type="button">' + esc(o.okLabel || T('Confirm', 'Confirmar')) + '</button></div></div>';
      var done = function (v) { document.removeEventListener('keydown', onKey, true); ov.remove(); resolve(v); };
      var onKey = function (e) { if (e.key === 'Escape') { e.preventDefault(); done(false); } };
      ov.querySelector('.ok').onclick = function () { done(true); }; ov.querySelector('.no').onclick = function () { done(false); };
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(ov);
      ov.querySelector('.ok').focus();
    });
  }

  function raw(el) { return nativeGet ? nativeGet.call(el) : String(el.value); }
  var api = { raw: raw, caretFor: caretFor, typing: typing, canonical: canonical, group: group, fixed: fixed, parse: parse, looksEuropean: looksEuropean, valid: valid, attach: attach, scan: scan, check: check, flag: flag, confirmChange: confirmChange, MAX_INT: MAX_INT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.btMoney = api;

  if (typeof document !== 'undefined') {
    var start = function () {
      scan(document);
      try { new MutationObserver(function (muts) { for (var i = 0; i < muts.length; i++) { var a = muts[i].addedNodes; for (var j = 0; j < a.length; j++) if (a[j].nodeType === 1) scan(a[j]); } }).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
})(typeof window !== 'undefined' ? window : globalThis);
