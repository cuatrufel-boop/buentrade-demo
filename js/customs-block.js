// The customs agency's data as it goes in the order e-mails (owner 2026-11-04: "los correos de POs nuevas a plantas deben mandar, además de todo lo que ya
// llevan, los datos de la aduana: teléfono, dirección, etc… cuando la carga es entregada por la planta. Cuando la entregamos nosotros esta info debe ir al
// fletero"). ONE block, used by both pages (orders.html and offers.html):
//   - the PO e-mail to the PLANT, when the plant delivers (DAP: the PO has an agency, composed by orders-compose-po);
//   - the FO e-mail to the CARRIER, on the US leg we book (the agency is where the carrier delivers, composed by orders-compose-fo).
// It prints only what is on file for the agency (name, street address, contact, phone, WhatsApp, e-mail); nothing is invented and a missing field is left out.
(function (root) {
  const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').replace(/[\s,;]+$/, '').trim();

  // The street address on one line: the city and the country are added only when the address does not already carry them.
  function addressLine(a) {
    const address = clean(a.address);
    const city = clean(a.city);
    const country = clean(a.country_name) || clean(a.country);
    const parts = [address];
    if (city && !address.toLowerCase().includes(city.toLowerCase())) parts.push(city);
    if (country && !address.toLowerCase().includes(country.toLowerCase())) parts.push(country);
    return parts.filter(Boolean).join(', ');
  }

  function blockLines(a) {
    if (!a || !clean(a.name)) return [];
    const lines = ['DELIVER TO — CUSTOMS AGENCY:', clean(a.name)];
    const add = (label, v) => { const t = clean(v); if (t) lines.push(`${label}: ${t}`); };
    add('Address', addressLine(a));
    add('Contact', a.contact_name);
    add('Phone', a.phone);
    add('WhatsApp', a.whatsapp);
    add('Email', a.email);
    return lines;
  }

  // The e-mail text: empty when there is no agency (nothing is added to the body then).
  const customsBlockText = (a) => blockLines(a).join('\n');

  // The agency of a composed Freight Order. The server sends the whole record (`customs_agency`); an older answer without it still gives the delivery block
  // (name, street address, city) and the agency's phone, which is read here so the carrier gets the phone either way. Only the US leg has an agency.
  function agencyOfFO(composed) {
    if (!composed || !composed.is_us_leg) return null;
    if (composed.customs_agency) return composed.customs_agency;
    if (!composed.customs_broker) return null;
    const lines = Array.isArray(composed.delivery_lines) ? composed.delivery_lines : [];
    return { name: composed.customs_broker, address: lines.slice(1).join(', '), phone: composed.delivery_phone || '' };
  }

  // What the e-mail body gets after its approved text: a blank line and the block, or nothing.
  const appendCustoms = (body, a) => { const t = customsBlockText(a); return t ? `${body}\n\n${t}` : body; };

  const api = { addressLine, blockLines, customsBlockText, agencyOfFO, appendCustoms };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BTCustomsBlock = api;
})(typeof window !== 'undefined' ? window : globalThis);
