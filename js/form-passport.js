/* The form "passport" — live completeness ring, initials and checklist for every add/edit form that uses the K layout
   (css/bt-ui.css, .kform). Reads only; nothing here changes what Save records. Each .kform says what it counts:
     data-kp-fields="id,id,…"       every field that counts toward the ring
     data-kp-need="id:Label,id:Label" the required ones, shown as the checklist
     data-kp-name="id"              the field whose first letters fill the round mark */
(function(){
  function val(id){ var e = document.getElementById(id); return e ? String(e.value == null ? '' : e.value).trim() : ''; }
  function refresh(form){
    if (!form || !form.querySelector) return;
    var fields = (form.getAttribute('data-kp-fields') || '').split(',').filter(Boolean);
    var need = (form.getAttribute('data-kp-need') || '').split(',').filter(Boolean).map(function(x){ var i = x.indexOf(':'); return [x.slice(0, i), x.slice(i + 1)]; });
    var nameId = form.getAttribute('data-kp-name');
    var ring = form.querySelector('.kring'), pctEl = form.querySelector('.kpct'), mark = form.querySelector('.kmark'), box = form.querySelector('.kneed');
    var pct = fields.length ? Math.round(fields.filter(function(id){ return val(id); }).length / fields.length * 100) : 0;
    if (ring) ring.style.setProperty('--p', pct);
    if (pctEl) pctEl.textContent = pct + '%';
    if (mark && nameId && !mark.querySelector('img')){
      var nm = nameId ? val(nameId) : '';
      mark.textContent = nm ? nm.split(/\s+/).map(function(w){ return w[0]; }).slice(0, 2).join('').toUpperCase() : '+';
    }
    if (box) box.innerHTML = need.map(function(n){ return '<div><i class="' + (val(n[0]) ? 'ok' : '') + '"></i>' + n[1] + '</div>'; }).join('');
  }
  function refreshAll(){ document.querySelectorAll('.kform').forEach(refresh); }
  window.btPassport = { refresh: refresh, refreshAll: refreshAll };
  ['input','change'].forEach(function(ev){ document.addEventListener(ev, function(e){ var f = e.target && e.target.closest && e.target.closest('.kform'); if (f) refresh(f); }); });
  // Fields are also filled by code when a form opens (no input event): re-read the forms on screen twice a second.
  setInterval(function(){ document.querySelectorAll('.kform').forEach(function(f){ if (f.offsetParent !== null) refresh(f); }); }, 500);
  if (document.readyState !== 'loading') refreshAll(); else document.addEventListener('DOMContentLoaded', refreshAll);
})();
