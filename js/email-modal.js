// Shared "review before sending" email modal + send call — one real implementation instead of
// four separate copies (offers.html, orders.html, trading-tool.html, plants.html) that had
// already drifted apart in real, confirmed ways: plants.html had no CC/attachments/WhatsApp at
// all, trading-tool.html had no EMAIL_SIGNATURE constant and silently ignored edits to the To
// field, and three of the four had a wrong phone number in their local signature copy. This is
// the fix for that whole class of bug, not just the phone number.
//
// quotes.html is deliberately NOT part of this unification — it has a genuinely different,
// working batch/multi-recipient modal (rqOpenEmailModal, one card per recipient, per-item
// onSent callbacks, an isOffer-gated real-API-vs-Gmail-link split) built for a different job
// (asking many plants for a price at once). Folding a real, working, differently-shaped system
// into this one would be a rewrite risking regression to a system that isn't broken, not a fix.
//
// Deliberately keeps every calling file's own sendEmailApi(...) function signature and every one
// of its ~50 real call sites completely unchanged — only the modal markup, the open/cancel/confirm
// logic, and the actual fetch to the backend move here. Each file's sendEmailApi becomes a thin
// wrapper wiring its own existing positional args into bcSendEmailApi's one shared implementation.

const BC_EMAIL_SIGNATURE = '\n\n--\nBuenTrade — GOOD TRADE. GOOD BUSINESS.\nBuenTrade LLC\n1525 N Park Dr, Suite 104, Weston, FL 33326\n+1 754-248-1016 · buentradegroup.com';

let bcEmailModalResolve = null;
let bcEmailModalWaInfo = null;

// Injected once, on first use — the exact same modal every calling page used to hand-copy, using
// the same CSS classes (.email-modal-overlay/.email-modal-box/.email-modal-field/...) every one
// of those pages already defines in its own <style> block, so nothing there needs to change.
// icons and the grow-to-fit box shared by every message window (same as Quotes' review windows — css/bt-ui.css "MESSAGE WINDOWS")
const BT_WA_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" ><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.4c0-4.55 3.7-8.25 8.26-8.25 2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 0 1 2.42 5.84c0 4.55-3.71 8.25-8.26 8.25zm4.52-6.18c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.15.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43-.14-.01-.31-.01-.47-.01-.16 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.16 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.28z"/></svg>`;
const BT_MAIL_SVG = `<svg viewBox="0 0 24 24" fill="currentColor" ><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>`;
const BT_X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
function btFitBox(t){ if (!t || !t.offsetParent) return; t.style.overflowY = 'hidden'; t.style.height = 'auto'; t.style.height = (t.scrollHeight + (t.offsetHeight - t.clientHeight)) + 'px'; t.style.overflowY = t.scrollHeight > t.clientHeight + 1 ? 'auto' : 'hidden'; } // grows to its text (+ its border); a scrollbar only appears once the max height is reached
function btFitAll(overlayId){ const fit = () => document.querySelectorAll('#' + overlayId + ' textarea').forEach(t => btFitBox(t)); fit(); setTimeout(fit, 80); }
function bcEnsureEmailModal(){
  if (document.getElementById('emailModalOverlay')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
<div id="emailModalOverlay" class="email-modal-overlay" style="display:none;">
  <div class="email-modal-box">
    <div class="bt-modal-head">
      <div class="rq-wa-titlebar"><span class="rq-wa-logo rq-em-logo">${BT_MAIL_SVG}</span><h3 id="emailModalTitle">Review before sending</h3></div>
      <button type="button" class="bt-x" onclick="emailModalCancel()" title="Close" aria-label="Close">${BT_X_SVG}</button>
    </div>
    <div class="email-modal-from" id="emailModalFrom"></div>
    <div class="rq-em-fields">
      <div class="email-modal-field"><label>To</label><input type="text" id="emailModalTo" autocomplete="off" name="bt-email-to"></div>
      <div class="email-modal-field"><label>CC (optional — comma-separated)</label><input type="text" id="emailModalCc" placeholder="name@example.com, name2@example.com" autocomplete="off" name="bt-email-cc"></div>
    </div>
    <div class="email-modal-field"><label>Subject</label><input type="text" id="emailModalSubject" autocomplete="off" name="bt-email-subject"></div>
    <div class="email-modal-field"><label>Message</label><textarea id="emailModalBody" autocomplete="off" oninput="btFitBox(this)"></textarea></div>
    <div class="email-modal-field" id="emailModalAttachWrap" style="display:none;">
      <label>Attachments</label>
      <div class="email-modal-attachments" id="emailModalAttachments"></div>
    </div>
    <div class="email-modal-field" id="emailModalSentWrap" style="display:none;">
      <div style="display:flex;align-items:center;gap:8px;color:#3FCB7E;font-weight:700;font-size:13.5px;">✓ Email sent</div>
    </div>
    <div class="email-modal-field" id="emailModalWaWrap" style="display:none;">
      <div class="bt-wa-label">WhatsApp <span class="rq-msg-phone" id="emailModalWaPhone"></span></div>
      <div class="rq-wa-chat"><div class="rq-wa-bubble"><textarea id="emailModalWaBody" autocomplete="off" oninput="btFitBox(this)"></textarea></div></div>
    </div>
    <div id="emailModalErr" style="display:none;color:#FF9C8A;font-size:12.5px;margin-top:4px;"></div>
    <div class="email-modal-actions">
      <button type="button" id="emailModalWaBtn" class="wa-btn outline rq-wa-send" onclick="emailModalSendWhatsApp()" title="Also send via WhatsApp" aria-label="Also send via WhatsApp" style="display:none;margin-right:auto;">${BT_WA_SVG}</button>
      <button type="button" id="emailModalCancelBtn" class="btn secondary" onclick="emailModalCancel()">Cancel</button>
      <button type="button" id="emailModalSendBtn" class="btn" onclick="emailModalConfirm()">Send</button>
      <button type="button" id="emailModalDoneBtn" class="btn" onclick="emailModalDone()" style="display:none;">Done</button>
    </div>
  </div>
</div>`;
  document.body.appendChild(wrap.firstElementChild);
}

// opts: { fromAlias, to, cc, subject, text, attachments, fromDisplay, waInfo, title }
// to/cc may be an array or a comma-joined string either way — always normalized to a display
// string for the input, and re-split back into an array before the real send.
// Real ask 2026-09-14: "deberia primero enviar correo, confirmar que envio correo y despues dar
// la opcion de enviar whatsapp... como esta es confuso y no tiene un flujo" — the WhatsApp box and
// its button used to sit right next to Send, both visible before anything was actually sent, so
// clicking Send looked like it silently ignored WhatsApp. The real send now happens INSIDE this
// modal (moved here from bcSendEmailApi) so it can walk through real states: compose → Sending… →
// either an inline error (stays open, edit and retry) or Email sent ✓ (WhatsApp box/button appear
// only now, as the next optional step, with a Done button to close without it). Resolves
// { cancelled: true } | { sent: true, result } | { failed: true, error } — bcSendEmailApi below
// unwraps this into the same throw/return contract every caller already had, so none of the ~50
// real call sites (or their own catch-block Gmail-fallback logic) change at all.
let bcEmailModalOpts = null;
function bcOpenEmailModal(opts){
  opts = opts || {};
  bcEmailModalOpts = opts;
  bcEnsureEmailModal();
  const joinList = (v) => Array.isArray(v) ? v.join(', ') : (v || '');

  document.getElementById('emailModalTitle').textContent = opts.title || 'Review before sending';
  const fromEl = document.getElementById('emailModalFrom');
  fromEl.textContent = opts.fromDisplay ? `From: ${opts.fromDisplay}` : '';
  fromEl.style.display = opts.fromDisplay ? '' : 'none';
  document.getElementById('emailModalTo').value = joinList(opts.to);
  document.getElementById('emailModalCc').value = joinList(opts.cc);
  document.getElementById('emailModalSubject').value = opts.subject || '';
  document.getElementById('emailModalBody').value = opts.text || '';
  ['emailModalTo', 'emailModalCc', 'emailModalSubject', 'emailModalBody'].forEach(id => document.getElementById(id).disabled = false);

  const attachments = opts.attachments || [];
  const attachWrap = document.getElementById('emailModalAttachWrap');
  attachWrap.style.display = attachments.length ? '' : 'none';
  document.getElementById('emailModalAttachments').innerHTML = attachments
    .map(a => `<span class="email-modal-attachment-chip">📎 ${(a.filename || '').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</span>`)
    .join('');

  bcEmailModalWaInfo = (opts.waInfo && opts.waInfo.phone) ? opts.waInfo : null;
  document.getElementById('emailModalWaWrap').style.display = 'none';
  document.getElementById('emailModalWaBtn').style.display = 'none';
  document.getElementById('emailModalSentWrap').style.display = 'none';
  if (bcEmailModalWaInfo){
    document.getElementById('emailModalWaPhone').textContent = bcEmailModalWaInfo.phone;
    document.getElementById('emailModalWaBody').value = bcEmailModalWaInfo.message || '';
  }

  document.getElementById('emailModalErr').style.display = 'none';
  document.getElementById('emailModalCancelBtn').style.display = '';
  document.getElementById('emailModalSendBtn').style.display = '';
  document.getElementById('emailModalSendBtn').disabled = false;
  document.getElementById('emailModalSendBtn').textContent = 'Send';
  document.getElementById('emailModalDoneBtn').style.display = 'none';

  document.getElementById('emailModalOverlay').style.display = 'flex';
  btFitAll('emailModalOverlay');
  return new Promise(resolve => { bcEmailModalResolve = resolve; });
}

function emailModalCancel(){
  document.getElementById('emailModalOverlay').style.display = 'none';
  if (bcEmailModalResolve) bcEmailModalResolve({ cancelled: true });
  bcEmailModalResolve = null;
}

// Fires the real send right here, while the modal stays open so the trader sees it actually go
// out before WhatsApp is even offered — see the real ask quoted above bcOpenEmailModal.
async function emailModalConfirm(){
  const to = document.getElementById('emailModalTo').value;
  const cc = document.getElementById('emailModalCc').value;
  const subject = document.getElementById('emailModalSubject').value;
  const text = document.getElementById('emailModalBody').value;
  const finalTo = to.split(',').map(s => s.trim()).filter(Boolean);
  const finalCc = cc.split(',').map(s => s.trim()).filter(Boolean);

  document.getElementById('emailModalSendBtn').disabled = true;
  document.getElementById('emailModalSendBtn').textContent = 'Sending…';
  document.getElementById('emailModalCancelBtn').style.display = 'none';
  document.getElementById('emailModalErr').style.display = 'none';

  const opts = bcEmailModalOpts || {};
  let result;
  try {
    const res = await fetch('/.netlify/functions/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: opts.fromAlias, to: finalTo, cc: finalCc.length ? finalCc : undefined,
        subject, text, attachments: opts.attachments || [],
      }),
    });
    if (!res.ok){
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Send failed');
    }
    result = await res.json();
  } catch (e){
    document.getElementById('emailModalErr').textContent = e.message;
    document.getElementById('emailModalErr').style.display = '';
    document.getElementById('emailModalSendBtn').disabled = false;
    document.getElementById('emailModalSendBtn').textContent = 'Send';
    document.getElementById('emailModalCancelBtn').style.display = '';
    return; // stays open — trader can fix and retry, or Cancel to fall back to Gmail
  }

  // Sent — lock the compose fields, show confirmation, and only now offer WhatsApp as the next
  // optional step (or close outright when there's nothing to offer).
  ['emailModalTo', 'emailModalCc', 'emailModalSubject', 'emailModalBody'].forEach(id => document.getElementById(id).disabled = true);
  document.getElementById('emailModalSentWrap').style.display = '';
  document.getElementById('emailModalSendBtn').style.display = 'none';
  document.getElementById('emailModalDoneBtn').style.display = '';
  if (bcEmailModalWaInfo){
    document.getElementById('emailModalWaWrap').style.display = '';
    document.getElementById('emailModalWaBtn').style.display = '';
    btFitAll('emailModalOverlay');
  } else {
    document.getElementById('emailModalOverlay').style.display = 'none';
    if (bcEmailModalResolve) bcEmailModalResolve({ sent: true, result });
    bcEmailModalResolve = null;
    return;
  }
  bcEmailModalSentResult = result;
}
let bcEmailModalSentResult = null;

function emailModalDone(){
  document.getElementById('emailModalOverlay').style.display = 'none';
  if (bcEmailModalResolve) bcEmailModalResolve({ sent: true, result: bcEmailModalSentResult });
  bcEmailModalResolve = null;
}

function emailModalSendWhatsApp(){
  if (!bcEmailModalWaInfo) return;
  const message = document.getElementById('emailModalWaBody').value;
  const { phone, filename, content, contentType } = bcEmailModalWaInfo;
  if (content && typeof downloadBase64File === 'function') downloadBase64File(filename, content, contentType);
  bcConfirmWaSend(phone, message, content ? filename : null, { ask: false });
  emailModalDone();
}

// Real addition 2026-09-22 ("carga cerrada, avisar a otros clientes"): a candidate with a
// WhatsApp/phone number but no email has no path through bcOpenEmailModal at all (that modal
// always needs a To/email address). Same "review, edit, or skip before anything sends" rule as
// every other outbound message in the app — this is the WhatsApp-only twin, same shared classes
// (.email-modal-overlay/.email-modal-box/.email-modal-field/.email-modal-actions) so it looks like
// the rest of this exact modal family instead of a new, invented look. Resolves { cancelled: true }
// | { sent: true } — same two-outcome contract as bcOpenEmailModal, so callers can log a real send
// the same way for both channels.
let bcWaOnlyModalResolve = null;
function bcEnsureWaOnlyModal(){
  if (document.getElementById('waOnlyModalOverlay')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
<div id="waOnlyModalOverlay" class="email-modal-overlay" style="display:none;">
  <div class="email-modal-box">
    <div class="bt-modal-head">
      <div class="rq-wa-titlebar"><span class="rq-wa-logo">${BT_WA_SVG}</span><h3 id="waOnlyModalTitle">Review before sending</h3></div>
      <button type="button" class="bt-x" onclick="waOnlyModalCancel()" title="Close" aria-label="Close">${BT_X_SVG}</button>
    </div>
    <div class="bt-wa-label">WhatsApp <span class="rq-msg-phone" id="waOnlyModalPhone"></span></div>
    <div class="rq-wa-row">
      <div class="rq-wa-chat"><div class="rq-wa-bubble"><textarea id="waOnlyModalBody" autocomplete="off" oninput="btFitBox(this)"></textarea></div></div>
      <button type="button" id="waOnlyModalSendBtn" class="wa-btn outline rq-wa-send" onclick="waOnlyModalConfirm()" title="Open WhatsApp" aria-label="Open WhatsApp">${BT_WA_SVG}</button>
    </div>
    <div class="email-modal-actions" style="margin-top:14px;">
      <button type="button" id="waOnlyModalSkipBtn" class="btn secondary" onclick="waOnlyModalCancel()">Skip</button>
    </div>
  </div>
</div>`;
  document.body.appendChild(wrap.firstElementChild);
}
// opts: { title, phone, message }
function bcOpenWaOnlyModal(opts){
  opts = opts || {};
  bcEnsureWaOnlyModal();
  document.getElementById('waOnlyModalTitle').textContent = opts.title || 'Review before sending';
  document.getElementById('waOnlyModalPhone').textContent = opts.phone || '';
  document.getElementById('waOnlyModalBody').value = opts.message || '';
  document.getElementById('waOnlyModalOverlay').style.display = 'flex';
  btFitAll('waOnlyModalOverlay');
  return new Promise(resolve => { bcWaOnlyModalResolve = resolve; });
}
function waOnlyModalCancel(){
  document.getElementById('waOnlyModalOverlay').style.display = 'none';
  if (bcWaOnlyModalResolve) bcWaOnlyModalResolve({ cancelled: true });
  bcWaOnlyModalResolve = null;
}
async function waOnlyModalConfirm(){
  const phone = document.getElementById('waOnlyModalPhone').textContent;
  const message = document.getElementById('waOnlyModalBody').value;
  const label = (document.getElementById('waOnlyModalTitle').textContent || '').replace(/^WhatsApp\s*—\s*/, '') || phone;
  document.getElementById('waOnlyModalOverlay').style.display = 'none';
  const resolve = bcWaOnlyModalResolve; bcWaOnlyModalResolve = null;
  const sent = await bcConfirmWaSend(phone, message, null, { label });
  if (resolve) resolve(sent ? { sent: true } : { cancelled: true });
}

// Real ask 2026-09-13: "no manda atachment" — WhatsApp has no way to auto-attach a file to a
// wa.me link (a real platform limit, nothing any code can work around). A toast that fades in a
// couple seconds isn't enough — the trader clicked past it and reached an empty chat with no PDF.
// This stays on screen until they actually confirm, and only THEN opens wa.me (also keeps that
// window.open on a fresh click/user-gesture, so it isn't popup-blocked). One shared implementation
// so every page's WhatsApp button — inside this modal and any page's own share-and-open helper —
// gets the same real confirmation instead of each hand-rolling its own toast.
function bcEnsureWaAttachModal(){
  if (document.getElementById('bcWaAttachModalOverlay')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
<div id="bcWaAttachModalOverlay" class="email-modal-overlay" style="display:none;">
  <div class="email-modal-box" style="max-width:440px;text-align:center;">
    <div class="rq-wa-titlebar" style="justify-content:center;margin-bottom:10px;"><span class="rq-wa-logo">${BT_WA_SVG}</span><h3 style="color:#fff;margin:0;">PDF downloaded</h3></div>
    <div class="email-modal-from" id="bcWaAttachModalFilename" style="font-weight:700;color:#fff;"></div>
    <div class="email-modal-from" style="color:rgba(255,255,255,.75);line-height:1.5;">It was just downloaded to your computer. When WhatsApp opens, drag it into the chat (or attach it with the clip) before sending the message — WhatsApp doesn't allow attaching it automatically.</div>
    <div class="email-modal-actions" style="justify-content:center;">
      <button type="button" class="btn win" onclick="bcWaAttachModalContinue()">Got it, open WhatsApp</button>
    </div>
  </div>
</div>`;
  document.body.appendChild(wrap.firstElementChild);
}
let bcWaAttachPending = null;
function bcWaAttachModalContinue(){
  document.getElementById('bcWaAttachModalOverlay').style.display = 'none';
  const pending = bcWaAttachPending;
  bcWaAttachPending = null;
  if (pending) pending.go().then(pending.resolve);
}
// Call right after downloading the file (or with filename=null when there's nothing to attach —
// e.g. no phone on file already stopped it earlier, or the message alone has no document).
// WhatsApp never tells us whether the message went out (no API: wa.me only pre-fills the text), so nothing may be RECORDED as sent just because the window opened (user 2026-10-12:
// "si no abro el whatsapp para enviar no quiere decir que lo envie"). These resolve true only when the trader says "Yes, sent" after coming back; callers record on true only.
function bcWaAskSent(label){
  const q = `Did you send the WhatsApp to ${label || 'this contact'}?`;
  return typeof btConfirm === 'function' ? btConfirm(q, 'Yes, sent', 'Not sent') : Promise.resolve(window.confirm(q));
}
function bcWaWaitSent(label){
  return new Promise(resolve => {
    let left = false, done = false, timer = null;
    const finish = async () => {
      if (done) return; done = true; clearTimeout(timer);
      window.removeEventListener('blur', onBlur); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVis);
      resolve(!!(await bcWaAskSent(label)));
    };
    const onBlur = () => { left = true; };
    const onFocus = () => { if (left) finish(); };
    const onVis = () => { if (document.hidden) left = true; else if (left) finish(); };
    window.addEventListener('blur', onBlur); window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onVis);
    timer = setTimeout(finish, 10000); // a browser that never reports the page losing focus still gets the question
  });
}
function bcWaOpenAndConfirm(phone, message, label){
  window.open('https://wa.me/' + String(phone || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(message), '_blank');
  return bcWaWaitSent(label || phone);
}
// Returns a promise: true = the trader confirmed he sent it; false = he did not. opts.ask === false: nothing depends on it, no question (a follow-up after an email that already went).
function bcConfirmWaSend(phone, message, filename, opts){
  opts = opts || {};
  const label = opts.label || phone;
  const go = () => opts.ask === false ? (window.open('https://wa.me/' + String(phone).replace(/\D/g, '') + '?text=' + encodeURIComponent(message), '_blank'), Promise.resolve(true)) : bcWaOpenAndConfirm(phone, message, label);
  if (!filename) return go();
  bcEnsureWaAttachModal();
  return new Promise(resolve => {
    bcWaAttachPending = { phone, message, go, resolve };
    document.getElementById('bcWaAttachModalFilename').textContent = filename;
    document.getElementById('bcWaAttachModalOverlay').style.display = 'flex';
  });
}

// Real ask 2026-09-14: "que no quede con diseno nativo... ventanas blancas etc cambialo por
// diseno buentrade" — the browser's own native alert() (a plain white OS dialog, "localhost says")
// replaced everywhere with this same dark-glass modal every other popup in the app already uses.
// One shared implementation instead of ~100 individual call sites styling their own. Resolves once
// the trader clicks OK — every call site now does `await btAlert(...)` instead of `alert(...)`, so
// the code-after-the-alert still waits for it exactly like the native one did.
let btAlertResolveFn = null;
function bcEnsureAlertModal(){
  if (document.getElementById('btAlertOverlay')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
<div id="btAlertOverlay" class="email-modal-overlay" style="display:none;z-index:9000;">
  <div class="email-modal-box" style="max-width:420px;">
    <div id="btAlertMessage" style="font-size:13.5px;color:var(--ink);line-height:1.5;white-space:pre-wrap;"></div>
    <div class="email-modal-actions" style="justify-content:flex-end;margin-top:18px;">
      <button type="button" class="btn" onclick="btAlertResolve()">OK</button>
    </div>
  </div>
</div>`;
  document.body.appendChild(wrap.firstElementChild);
}
function btAlert(message){
  bcEnsureAlertModal();
  document.getElementById('btAlertMessage').textContent = message;
  document.getElementById('btAlertOverlay').style.display = 'flex';
  return new Promise(resolve => { btAlertResolveFn = resolve; });
}
function btAlertResolve(){
  document.getElementById('btAlertOverlay').style.display = 'none';
  if (btAlertResolveFn) btAlertResolveFn();
  btAlertResolveFn = null;
}

// Delete confirmation that can't be clicked through by accident (2026-09-29, user: "ese delete ahí
// está peligroso"): the trader types the exact name of what is being deleted. Resolves true/false.
let btTypedResolveFn = null;
function btConfirmTyped(message, expected){
  if (!document.getElementById('btTypedOverlay')){
    const wrap = document.createElement('div');
    wrap.innerHTML = `
<div id="btTypedOverlay" class="email-modal-overlay" style="display:none;z-index:9000;">
  <div class="email-modal-box" style="max-width:440px;">
    <div id="btTypedMessage" style="font-size:13.5px;color:var(--ink);line-height:1.5;white-space:pre-wrap;"></div>
    <input id="btTypedInput" type="text" autocomplete="off" oninput="document.getElementById('btTypedOk').disabled = this.value.trim().toLowerCase() !== (this.dataset.expected || '').trim().toLowerCase()" style="width:100%;box-sizing:border-box;margin-top:12px;padding:9px 12px;border-radius:8px;border:1.5px solid rgba(255,156,138,.5);background:rgba(255,255,255,.05);color:var(--ink);font-family:inherit;font-size:13.5px;">
    <div class="email-modal-actions" style="justify-content:flex-end;gap:10px;margin-top:18px;">
      <button class="btn secondary" onclick="btTypedResolve(false)">Cancel</button>
      <button class="btn danger" id="btTypedOk" disabled onclick="btTypedResolve(true)">Delete</button>
    </div>
  </div>
</div>`;
    document.body.appendChild(wrap.firstElementChild);
  }
  document.getElementById('btTypedMessage').textContent = message;
  const input = document.getElementById('btTypedInput');
  input.value = ''; input.dataset.expected = expected; input.placeholder = expected;
  document.getElementById('btTypedOk').disabled = true;
  document.getElementById('btTypedOverlay').style.display = 'flex';
  setTimeout(() => input.focus(), 50);
  return new Promise(resolve => { btTypedResolveFn = resolve; });
}
function btTypedResolve(ok){
  document.getElementById('btTypedOverlay').style.display = 'none';
  if (btTypedResolveFn) btTypedResolveFn(ok);
  btTypedResolveFn = null;
}

// opts: { fromAlias, to, subject, text, attachments, waInfo, cc, fromDisplay, title }
// The real send now happens inside bcOpenEmailModal itself (see the real ask quoted there) — this
// just unwraps its { cancelled | sent | failed } result into the same throw/return contract every
// caller already had: a cancelled-flagged Error on Cancel, a plain Error with the backend's message
// on a real send failure, or the backend's result object on success. No caller changes.
async function bcSendEmailApi(opts){
  opts = opts || {};
  const attachments = opts.attachments || [];
  // Same real feature orders.html's version already had: WhatsApp's own "download the file first"
  // step gets the email's first attachment automatically, contentType included, so the trader
  // never has to separately go find the PDF to drag into WhatsApp.
  const waInfoWithFile = (opts.waInfo && opts.waInfo.phone && attachments[0])
    ? { ...opts.waInfo, filename: attachments[0].filename, content: attachments[0].content, contentType: attachments[0].contentType }
    : opts.waInfo;

  const outcome = await bcOpenEmailModal({
    fromAlias: opts.fromAlias, to: opts.to, cc: opts.cc, subject: opts.subject, text: opts.text,
    attachments, fromDisplay: opts.fromDisplay, waInfo: waInfoWithFile, title: opts.title,
  });
  if (outcome.cancelled){
    const cancelErr = new Error('Cancelled by user');
    cancelErr.cancelled = true;
    throw cancelErr;
  }
  if (outcome.failed) throw new Error(outcome.error);
  return outcome.result;
}
