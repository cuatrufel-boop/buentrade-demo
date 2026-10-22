// Customers who buy in pesos (owner 2026-10-18). The price is still confirmed at the border, in USD, and sent to the border customers exactly as before.
// A customer whose profile Currency is MXN gets his offer in MX$/kg delivered to his city, and the system makes the trader confirm that price FIRST:
// the same QT version (US freight, docs, payment days… as confirmed at the border) opens with his city's Mexican freight (the carrier tariff, USD) and the
// Import Cost filled in, the trader confirms the pesos price, and only then is the message built. Nothing here edits the QT or the border price: the pesos QT
// is opened WITHOUT its plant × product / offer link, so it saves nothing anywhere (trading-tool ttStateOwner() = null).
// Used by quotes.html (the send functions, the message builders and the offer PDF).

const RQ_PESOS_IMPORT_COST_USD = 625; // Import Cost of a load that goes into Mexico — set by the owner (2026-10-18)
let rqMxnCurrencyId = null;
try { rqMxnCurrencyId = localStorage.getItem('bt_mxn_currency_id') || null; } catch (e) {} // last known, so a slow lookup never holds a send
// Each customer who buys in pesos has HIS OWN pesos QT per plant × product (owner 2026-10-22): his destination's Mexican freight makes his price different from every other pesos customer's.
// It is saved in the plant × product's qt_state under pesos[customer id] (trading-tool ttLoadPesosVersion) and NEVER in the USD version, which every USD customer shares. A pesos
// confirmation is valid only while the plant's price is the same AND the USD version it was built from is still the confirmed one; the USD QT is confirmed first.
const rqPesosSession = {}; // `plantId|productId|customerId` → the confirmed block of a pesos QT confirmed in this session (before the rows are read again)

async function rqLoadMxnCurrency(){
  try {
    const res = await callApi('lookups-search', {});
    const mxn = (res.currencies || []).find(x => x.code === 'MXN');
    if (mxn){ const changed = rqMxnCurrencyId !== mxn.id; rqMxnCurrencyId = mxn.id; try { localStorage.setItem('bt_mxn_currency_id', mxn.id); } catch (e) {} if (changed && typeof rqRenderSheet === 'function'){ try { rqRenderSheet(); } catch (e) { /* the page is still loading */ } } } // the Send panel groups by currency: draw it again once it is known
  } catch (e) { /* keeps the last known one, if any */ }
  return rqMxnCurrencyId;
}
function rqIsPesosCustomer(c){ return !!(rqMxnCurrencyId && c && c.preferred_currency_id === rqMxnCurrencyId); }

// The customer's city → his Mexican freight tariff (USD). Exact name first, then "starts with", then "contains"; the cheapest of the carriers that quote it.
// Mexican freight is in the currency of the carrier's own tariff (USD or MXN, as its profile says); the QT's field is MX$, so a USD tariff goes in at the QT's own rate
const rqPesosRateCur = (rate) => String((rate && rate.currency) || 'USD').toUpperCase() === 'MXN' ? 'MXN' : 'USD';
const rqPesosFreightMx = (amount, cur, fx) => cur === 'MXN' ? Math.round(amount * 100) / 100 : (fx > 0 ? Math.round(amount * fx * 100) / 100 : 0);
function rqPesosDestRate(c){
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const dest = norm(c && c.usual_destination);
  if (!dest) return null;
  const score = (r) => { const d = norm(r.destination), head = d.split(',')[0].trim(); return head === dest || d === dest ? 3 : (d.startsWith(dest) || dest.startsWith(head) ? 2 : (d.includes(dest) || dest.includes(head) ? 1 : 0)); };
  const found = rqMexicanFreightRates().filter(r => r.destination && Number(r.rate) > 0 && score(r) > 0);
  if (!found.length) return null;
  const best = Math.max(...found.map(score));
  return found.filter(r => score(r) === best).sort((a, b) => Number(a.rate) - Number(b.rate))[0];
}

// The line price a customer sees, in HIS currency: MX$/kg for a pesos customer, $/lb at the border for anyone else. Order and "cheapest in bold" follow it.
const rqLinePrice = (calc) => calc.mxn ? calc.mxn.perKg : calc.salePerLb;
const rqOfferPriceText = (calc) => calc.mxn
  ? `$${calc.mxn.perKg.toFixed(2)} MXN/kg — entregado en ${calc.mxn.dest}`
  : `$${calc.salePerLb.toFixed(4)} USD/lb frontera`;
const rqOfferTotalText = (calc) => calc.mxn
  ? `MX$${calc.mxn.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  : `$${calc.totalSale.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const rqAnyCustomer = (id) => (typeof rqMatchedCustomers !== 'undefined' && rqMatchedCustomers.find(x => x.id === id))
  || (typeof rqSheetState !== 'undefined' && (rqSheetState.customers || []).find(x => x.id === id))
  || (typeof rqLiveCtx !== 'undefined' && (rqLiveCtx.customers || []).find(x => x.id === id)) || null;
const rqPesosLink = (plantId, productId) => rqAllPlantProductRows.find(r => r.plant_id === plantId && r.product_id === productId) || null;
// The USD version a pesos version must have been built from: the USD price that is confirmed now (this session's QT, else the saved one) — as the exact text the QT stored when it was confirmed.
function rqUsdConfirmedJson(plantId, productId){
  const link = rqPesosLink(plantId, productId), plant = rqAllPlants.find(p => p.id === plantId);
  if (!link || !plant || link.current_price == null) return null;
  const pricing = rqBrandPricing(link, plant, productId);
  if (!pricing || pricing.proposed) return null; // not confirmed: nothing to build a pesos price on
  const saved = link.qt_state && link.qt_state.confirmed;
  return pricing.snapshot.rqConfirmedStateJson || (saved && saved.state_json) || null;
}
// The pesos confirmation of ONE customer for one plant × product, or null: confirmed in his own QT, for this plant price, built from the USD version that is confirmed now, with
// the tariff of HIS city. Anything else is not his price.
function rqPesosConfirmation(plantId, productId, customerId){
  const c = rqAnyCustomer(customerId), link = rqPesosLink(plantId, productId);
  if (!rqIsPesosCustomer(c) || !link || link.current_price == null) return null;
  const rate = rqPesosDestRate(c), usdJson = rqUsdConfirmedJson(plantId, productId);
  if (!rate || !usdJson) return null;
  const saved = link.qt_state && link.qt_state.pesos && link.qt_state.pesos[customerId];
  const cands = [rqPesosSession[plantId + '|' + productId + '|' + customerId], saved && saved.confirmed].filter(Boolean).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const conf = cands[0];
  if (!conf || !conf.calc || !conf.calc.pesosQt || conf.built_from !== usdJson) return null;
  if (Number(conf.price) !== Number(link.current_price) || String(conf.price_date || '').slice(0, 10) !== String(link.price_date || '').slice(0, 10)) return null;
  if (conf.calc.pesosQt.rateId !== rate.id) return null;
  return conf;
}
// An offer entry ({plant, calc}) for this customer. A border customer's is returned untouched (same object). A pesos customer gets ONLY his own pesos confirmation — its numbers, its
// version, its price in MX$/kg — and a plant he has not confirmed in his own QT gives null: a pesos customer is never sent a border price.
function rqWithPesos(customerId, it){
  const c = rqAnyCustomer(customerId);
  if (!rqIsPesosCustomer(c)) return it;
  const conf = rqPesosConfirmation(it.plant.id, it.plant.rqProductId, customerId);
  if (!conf) return null;
  const q = conf.calc.pesosQt;
  let state = null; try { state = JSON.parse(conf.state_json); } catch (e) { /* the numbers stay; the offer just carries no version */ }
  return { ...it, plant: { ...it.plant, rqLastState: state, rqUsFreightRateId: conf.us_freight_rate_id || null }, calc: { ...conf.calc, mxn: { perKg: q.perKg, total: q.total, dest: q.dest, fx: q.fx } } };
}

// The send never goes to a pesos customer without HIS pesos price: his lines are the plants he has confirmed in his own QT (rqWithPesos); none → nothing is sent to him and the trader is told.
// Returns the customer's fresh offer entries, or null when there is nothing to send him.
async function rqRequirePesos(c, productId, filterPlantIds){
  if (!rqMxnCurrencyId && !(await rqLoadMxnCurrency())){ rqShowNotice("Could not check the customers' currency — try again in a moment."); return null; }
  const full = rqCustomerOfferPlantsFor(c.id, [productId], filterPlantIds);
  if (rqIsPesosCustomer(c) && !full.length){ rqShowNotice(`${c.trade_name} buys in pesos — confirm his price in his own QT first (Confirm in QT).`); return null; }
  return full;
}

// The offer PDF of a pesos customer carries his pesos price (the shared one is the border's).
async function rqPesosFiles(full){
  const attachments = [], downloadFiles = [];
  for (const { plant, calc } of full){
    const files = rqFindProductFilesFor(plant);
    if (!files.photo_url && !files.spec_url) continue;
    try {
      const built = await rqBuildCombinedPdf(plant, calc);
      attachments.push({ filename: built.filename, content: rqBytesToBase64(built.bytes) });
      downloadFiles.push(built);
    } catch (e) { /* one plant's PDF failing never blocks the offer */ }
  }
  return { attachments, downloadFiles };
}

// ---- The send panel's pesos side: which plants a pesos customer still has to confirm in his own QT, and opening it plant by plant.
// The plants of the product that can be sent (a live price, its USD price confirmed): where HE stands for each one.
function rqPesosPlantStates(rows, customerId){
  return rows.filter(r => r.kind === 'priced' && !r.stale && !r.na).map(r => ({
    row: r, state: !(r.calc && r.confirmed && !r.proposed) ? 'needs_usd' : (rqPesosConfirmation(r.plant.id, r.pid, customerId) ? 'ready' : 'needs_qt'),
  }));
}
async function rqPesosOpenQt(productId, plantId, customerId){
  const c = rqAnyCustomer(customerId), plant = rqAllPlants.find(p => p.id === plantId);
  if (!c || !plant) return;
  if (!rqPesosDestRate(c)){ btAlert(`There is no Mexican freight tariff for ${c.usual_destination || "this customer's city"} — add it in the carrier's profile (Rates → Mexican Freight) before quoting ${c.trade_name} in pesos.`); return; }
  if (!rqUsdConfirmedJson(plantId, productId)){ rqShowNotice(`Confirm ${String(plant.name).trim()}'s USD price first — ${c.trade_name}'s QT starts from it.`); return; }
  await qOpenPendingPlantInline(productId, plantId, customerId);
}
// The customer's row in the send panel: opens the first plant he has not confirmed in his own QT (else the first one, to look at it again).
async function rqPesosOpenFirst(customerId){
  const pid = rqActiveProductFilterIds[0], c = rqAnyCustomer(customerId);
  if (!pid || !c) return;
  if (!rqMxnCurrencyId && !(await rqLoadMxnCurrency())){ rqShowNotice("Could not check the customers' currency — try again in a moment."); return; }
  const states = rqPesosPlantStates(rqSheetRows(), customerId).filter(x => x.row.pid === pid);
  const target = states.find(x => x.state === 'needs_qt') || states.find(x => x.state === 'ready');
  if (!target){ rqShowNotice(`Confirm the USD price of the plants first — ${c.trade_name}'s QT starts from it.`); return; }
  await rqPesosOpenQt(pid, target.row.plant.id, customerId);
}
// After a pesos QT is confirmed: the next plant of the same customer, until all of his are green. A QT that closed without a valid pesos price stops the chain and says why.
async function rqPesosAfterConfirm(customerId, productId, plantId){
  if (!rqPesosConfirmation(plantId, productId, customerId)){ rqShowNotice("The pesos price was not saved — wait for today's exchange rate and the Mexico costs to fill in, then confirm again."); return; }
  const next = rqPesosPlantStates(rqSheetRows(), customerId).find(x => x.state === 'needs_qt' && x.row.pid === productId);
  if (next) await rqPesosOpenQt(productId, next.row.plant.id, customerId);
}

// ---- The pesos numbers INSIDE the plant's own QT (owner 2026-10-18: "poder ver números en el QT y confirmar como siempre").
// When a customer who buys in pesos buys this product (the one marked in the send panel first), the QT opens with his city's Mexican freight (the carrier tariff in USD,
// shown in the QT's own MX$ field at the QT's own rate) and Import Cost 625 filled in, so the QT's Mexico panel shows the pesos numbers next to the border ones. The trader
// confirms as always; the pesos price he saw is saved with that confirmation (calc.pesosQt) and the send uses it. A product no pesos customer buys is opened exactly as before.
// The pesos QT is opened ON PURPOSE for one customer (p.rqPesosFor, from his row in the send panel); every other QT is the dollar QT, whoever is marked (owner 2026-10-22).
function rqPesosCustomerFor(p){
  const c = p && p.rqPesosFor ? rqAnyCustomer(p.rqPesosFor) : null;
  return c && rqIsPesosCustomer(c) && rqPesosDestRate(c) ? c : null;
}
// the QT's address: his id, Import Cost shown and filled, Mexican freight filled (USD tariff × the rate Quotes already has)
function rqPesosToolParams(p, params){
  const c = rqPesosCustomerFor(p);
  if (!c) { p.rqPesosCtx = null; return; }
  const rate = rqPesosDestRate(c);
  p.rqPesosCtx = { customerId: c.id, rateId: rate.id, usd: Number(rate.rate), cur: rqPesosRateCur(rate), dest: (c.usual_destination || rate.destination || '').trim() };
  params.set('pesosCustomerId', c.id); params.set('pesosRateId', String(rate.id));
  params.set('hideImportCost', '0'); params.set('importCost', String(RQ_PESOS_IMPORT_COST_USD)); params.set('hideMexicanFreight', '0');
  const f0 = rqPesosFreightMx(p.rqPesosCtx.usd, p.rqPesosCtx.cur, typeof rqCachedFxRate === 'number' ? rqCachedFxRate : 0);
  if (f0 > 0) params.set('freightMx', String(f0));
}
// keeps Mexican freight exact against the QT's own (rounded-up) rate while the QT is open; never overwrites a number the trader typed
// The Profitability of the pesos QT is the DESTINATION profit, in dollars (owner 2026-10-18: "si le muevo números no me cambia el profit… ese profit no es border sino destino"):
// the QT's own Mexico outputs (what the Selling MXN/kg, Mexican freight, import… produce) divided by the day's rate, shown in the dollar column. Display only — the QT's formulas
// are not touched and its Border numbers are still computed; they are just not what this view shows.
const RQ_PESOS_MIRROR = [ // [dollar-column output, Mexico output it shows, how]
  ['outProfit', 'outProfitMx', 'usd'], ['outProdCost', 'outProdCostMx', 'usd'], ['outProfitLb', 'outProfitKgMx', 'usd'], ['outMarkup', 'outMarkupMx', 'usd'],
  ['outSellTotal', 'outSellTotalMx', 'usd'], ['outProdProfit', 'outProdProfitMx', 'usd'], ['outDirect', 'outDirectMx', 'usd'], ['outAdditional', 'outAdditionalMx', 'usd'],
  ['financeOutTop', 'financeOutTopMx', 'usd'], ['outNetMargin', 'outNetMarginMx', 'text'], ['outGrossMargin', 'outGrossMarginMx', 'text'], ['outMarkupPct', 'outMarkupPctMx', 'text'],
  ['outWeight', 'outWeightMx', 'text'],
];
function rqPesosMirror(win){
  if (win.__rqPesosOff) return; // the generic tool's switch is on USD
  const d = win.document, el = (id) => d.getElementById(id);
  const fx = parseFloat((el('fxRate') || {}).value) || 0;
  if (!(fx > 0)) return;
  const fmt = (v) => (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  RQ_PESOS_MIRROR.forEach(([to, from, how]) => {
    const a = el(to), b = el(from);
    if (!a || !b || !String(b.textContent).trim()) return;
    if (how === 'usd'){ const n = parseFloat(String(b.textContent).replace(/[^0-9.\-]/g, '')); if (isNaN(n)) return; a.textContent = fmt(n / fx); }
    else a.textContent = b.textContent;
    if (/k-val/.test(b.className)) a.className = b.className; // keeps its red / amber state
  });
  // The Factoring card follows the destination too (sale, cost and direct costs of the destination in dollars, the card's own fee percentages) and so does the "Profit (Summar)"
  // shown right under the direct profit (the QT itself puts both there).
  const num = (id) => { const e = el(id); return e ? parseFloat(String(e.textContent).replace(/[^0-9.\-]/g, '')) : NaN; };
  const sale = num('outSellTotalMx') / fx, cost = num('outProdCostMx') / fx, direct = num('outDirectMx') / fx;
  const pct = num('summarFeeTransit') + num('summarFeeBase') + num('summarFeeExtra');
  if ([sale, cost, direct, pct].every((n) => !isNaN(n))){
    const gross = sale - cost - direct, fee = sale * pct / 100, after = gross - fee;
    const put = (id, v) => { const e = el(id); if (e) e.textContent = fmt(v); };
    put('summarProfitBefore', gross); put('summarSOValue', sale); put('summarFeeAmount', fee); put('summarProfitAfter', after);
    const sa = el('summarProfitAfter'); if (sa) sa.className = 'k-val' + (after < 0 ? ' neg' : '');
    const h = el('summarHeroVal'); if (h){ h.textContent = fmt(after); h.className = 'k-val' + (after < 0 ? ' neg' : ''); } // the hero under the direct profit (it lives in the QT)
  }
  const lab = (id, text) => { const e = el(id); const l = e && e.previousElementSibling; if (l && l.textContent !== text) l.textContent = text; };
  lab('outProfitLb', 'Profit / Kg');
  const sec = d.querySelector('.profit-col .section-label'); if (sec && sec.textContent !== 'Destination (USD)') sec.textContent = 'Destination (USD)';
}
function rqPesosWatch(win){
  if (win.__rqPesosWatch) return;
  win.__rqPesosWatch = true;
  const run = () => { try { rqPesosMirror(win); } catch (e) { /* the QT is still loading */ } };
  const obs = new win.MutationObserver(run); // watches only the Mexico outputs, which the mirror never writes: no loop
  RQ_PESOS_MIRROR.forEach(([, from]) => { const b = win.document.getElementById(from); if (b) obs.observe(b, { childList: true, characterData: true, subtree: true }); });
  run();
}

// The pesos QT (owner 2026-10-18): the exchange rate comes from the web (the QT's own), Weight in kilos, Purchase price in dollars, Selling price in pesos (Selling MXN/kg =
// Selling $/lb (adj.) × 2.20462 × the rate — the QT's own Mexico formula), US freight, Inspection and Import Cost in dollars, Mexican freight in the currency of the carrier's own
// tariff (USD or MXN). Profitability stays in dollars. View only, no formula touched.
const RQ_PESOS_VIEW_CSS = '#mxProfitBlock, #profitColDivider, .qb-item.qb-out:has(#financeOutTopMx), .prod-row > .prod-top + .section-label, .prod-row > .divider, .prod-row > .prod-grid .mini:has(#prodWeight0), .prod-row > .prod-grid .mini:has(#prodSellBorder0) { display: none !important; } .prod-row > .prod-grid { grid-template-columns: minmax(0, 1fr) !important; justify-items: center; } .prod-row > .prod-grid .mini { width: 60%; } .prod-row > .prod-grid { margin-bottom: 12px; }';
function rqPesosApplyView(win, amount, cur){
  const doc = win.document;
  win.__rqPesosOff = false;
  if (!doc.getElementById('rq_pesos_only_css')){ const st = doc.createElement('style'); st.id = 'rq_pesos_only_css'; st.textContent = RQ_PESOS_VIEW_CSS; doc.head.appendChild(st); }
  // top bar balanced around Confirm Price: Terms on one side, Exchange Rate + Finance Cost on the other (with the Mexico chip out of sight the left side was twice as long)
  const fxWrap = doc.getElementById('qbMxFxWrap'), rightCell = doc.querySelector('#qbBar > div[style*="grid-column:3"]');
  if (fxWrap && rightCell && fxWrap.parentNode !== rightCell) rightCell.insertBefore(fxWrap, rightCell.firstChild);
  rqPesosWatch(win); // the Profitability follows the destination numbers (see rqPesosMirror)
  const anchor = doc.getElementById('mexicanFreightField'), hint = doc.getElementById('freightMxUsdHint');
  let box = doc.getElementById('pt_freight_usd');
  if (cur === 'MXN'){ // the carrier quotes in pesos: the QT's own MX$ field stays
    if (box) box.remove();
    if (anchor) anchor.style.removeProperty('display');
    return;
  }
  if (!box && anchor){
    box = doc.createElement('div'); box.className = 'field'; box.id = 'pt_freight_usd';
    box.innerHTML = '<label>Mexican Freight (USD)</label><div class="inputwrap"><span class="pfx">$</span><input type="text" id="pt_freight_usd_val" disabled style="text-align:right;"></div>';
    anchor.parentNode.insertBefore(box, anchor);
  }
  if (anchor) anchor.style.setProperty('display', 'none', 'important');
  if (hint) hint.style.setProperty('display', 'none', 'important');
  const v = doc.getElementById('pt_freight_usd_val');
  if (v && amount > 0) v.value = Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function rqPesosFillQt(id){
  const p = rqSelectedPlants.find(x => x.id === id);
  if (!p) return;
  clearInterval(p.rqPesosTimer);
  p.rqPesosImportDone = false;
  if (!p.rqPesosCtx) return;
  let lastSet = null, ticks = 0;
  p.rqPesosTimer = setInterval(() => {
    if (!p.rqCalculatorOpen || !p.rqPesosCtx){ clearInterval(p.rqPesosTimer); return; }
    const fr = document.getElementById('rq_iframe_' + id); let win; try { win = fr && fr.contentWindow; } catch (e) { return; }
    if (!win || !win.__calc || !win.document) return;
    ticks++;
    rqPesosApplyView(win, p.rqPesosCtx.usd, p.rqPesosCtx.cur); // the pesos look is there from the first moment
    if (ticks < 8 && !(win.ttIsSettled && win.ttIsSettled())) return; // the costs wait until the QT has read its own saved version (it can bring a 0 over the address)
    const el = win.document.getElementById('freightMx'), imp = win.document.getElementById('importCost'), fx = parseFloat((win.document.getElementById('fxRate') || {}).value) || 0;
    // Import Cost: the QT's saved version can bring its own 0/blank over the address — fill 625 once, then it is the trader's
    if (imp && !p.rqPesosImportDone && (parseFloat(imp.value) || 0) === 0){ imp.value = RQ_PESOS_IMPORT_COST_USD; win.buildProductRows(); win.calc(); rqPrefillSellingPrice(id); }
    if (imp) p.rqPesosImportDone = true;
    if (!el || !(fx > 0)) return;
    const want = rqPesosFreightMx(p.rqPesosCtx.usd, p.rqPesosCtx.cur, fx).toFixed(2), cur = parseFloat(el.value) || 0;
    // only touch the field while it still holds nothing, or what we put there (the trader's own number stays)
    if (Math.abs(cur - parseFloat(want)) > 0.005 && (cur === 0 || (lastSet !== null && Math.abs(cur - lastSet) < 0.005))){
      el.value = want; lastSet = parseFloat(want); win.buildProductRows(); win.calc(); rqPrefillSellingPrice(id);
    }
  }, 700);
}
// what the QT shows in pesos right now, to be saved with the confirmation
function rqPesosCaptureCalc(p, win){
  const k = win && win.__calc;
  if (!p.rqLastCalc) return;
  delete p.rqLastCalc.pesosQt;
  if (!p.rqPesosCtx || !k || !k.inp || !(k.totalSaleMx > 0) || !(k.inp.fxRate > 0) || !(k.totalWeightKg > 0) || !k.inp.importCostFilled || !k.inp.freightMxFilled) return;
  p.rqLastCalc.pesosQt = { perKg: k.totalSaleMx / k.totalWeightKg, total: k.totalSaleMx, fx: k.inp.fxRate, dest: p.rqPesosCtx.dest, rateId: p.rqPesosCtx.rateId, freightAmount: p.rqPesosCtx.usd, freightCurrency: p.rqPesosCtx.cur, importCost: k.inp.importCost };
}

// ---- The generic Quoting Tool (Quotes tab): ONE switch, USD | MXN, to quote without sending anywhere (owner 2026-10-18). USD is the QT exactly as it is; MXN is the same pesos view
// a pesos customer gets (kilos, Selling MXN/kg, Import Cost 625, destination profit) with the Mexican freight typed in USD. Turning it back to USD restores the dollar QT's own numbers.
function rqPesosRemoveView(win){
  const d = win.document;
  win.__rqPesosOff = true;
  const st = d.getElementById('rq_pesos_only_css'); if (st) st.remove();
  const box = d.getElementById('pt_freight_usd'); if (box) box.remove();
  const anchor = d.getElementById('mexicanFreightField'), hint = d.getElementById('freightMxUsdHint');
  if (anchor) anchor.style.setProperty('display', 'none'); // a dollar quote has no Mexican freight box
  if (hint) hint.style.removeProperty('display');
  const fxWrap = d.getElementById('qbMxFxWrap'), leftCell = d.querySelector('#qbBar > div[style*="grid-column:1"]');
  if (fxWrap && leftCell && fxWrap.parentNode !== leftCell) leftCell.appendChild(fxWrap);
  const sec = d.querySelector('.profit-col .section-label'); if (sec) sec.textContent = 'Border (USD)';
  const lb = d.getElementById('outProfitLb'); if (lb && lb.previousElementSibling) lb.previousElementSibling.textContent = 'Profit / Lb';
}
function rqGenericQtSwitch(frame){
  let tries = 0;
  const wait = setInterval(() => {
    let win; try { win = frame.contentWindow; } catch (e) { return; }
    if (++tries > 80){ clearInterval(wait); return; }
    if (!win || !win.__calc || !win.document.getElementById('qbBar') || !win.document.querySelector('#qbBar > div[style*="grid-column:3"]')) return;
    clearInterval(wait);
    const d = win.document, el = (id) => d.getElementById(id);
    if (el('pt_switch')) return;
    const g = d.createElement('div'); g.className = 'qb-group'; g.id = 'pt_switch';
    // BuenTrade look: a dark glass track like the bar's fields (27px high, 92px wide, 1px white-22% border, 8px radius) with a sliding thumb in the same blue gradient as the "+" button
    // (var(--blue) → #3E7BC4, its blue glow), white IBM Plex Mono 12px bold text centred in each half; the unchosen half is quiet white
    g.innerHTML = '<div class="qb-group-label">Quote in</div><div class="qb-group-row"><div class="qb-item"><label style="visibility:hidden;">Quote</label><div id="pt_sw" role="switch" aria-checked="false" aria-label="Quote in USD or MXN" tabindex="0" style="position:relative;display:flex;box-sizing:border-box;width:92px;height:28px;padding:2px;border:1px solid rgba(255,255,255,.22);border-radius:8px;background:rgba(255,255,255,.035);cursor:pointer;user-select:none;font-family:\'IBM Plex Mono\',monospace;font-size:12px;font-weight:700;line-height:1;"><span id="pt_sw_thumb" style="position:absolute;top:2px;bottom:2px;left:2px;width:calc(50% - 2px);border-radius:6px;background:linear-gradient(135deg,var(--blue) 0%,#3E7BC4 100%);box-shadow:0 2px 7px rgba(30,106,219,.35);transition:transform .18s ease;"></span><span id="pt_sw_usd" style="position:relative;flex:1;display:flex;align-items:center;justify-content:center;transition:color .18s;">USD</span><span id="pt_sw_mxn" style="position:relative;flex:1;display:flex;align-items:center;justify-content:center;transition:color .18s;">MXN</span></div></div></div>';
    d.querySelector('#qbBar > div[style*="grid-column:3"]').insertBefore(g, d.querySelector('#qbBar > div[style*="grid-column:3"]').firstChild);
    let on = false, autoImport = false, timer = null;
    const paint = () => { const a = el('pt_sw_usd'), b = el('pt_sw_mxn'), sw = el('pt_sw'); sw.setAttribute('aria-checked', on ? 'true' : 'false');
      el('pt_sw_thumb').style.transform = on ? 'translateX(100%)' : 'translateX(0)';
      a.style.color = on ? 'rgba(255,255,255,.55)' : '#fff'; b.style.color = on ? '#fff' : 'rgba(255,255,255,.55)'; };
    const pushFreight = () => { // the freight typed in USD goes into the QT's own MX$ field at the QT's own rate ('0' counts as filled: the pesos panel shows from the first moment)
      const fx = parseFloat(el('fxRate').value) || 0, v = el('pt_freight_usd_val'); if (!v) return;
      const amt = parseFloat(String(v.value).replace(/,/g, '')) || 0, want = fx > 0 ? rqPesosFreightMx(amt, 'USD', fx) : 0, cur = parseFloat(el('freightMx').value);
      if (el('freightMx').value === '' || Math.abs((isNaN(cur) ? -1 : cur) - want) > 0.005){ el('freightMx').value = want.toFixed(2); win.buildProductRows(); win.calc(); } };
    // Import Cost 625 goes in once there is a purchase price (an empty quote has nothing to import: with 625 and no product the only number left is the finance on that 625, a small loss);
    // before that it is 0, which keeps the pesos panel on. A number the trader typed himself is never touched.
    const syncImport = () => { if (!autoImport) return;
      const imp = el('importCost'), cur = parseFloat(imp.value) || 0, want = (parseFloat(el('prodCost0').value) || 0) > 0 ? RQ_PESOS_IMPORT_COST_USD : 0;
      if (cur === want && imp.value !== '') return;
      if (imp.value === '' || cur === 0 || cur === RQ_PESOS_IMPORT_COST_USD){ imp.value = want; win.buildProductRows(); win.calc(); } else autoImport = false; };
    const apply = () => {
      if (on){
        rqPesosApplyView(win, 0, 'USD');
        const v = el('pt_freight_usd_val'); v.disabled = false; v.placeholder = '0';
        if (!v.__wired){ v.__wired = true; v.addEventListener('input', () => { el('freightMx').value = ''; pushFreight(); }); }
        autoImport = !(parseFloat(el('importCost').value) > 0); syncImport();
        el('freightMx').value = ''; pushFreight();
        clearInterval(timer); timer = setInterval(() => { if (on){ syncImport(); pushFreight(); } }, 700); // follows the day's rate
      } else {
        clearInterval(timer);
        rqPesosRemoveView(win);
        if (autoImport){ el('importCost').value = ''; autoImport = false; }
        el('freightMx').value = '';
        win.buildProductRows(); win.calc();
      }
      paint();
    };
    el('pt_sw').addEventListener('click', () => { on = !on; apply(); });
    el('pt_sw').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); on = !on; apply(); } });
    paint();
  }, 300);
}

setTimeout(() => { rqLoadMxnCurrency(); }, 1500); // learned in the background as soon as the page is up
