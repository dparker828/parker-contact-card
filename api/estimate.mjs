// Serverless function (Vercel Node runtime): real home-value estimate + owner notification.
// Reads keys from environment (set in Vercel project settings) — never hard-coded.
//   RENTCAST_API_KEY   - RentCast AVM key
//   RESEND_API_KEY     - Resend email key
//   NOTIFY_EMAIL_TO    - where lead alerts go (e.g. dustin@theparkergroup.com)
//   NOTIFY_EMAIL_FROM  - verified sender (default: Resend onboarding sender)

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function fetchTimeout(url, opts = {}, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

async function getValue(address) {
  const key = process.env.RENTCAST_API_KEY;
  if (!key) return { error: 'no_key' };
  try {
    const url = `https://api.rentcast.io/v1/avm/value?address=${encodeURIComponent(address)}`;
    const r = await fetchTimeout(url, { headers: { 'X-Api-Key': key, Accept: 'application/json' } });
    if (!r.ok) return { error: `avm_${r.status}` };
    const d = await r.json();
    const price = Number(d && d.price);
    if (!price || price <= 0) return { error: 'no_data' };
    const low = Number(d.priceRangeLow) || Math.round(price * 0.95);
    const high = Number(d.priceRangeHigh) || Math.round(price * 1.05);
    return { value: price, low, high };
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'timeout' : 'fetch_error' };
  }
}

async function notify(address, result) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL_TO;
  if (!key || !to) return;
  const from = process.env.NOTIFY_EMAIL_FROM || 'Parker Group Card <onboarding@resend.dev>';
  const when = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const valLine = result && result.value
    ? `Estimated value: $${result.value.toLocaleString()} (range $${result.low.toLocaleString()}–$${result.high.toLocaleString()})`
    : 'No automated value found for this address — still a lead worth a follow-up.';
  const html = `<p>Someone just used the home-value tool on your card.</p>
<p><strong>Address:</strong> ${esc(address)}<br>
<strong>${esc(valLine)}</strong><br>
<strong>When:</strong> ${esc(when)} (ET)</p>
<p>Reach out while it's warm — they were curious about their home's value.</p>`;
  try {
    await fetchTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: `🏡 Home value checked: ${address}`, html }),
    }, 6000);
  } catch (_) { /* notification is best-effort; never fail the request on it */ }
}

export default async function handler(req, res) {
  const raw = req.method === 'POST'
    ? (req.body && (typeof req.body === 'string' ? safeJson(req.body).address : req.body.address))
    : req.query.address;
  const address = (raw || '').toString().trim();
  if (req.query && req.query.debug === '1') {
    const probe = await getValue(address || '5500 Grand Lake Dr, San Antonio, TX, 78244');
    return res.status(200).json({ debug: true, hasRent: !!process.env.RENTCAST_API_KEY, rentLen: (process.env.RENTCAST_API_KEY||'').length, hasResend: !!process.env.RESEND_API_KEY, resendLen: (process.env.RESEND_API_KEY||'').length, hasTo: !!process.env.NOTIFY_EMAIL_TO, getValue: probe });
  }
  if (address.length < 5) return res.status(400).json({ ok: false, error: 'address_required' });

  const r = await getValue(address);
  await notify(address, r.value ? r : null);   // notify on EVERY lookup (it's a lead signal)

  if (r.value) return res.status(200).json({ ok: true, value: r.value, low: r.low, high: r.high });
  return res.status(200).json({ ok: false, noData: true });  // frontend invites a text instead
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }
