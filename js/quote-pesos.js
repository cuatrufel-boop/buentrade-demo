// Customers who buy in pesos (owner 2026-10-18). The price is still confirmed at the border, in USD, and sent to the border customers exactly as before.
// A customer whose profile Currency is COP gets his offer in MX$/kg delivered to his city, and the system makes the trader confirm that price FIRST:
// the same QT version (US freight, docs, payment days… as confirmed at the border) opens with his city's Colombian freight (the carrier tariff, USD) and the
// Import Cost filled in, the trader confirms the pesos price, and only then is the message built. Nothing here edits the QT or the border price: the pesos QT
// is opened WITHOUT its plant × product / offer link, so it saves nothing anywhere (trading-tool ttStateOwner() = null).
// Used by quotes.html (the send functions, the message builders and the offer PDF).

const RQ_PESOS_IMPORT_COST_USD = 625; // Import Cost of a load that goes into Colombia — set by the owner (2026-10-18)
let rqMxnCurrencyId = null;
try { rqMxnCurrencyId = localStorage.getItem('bt_mxn_currency_id') || null; } catch (e) {} // last known, so a slow lookup never holds a send
const rqPesosConfirmed = {}; // `plantId|productId|customerId` → what was confirmed in pesos

async function rqLoadMxnCurrency(){
  try {
    const res = await callApi('lookups-search', {});
    const mxn = (res.currencies || []).find(x => x.code === 'COP');
    if (mxn){ rqMxnCurrencyId = mxn.id; try { localStorage.setItem('bt_mxn_currency_id', mxn.id); } catch (e) {} }
  } catch (e) { /* keeps the last known one, if any */ }
  return rqMxnCurrencyId;
}
function rqIsPesosCustomer(c){ return !!(rqMxnCurrencyId && c && c.preferred_currency_id === rqMxnCurrencyId); }

// The customer's city → his Colombian freight tariff (USD). Exact name first, then "starts with", then "contains"; the cheapest of the carriers that quote it.
// Colombian freight is in the currency of the carrier's own tariff (USD or COP, as its profile says); the QT's field is MX$, so a USD tariff goes in at the QT's own rate
const rqPesosRateCur = (rate) => String((rate && rate.currency) || 'USD').toUpperCase() === 'COP' ? 'COP' : 'USD';
const rqPesosFreightMx = (amount, cur, fx) => cur === 'COP' ? Math.round(amount * 100) / 100 : (fx > 0 ? Math.round(amount * fx * 100) / 100 : 0);
function rqPesosDestRate(c){
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const dest = norm(c && c.usual_destination);
  if (!dest) return null;
  const score = (r) => { const d = norm(r.destination), head = d.split(',')[0].trim(); return head === dest || d === dest ? 3 : (d.startsWith(dest) || dest.startsWith(head) ? 2 : (d.includes(dest) || dest.includes(head) ? 1 : 0)); };
  const found = rqColombianFreightRates().filter(r => r.destination && Number(r.rate) > 0 && score(r) > 0);
  if (!found.length) return null;
  const best = Math.max(...found.map(score));
  return found.filter(r => score(r) === best).sort((a, b) => Number(a.rate) - Number(b.rate))[0];
}

// An offer entry ({plant, calc}) for this customer: a pesos customer's carries the confirmed pesos price while it is still valid for the same border
// price and plant price; anyone else's is returned untouched (same object).
function rqWithPesos(customerId, it){
  const c = rqMatchedCustomers.find(x => x.id === customerId);
  if (!rqIsPesosCustomer(c)) return it;
  // the pesos price the trader saw and confirmed inside the plant's own QT (calc.pesosQt), when it is for this customer's city
  const q = it.calc.pesosQt, rate = q ? rqPesosDestRate(c) : null;
  if (q && rate && q.rateId === rate.id) return { ...it, calc: { ...it.calc, mxn: { perKg: q.perKg, total: q.total, dest: q.dest, fx: q.fx } } };
  const m = rqPesosConfirmed[it.plant.id + '|' + it.plant.rqProductId + '|' + customerId];
  if (!m || m.borderSale !== it.calc.salePerLb || m.cost !== it.calc.costPerLb) return it;
  return { ...it, calc: { ...it.calc, mxn: { perKg: m.perKg, total: m.total, dest: m.dest, fx: m.fx } } };
}
const rqOfferPriceText = (calc) => calc.mxn
  ? `$${calc.mxn.perKg.toFixed(2)} COP/kg — entregado en ${calc.mxn.dest}`
  : `$${calc.salePerLb.toFixed(4)} USD/lb frontera`;
const rqOfferTotalText = (calc) => calc.mxn
  ? `MX$${calc.mxn.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  : `$${calc.totalSale.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

// The send is refused until every plant of a pesos customer's message has its pesos price confirmed (the pesos QT opens right there for each one).
// Returns the customer's fresh offer entries, or null when the trader did not confirm (nothing is sent).
async function rqRequirePesos(c, productId, filterPlantIds){
  if (!rqMxnCurrencyId && !(await rqLoadMxnCurrency())){ rqShowNotice("Could not check the customers' currency — try again in a moment."); return null; }
  let full = rqCustomerOfferPlantsFor(c.id, [productId], filterPlantIds);
  if (!rqIsPesosCustomer(c)) return full;
  for (const it of full){
    if (it.calc.mxn) continue;
    rqShowNotice(`${c.trade_name} buys in pesos — confirm ${it.plant.name} in pesos first.`);
    if (!(await rqConfirmInPesos(it.plant, productId, c, it.calc))) return null;
  }
  return rqCustomerOfferPlantsFor(c.id, [productId], filterPlantIds);
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

function rqConfirmInPesos(plant, productId, c, borderCalc){
  return new Promise((resolve) => {
    const rate = rqPesosDestRate(c);
    if (!rate){ btAlert(`There is no Colombian freight tariff for ${c.usual_destination || 'this customer\'s city'} — add it in the carrier's profile (Rates → Colombian Freight) before quoting ${c.trade_name} in pesos.`); resolve(false); return; }
    const link = rqAllPlantProductRows.find(r => r.plant_id === plant.id && r.product_id === productId);
    const pricing = rqBrandPricing(link, plant, productId);
    const state = pricing && pricing.snapshot && pricing.snapshot.rqLastState;
    if (!state){ btAlert(`Open ${plant.name}'s QT and confirm the border price first — the pesos price starts from it.`); resolve(false); return; }
    const usd = Number(rate.rate), cur = rqPesosRateCur(rate), destName = (c.usual_destination || rate.destination || '').trim();
    let ov = document.getElementById('rq_pesos_overlay');
    if (ov) ov.remove();
    ov = document.createElement('div');
    ov.id = 'rq_pesos_overlay'; ov.className = 'tt-overlay'; ov.style.display = 'flex';
    ov.innerHTML = `<div class="tt-overlay-head"><div></div><div class="tt-overlay-title" style="justify-content:center;min-width:0;"><span>${escapeHtml(c.trade_name)} — ${escapeHtml(plant.name)} — pesos · ${escapeHtml(destName)}</span></div>
      <div style="justify-self:end;display:flex;gap:8px;align-items:center;"><button class="btn" id="rq_pesos_confirm" type="button">✓ Confirm in pesos</button><button class="tt-overlay-close" id="rq_pesos_close" title="Close" aria-label="Close" type="button">✕</button></div></div>
      <div class="tt-overlay-body"><iframe id="rq_pesos_iframe" src="trading-tool.html?embed=1&v=${Date.now()}"></iframe></div>`;
    document.body.appendChild(ov);
    const frame = ov.querySelector('#rq_pesos_iframe');
    let timer = null, done = false, applied = false;
    const finish = (ok) => { if (done) return; done = true; clearInterval(timer); ov.remove(); resolve(ok); };
    ov.querySelector('#rq_pesos_close').onclick = () => finish(false);
    // one tick: the version is applied once the QT is up; then Import Cost is set and Colombian freight follows the QT's own rate (USD × that rate, so it comes back exact)
    timer = setInterval(() => {
      let win; try { win = frame.contentWindow; } catch (e) { return; }
      if (!win || !win.__calc || !win.ttApplyState) return;
      const doc = win.document, el = (id) => doc.getElementById(id);
      if (!applied){
        applied = true;
        // the dollar QT turns into a pesos QT: same layout, pesos data (see rqPesosApplyView)
        win.ttApplyState(JSON.parse(JSON.stringify(state)));
        el('importCost').value = RQ_PESOS_IMPORT_COST_USD;
        win.buildProductRows(); win.calc();
      }
      rqPesosApplyView(win, usd, cur);
      const fx = parseFloat(el('fxRate').value) || 0;
      const want = rqPesosFreightMx(usd, cur, fx) > 0 ? rqPesosFreightMx(usd, cur, fx).toFixed(2) : '';
      if (want && parseFloat(el('freightMx').value) !== parseFloat(want)){ el('freightMx').value = want; win.buildProductRows(); win.calc(); }
    }, 600);
    ov.querySelector('#rq_pesos_confirm').onclick = () => {
      let win; try { win = frame.contentWindow; } catch (e) { return; }
      const k = win && win.__calc;
      const fx = k && k.inp ? k.inp.fxRate : 0;
      if (!k || !(k.totalSaleMx > 0) || !(fx > 0) || !(k.totalWeightKg > 0)){ rqShowNotice("The pesos price is not ready yet — wait for today's exchange rate and the Colombia costs to fill in."); return; }
      rqPesosConfirmed[plant.id + '|' + productId + '|' + c.id] = {
        perKg: k.totalSaleMx / k.totalWeightKg, total: k.totalSaleMx, fx, dest: destName, freightAmount: usd, freightCurrency: cur, importCost: RQ_PESOS_IMPORT_COST_USD,
        borderSale: borderCalc.salePerLb, cost: borderCalc.costPerLb, at: new Date().toISOString(),
      };
      finish(true);
    };
  });
}

// ---- The pesos numbers INSIDE the plant's own QT (owner 2026-10-18: "poder ver números en el QT y confirmar como siempre").
// When a customer who buys in pesos buys this product (the one marked in the send panel first), the QT opens with his city's Colombian freight (the carrier tariff in USD,
// shown in the QT's own MX$ field at the QT's own rate) and Import Cost 625 filled in, so the QT's Colombia panel shows the pesos numbers next to the border ones. The trader
// confirms as always; the pesos price he saw is saved with that confirmation (calc.pesosQt) and the send uses it. A product no pesos customer buys is opened exactly as before.
function rqPesosCustomerFor(p){
  if (!p || !p.rqProductId || !rqMxnCurrencyId) return null;
  const marked = rqReqSel && rqReqSel.ids && rqReqSel.key === rqSheetKey() ? rqMatchedCustomers.filter(c => rqReqSel.ids.has(c.id) && rqCustomerBuys(c, p.rqProductId)) : [];
  if (!marked.length) return null;
  const asked = rqSheetAskedIds(p.rqProductId);
  const ctxCustomer = marked.find(c => asked.has(c.id)) || marked[0]; // the customer who asked (marked), else the first marked: HE decides which QT this is
  return rqIsPesosCustomer(ctxCustomer) && rqPesosDestRate(ctxCustomer) ? ctxCustomer : null;
}
// the QT's address: Import Cost shown and filled, Colombian freight filled (USD tariff × the rate Quotes already has)
function rqPesosToolParams(p, params){
  const c = rqPesosCustomerFor(p);
  if (!c) { p.rqPesosCtx = null; return; }
  const rate = rqPesosDestRate(c);
  p.rqPesosCtx = { customerId: c.id, rateId: rate.id, usd: Number(rate.rate), cur: rqPesosRateCur(rate), dest: (c.usual_destination || rate.destination || '').trim() };
  params.set('hideImportCost', '0'); params.set('importCost', String(RQ_PESOS_IMPORT_COST_USD)); params.set('hideColombianFreight', '0');
  const f0 = rqPesosFreightMx(p.rqPesosCtx.usd, p.rqPesosCtx.cur, typeof rqCachedFxRate === 'number' ? rqCachedFxRate : 0);
  if (f0 > 0) params.set('freightMx', String(f0));
}
// keeps Colombian freight exact against the QT's own (rounded-up) rate while the QT is open; never overwrites a number the trader typed
// The pesos QT (owner 2026-10-18): the exchange rate comes from the web (the QT's own), Weight in kilos, Purchase price in dollars, Selling price in pesos (Selling COP/kg =
// Selling $/lb (adj.) × 2.20462 × the rate — the QT's own Colombia formula), US freight, Inspection and Import Cost in dollars, Colombian freight in the currency of the carrier's own
// tariff (USD or COP). Profitability stays in dollars. View only, no formula touched.
const RQ_PESOS_VIEW_CSS = '#mxProfitBlock, #profitColDivider, .qb-item.qb-out:has(#financeOutTopMx), .prod-row > .prod-top + .section-label, .prod-row > .divider, .prod-row > .prod-grid .mini:has(#prodWeight0), .prod-row > .prod-grid .mini:has(#prodSellBorder0) { display: none !important; } .prod-row > .prod-grid { grid-template-columns: minmax(0, 1fr) !important; justify-items: center; } .prod-row > .prod-grid .mini { width: 60%; } .prod-row > .prod-grid { margin-bottom: 12px; }';
function rqPesosApplyView(win, amount, cur){
  const doc = win.document;
  if (!doc.getElementById('rq_pesos_only_css')){ const st = doc.createElement('style'); st.id = 'rq_pesos_only_css'; st.textContent = RQ_PESOS_VIEW_CSS; doc.head.appendChild(st); }
  // top bar balanced around Confirm Price: Terms on one side, Exchange Rate + Finance Cost on the other (with the Colombia chip out of sight the left side was twice as long)
  const fxWrap = doc.getElementById('qbMxFxWrap'), rightCell = doc.querySelector('#qbBar > div[style*="grid-column:3"]');
  if (fxWrap && rightCell && fxWrap.parentNode !== rightCell) rightCell.insertBefore(fxWrap, rightCell.firstChild);
  const anchor = doc.getElementById('mexicanFreightField'), hint = doc.getElementById('freightMxUsdHint');
  let box = doc.getElementById('pt_freight_usd');
  if (cur === 'COP'){ // the carrier quotes in pesos: the QT's own MX$ field stays
    if (box) box.remove();
    if (anchor) anchor.style.removeProperty('display');
    return;
  }
  if (!box && anchor){
    box = doc.createElement('div'); box.className = 'field'; box.id = 'pt_freight_usd';
    box.innerHTML = '<label>Colombian Freight (USD)</label><div class="inputwrap"><span class="pfx">$</span><input type="text" id="pt_freight_usd_val" disabled style="text-align:right;"></div>';
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
    if (imp && !p.rqPesosImportDone && (parseFloat(imp.value) || 0) === 0){ imp.value = RQ_PESOS_IMPORT_COST_USD; win.buildProductRows(); win.calc(); }
    if (imp) p.rqPesosImportDone = true;
    if (!el || !(fx > 0)) return;
    const want = rqPesosFreightMx(p.rqPesosCtx.usd, p.rqPesosCtx.cur, fx).toFixed(2), cur = parseFloat(el.value) || 0;
    // only touch the field while it still holds nothing, or what we put there (the trader's own number stays)
    if (Math.abs(cur - parseFloat(want)) > 0.005 && (cur === 0 || (lastSet !== null && Math.abs(cur - lastSet) < 0.005) || p.rqPesosParamValue === cur)){
      el.value = want; lastSet = parseFloat(want); win.buildProductRows(); win.calc();
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

setTimeout(() => { rqLoadMxnCurrency(); }, 1500); // learned in the background as soon as the page is up
