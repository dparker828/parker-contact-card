// Home Intelligence Report lead capture. Validates, drops bot submissions
// (honeypot), and emails a clearly-formatted LEAD alert via Resend.
// Returns ok:true only if the email is accepted, so the card can offer the
// "text us instead" fallback if delivery ever fails (no silently-lost leads).

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

async function fetchTimeout(url, opts = {}, ms = 7000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); }
  finally { clearTimeout(t); }
}
const money = (n) => (n && Number(n) > 0) ? '$' + Number(n).toLocaleString() : null;

export default async function handler(req, res) {
  const b = (typeof req.body === 'string' ? safe(req.body) : (req.body || {}));
  if (b.company) return res.status(200).json({ ok: true });           // honeypot -> silently accept, no email

  const name  = (b.name  || '').toString().trim();
  const phone = (b.phone || '').toString().trim();
  const email = (b.email || '').toString().trim();
  const addr  = (b.address || '').toString().trim();
  if (!name || (!phone && !email)) return res.status(400).json({ ok: false, error: 'missing_fields' });

  const key  = process.env.RESEND_API_KEY;
  const to   = process.env.NOTIFY_EMAIL_TO;
  const from = process.env.NOTIFY_EMAIL_FROM || 'Parker Group Card <onboarding@resend.dev>';
  if (!key || !to) return res.status(500).json({ ok: false, error: 'not_configured' });

  const est = money(b.estimate);
  const range = (money(b.low) && money(b.high)) ? `${money(b.low)} – ${money(b.high)}` : null;
  const when = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const rows = [
    ['Name', name],
    ['Mobile', phone || '—'],
    ['Email', email || '—'],
    ['Address', addr || '—'],
    ['Instant estimate', est ? `${est}${range ? ` (range ${range})` : ''}` : 'not shown / low-confidence'],
    ['When', `${when} (ET)`]
  ].map(([k, v]) => `<tr><td style="padding:4px 14px 4px 0;color:#64748b">${esc(k)}</td><td style="padding:4px 0;font-weight:600">${esc(v)}</td></tr>`).join('');

  const html = `<div style="font-family:system-ui,Arial,sans-serif">
    <h2 style="margin:0 0 4px">🔥 New Home Intelligence lead</h2>
    <p style="margin:0 0 12px;color:#475569">Someone asked for their full report from your card — reach out while it's warm.</p>
    <table style="border-collapse:collapse;font-size:14px">${rows}</table>
    <p style="margin:14px 0 0">${phone ? `<a href="sms:${esc(phone)}">Text ${esc(name)}</a>` : ''}${(phone && email) ? ' &nbsp;·&nbsp; ' : ''}${email ? `<a href="mailto:${esc(email)}">Email ${esc(name)}</a>` : ''}</p>
  </div>`;

  try {
    const r = await fetchTimeout('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, reply_to: email || undefined,
        subject: `🔥 New lead — ${name} wants their Home Intelligence Report`, html })
    });
    if (!r.ok) return res.status(502).json({ ok: false, error: 'send_failed' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'send_error' });
  }
}
function safe(s){ try { return JSON.parse(s); } catch { return {}; } }
