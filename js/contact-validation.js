// Shared email/phone validation for every data-entry form that saves a contact (Customers,
// Plants, Carriers/Providers, plant delivery Locations) — one real implementation instead of
// four separate copies that could drift out of sync, the same class of bug that let three
// different files carry three different (two of them wrong) copies of the email signature.
//
// Deliberately permissive on format beyond "this could plausibly be real" — this only blocks
// obviously-wrong input (missing @, no digits, empty), never tries to fully validate that an
// address/number is truly deliverable (an actual send attempt is the only real proof of that).

const BC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function bcIsValidEmail(email){
  return BC_EMAIL_RE.test((email || '').trim());
}

// Comma/semicolon-separated CC lists — every non-empty entry must be a real email; a trailing or
// doubled separator (empty entry) is ignored rather than rejected.
function bcIsValidEmailList(list){
  const entries = (list || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
  return entries.every(bcIsValidEmail);
}

// Phone/WhatsApp numbers in these forms are always a fixed dial code (the closed DIAL_CODES
// dropdown) + a free-typed national number — this validates the national-number half only:
// digits after stripping spaces/dashes/parens, 7-12 digits (covers every DIAL_CODES entry's
// real national-number length, from Central American 8-digit numbers to 10-digit US/MX ones).
function bcIsValidPhoneDigits(number){
  const digits = (number || '').replace(/[\s\-().]/g, '');
  return /^\d{7,12}$/.test(digits);
}

// For the few fields still plain free-text "+countrycode number" (no dial-code dropdown next to
// them) — requires the leading + and a sane total digit count (E.164 allows up to 15).
function bcIsValidFullPhone(full){
  const trimmed = (full || '').trim();
  if (!trimmed.startsWith('+')) return false;
  const digits = trimmed.slice(1).replace(/[\s\-().]/g, '');
  return /^\d{8,15}$/.test(digits);
}

// ---------------------------------------------------------------------------------------------
// Phone numbers the way people really type or paste them (user 2026-10-13: a Mexican number was
// "not recognized" when saving a new customer). The form splits a number into a country-code
// dropdown + digits; people paste "+52 662 123 4567", "52 1 662…", "044 662…" or just "6621234567"
// with the dropdown left blank. One normalizer fixes what is unambiguous and says plainly what is
// not — it never invents digits.
//   • "+" or "00" in front: the country code is read from the typed number and moved to the dropdown.
//   • Mexico (+52): old dial prefixes (044 / 045 / 01), a typed 52 / 521 country prefix and the old
//     mobile "1" are dropped; the national number is always exactly 10 digits.
//   • any other country: only spaces / dashes / dots / parentheses are removed (length is checked by
//     bcIsValidPhoneDigits as before).
function bcNormalizePhone(code, typed, dialCodes, defaultCode){
  let raw = String(typed || '').trim();
  if (!raw) return { code: code || defaultCode, number: '' };
  const codes = [...new Set(dialCodes || [])].sort((a, b) => b.length - a.length);
  let c = code || '', digits;
  if (/^(\+|00)/.test(raw)){
    const d = raw.replace(/^(\+|00)/, '').replace(/\D/g, '');
    const hit = codes.find(x => d.startsWith(x.slice(1)));
    if (hit){ c = hit; digits = d.slice(hit.length - 1); } else digits = d;
  } else digits = raw.replace(/\D/g, '');
  if (!c) c = defaultCode || '';
  if (c === '+52'){
    digits = digits.replace(/^(044|045|01)(?=\d{10}$)/, '');
    if (digits.length === 13 && digits.startsWith('521')) digits = digits.slice(3);
    else if (digits.length === 12 && digits.startsWith('52')) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
    if (digits.length !== 10) return { error: 'Mexican numbers have 10 digits (for example 662 123 4567) — check for a missing or extra digit.' };
  }
  return { code: c, number: digits };
}

// For the code-dropdown + number pair of a form: fixes both fields in place; returns '' or the message to show.
function bcFixPhoneInputs(codeId, numberId, defaultCode){
  const codeEl = document.getElementById(codeId), numEl = document.getElementById(numberId);
  if (!numEl || !numEl.value.trim()) return '';
  const r = bcNormalizePhone(codeEl.value, numEl.value, [...codeEl.options].map(o => o.value), defaultCode);
  if (r.error) return r.error;
  if (![...codeEl.options].some(o => o.value === r.code)) return 'That country code is not in the list — pick it from the dropdown next to the number.';
  codeEl.value = r.code; numEl.value = r.number;
  return '';
}

// For a single free-text "+country number" field (no dropdown): fixes it in place to "+52 6621234567"; returns '' or the message.
function bcFixFullPhoneInput(inputId, defaultCode, dialCodes){
  const el = document.getElementById(inputId);
  if (!el || !el.value.trim()) return '';
  const r = bcNormalizePhone('', el.value, dialCodes, defaultCode);
  if (r.error) return r.error;
  el.value = `${r.code} ${r.number}`;
  return '';
}
