// Serverless function (Vercel Node runtime): real home-value estimate + owner notification.
// Env: RENTCAST_API_KEY, RESEND_API_KEY, NOTIFY_EMAIL_TO, NOTIFY_EMAIL_FROM
//
// Confidence gate: RentCast returns a price + range for almost any input (even gibberish),
// widening its range when unsure. We only SHOW a number to the visitor when the range is
// reasonably tight (spread <= CONF_MAX_SPREAD); otherwise the card shows the "text us for
// your exact figure" fallback. Either way the owner is emailed (it's a lead) with the rough
// estimate + a confidence note. Tune CONF_MAX_SPREAD to show more (higher) or fewer (lower).

const CONF_MAX_SPREAD = 0.60; // (high - low) / price; >0.60 (~±30%) => low confidence => "text us"

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
    const spread = (high - low) / price;
    return { value: price, low, high, spread, confident: spread <= CONF_MAX_SPREAD };
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'timeout' : 'fetch_error' };
  }
}

async function notify(address, r) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL_TO;
  if (!key || !to) return;
  const from = process.env.NOTIFY_EMAIL_FROM || 'Parker Group Card <onboarding@resend.dev>';
  const when = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  let valLine;
  if (r && r.value) {
    const range = `$${r.low.toLocaleString()}–$${r.high.toLocaleString()}`;
    valLine = r.confident
      ? `Estimated value: $${r.value.toLocaleString()} (range ${range}).`
      : `Estimated value: $${r.value.toLocaleString()} (range ${range}) — LOW CONFIDENCE (±${Math.round(r.spread * 100)}% range), so the visitor was shown the "text us" prompt instead of this number.`;
  } else {
    valLine = 'No automated value found for this address — still a lead worth a follow-up.';
  }
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
  } catch (_) { /* notification is best-effort */ }
}

export default async function handler(req, res) {
  const raw = req.method === 'POST'
    ? (req.body && (typeof req.body === 'string' ? safeJson(req.body).address : req.body.address))
    : req.query.address;
  const address = (raw || '').toString().trim();
  if (address.length < 5) return res.status(400).json({ ok: false, error: 'address_required' });

  const r = await getValue(address);
  await notify(address, r); // notify on EVERY lookup — always a lead signal

  // Show a number only when RentCast is reasonably confident; otherwise invite a text.
  if (r.value && r.confident) return res.status(200).json({ ok: true, value: r.value, low: r.low, high: r.high });
  return res.status(200).json({ ok: false, noData: true });
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }
