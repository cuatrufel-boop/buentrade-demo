// The price that goes to a customer is the one confirmed in the QT, never another (user 2026-10-14: a WhatsApp box edited to "$1.60" while the QT and Offers said 1.61).
// Every customer message is editable text, but the sale price inside it is not. Every sending window (Quotes' WhatsApp cards, the shared email / WhatsApp review windows) puts the
// price back to the confirmed one before anything goes out, tells the trader, and waits for a second press. One implementation, here.
//
// A customer price is always written as "<number> USD/lb frontera" (with or without the "$"). locks: [{ plant?, price, decimals? }].
//   - with a plant: the ONE line that starts with that plant's name and carries that phrase (an updated list has one line per plant);
//   - without: the ONE line that carries the phrase.
// Only a line that is certain (exactly one candidate line, one price in it) is touched; anything else is left as written.
function btLockPricesInText(text, locks){
  const lines = String(text || '').split('\n');
  const changes = [];
  const phrase = /(\$?\s*)(\d+(?:\.\d+)?)(\s*USD\/lb frontera)/i;
  for (const lock of (locks || [])) {
    const want = Number(lock && lock.price);
    if (!(want > 0)) continue;
    const decimals = lock.decimals == null ? 4 : lock.decimals;
    const name = String(lock.plant || '').trim().toLowerCase();
    const idx = lines.map((l, i) => phrase.test(l) && (!name || l.replace(/\*/g, '').trim().toLowerCase().startsWith(name)) ? i : -1).filter(i => i >= 0);
    if (idx.length !== 1) continue;
    const m = lines[idx[0]].match(phrase), found = Number(m[2]);
    if (lines[idx[0]].match(new RegExp(phrase.source, 'gi')).length !== 1 || (lines[idx[0]].match(/\$/g) || []).length > 1) continue; // two prices in one line: not certain
    if (Math.abs(found - Number(want.toFixed(decimals))) < 0.00005) continue;
    lines[idx[0]] = lines[idx[0]].replace(phrase, (_, dollar, __, tail) => dollar + want.toFixed(decimals) + tail);
    changes.push({ was: m[2], want: want.toFixed(decimals), plant: lock.plant || '' });
  }
  return { text: lines.join('\n'), changed: changes.length > 0, changes };
}
function btPriceLockNote(changes){
  const c = changes[0];
  return `The price in the message was $${c.was} — it is back to $${c.want}, the one confirmed in the QT. To send another price, change it in the QT. Review and send again.`;
}
