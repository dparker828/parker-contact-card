// Server-side proxy to Google Places API (New) Autocomplete.
// Keeps GOOGLE_PLACES_API_KEY server-side (never shipped to the browser).
// Degrades gracefully: no key, error, or short query -> { ok, suggestions: [] }
// so the address field always still works as a plain text input.

async function fetchTimeout(url, opts = {}, ms = 6000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); }
  finally { clearTimeout(t); }
}

export default async function handler(req, res) {
  const q = (req.method === 'POST'
    ? (req.body && (typeof req.body === 'string' ? safe(req.body).q : req.body.q))
    : req.query.q) || '';
  const input = q.toString().trim();
  if (input.length < 3) return res.status(200).json({ ok: true, suggestions: [] });

  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return res.status(200).json({ ok: false, suggestions: [] });

  try {
    const r = await fetchTimeout('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
      body: JSON.stringify({
        input,
        includedRegionCodes: ['us'],
        // Bias (not restrict) toward the DE / MD / Eastern Shore footprint.
        locationBias: { rectangle: {
          low:  { latitude: 37.8, longitude: -76.6 },
          high: { latitude: 39.9, longitude: -74.9 }
        } }
      })
    });
    if (!r.ok) return res.status(200).json({ ok: false, suggestions: [] });
    const d = await r.json();
    const suggestions = (d.suggestions || [])
      .map(s => s.placePrediction && s.placePrediction.text && s.placePrediction.text.text)
      .filter(Boolean).slice(0, 5);
    return res.status(200).json({ ok: true, suggestions });
  } catch (e) {
    return res.status(200).json({ ok: false, suggestions: [] });
  }
}
function safe(s){ try { return JSON.parse(s); } catch { return {}; } }
