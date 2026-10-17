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
    const usd = Number(rate.rate), destName = (c.usual_destination || rate.destination || '').trim();
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
        win.ttApplyState(JSON.parse(JSON.stringify(state)));
        el('importCost').value = RQ_PESOS_IMPORT_COST_USD;
        win.buildProductRows(); win.calc();
      }
      const fx = parseFloat(el('fxRate').value) || 0;
      const want = fx > 0 ? (Math.round(usd * fx * 100) / 100).toFixed(2) : '';
      if (want && parseFloat(el('freightMx').value) !== parseFloat(want)){ el('freightMx').value = want; win.buildProductRows(); win.calc(); }
    }, 600);
    ov.querySelector('#rq_pesos_confirm').onclick = () => {
      let win; try { win = frame.contentWindow; } catch (e) { return; }
      const k = win && win.__calc;
      const fx = k && k.inp ? k.inp.fxRate : 0;
      if (!k || !(k.totalSaleMx > 0) || !(fx > 0) || !(k.totalWeightKg > 0)){ rqShowNotice("The pesos price is not ready yet — wait for today's exchange rate and the Colombia costs to fill in."); return; }
      rqPesosConfirmed[plant.id + '|' + productId + '|' + c.id] = {
        perKg: k.totalSaleMx / k.totalWeightKg, total: k.totalSaleMx, fx, dest: destName, freightUsd: usd, importCost: RQ_PESOS_IMPORT_COST_USD,
        borderSale: borderCalc.salePerLb, cost: borderCalc.costPerLb, at: new Date().toISOString(),
      };
      finish(true);
    };
  });
}

setTimeout(() => { rqLoadMxnCurrency(); }, 1500); // learned in the background as soon as the page is up
