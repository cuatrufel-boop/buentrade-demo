// Which person of a customer a message about ONE product goes to (owner 2026-10-21: one company, one buyer for chicken and another for beef and pork).
// A customer has its main contact (the columns of customers) and, optionally, contacts by protein (customer.contacts[].category_ids = categories.id).
//   * the product's category has a contact → that person, with ONLY his own channels (a beef offer never falls back to the chicken buyer's email);
//   * otherwise → the main contact, exactly as before.
// The same rule is in supabase/functions/_shared/customerContact.ts for the functions; the test customer-contacts-by-protein.test.js runs both on the same cases.
// btCustomerContact(customer, categoryId) → { contact_name, contact_role, whatsapp, phone, email, email_cc, by_protein }
// btCustomerFor(customer, categoryId)     → the customer itself with those fields replaced, so code that reads c.email / c.whatsapp / c.contact_name needs no other change.
function btCustomerContact(customer, categoryId){
  const pick = (o) => ({ contact_name: (o && o.contact_name) || null, contact_role: (o && o.contact_role) || null, whatsapp: (o && o.whatsapp) || null, phone: (o && o.phone) || null, email: (o && o.email) || null, email_cc: (o && o.email_cc) || null });
  const list = customer && Array.isArray(customer.contacts) ? customer.contacts : [];
  const hit = categoryId ? list.find(c => Array.isArray(c.category_ids) && c.category_ids.includes(categoryId)) : null;
  return hit ? Object.assign(pick(hit), { by_protein: true }) : Object.assign(pick(customer), { by_protein: false });
}
function btCustomerFor(customer, categoryId){
  if (!customer) return customer;
  const k = btCustomerContact(customer, categoryId);
  return Object.assign({}, customer, { contact_name: k.contact_name, contact_role: k.contact_role, whatsapp: k.whatsapp, phone: k.phone, email: k.email, email_cc: k.email_cc, contact_by_protein: k.by_protein });
}
