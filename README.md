# Parker Group — Digital Contact Card

A single-page digital contact card for Dustin &amp; Rachel Parker (The Parker Group).
A premium, in-person handoff card: scan a QR, save the contact, text us. It is almost
entirely client-side — **no lead-capture forms, no analytics, no tracking.** The one
exception is the optional home-value tool, which calls a single serverless endpoint
(`/api/estimate`) to fetch a real estimate and email Dustin that someone looked.

## Live URL

**https://contact.theparkergroup.com** ← point your QR code at this root URL.
(The original `parker-contact-card.vercel.app` address also still works.)

HTTPS is required (the save flow and the "Pass it on" Web Share both need a secure context),
and Vercel provides it automatically.

## What's in here

- **`index.html`** — the entire card. Self-contained: inline CSS, inline JS, base64 images,
  Google Fonts via CDN. This is the approved artifact; its design and copy are final.
- **`vcf/dustin.vcf`, `vcf/rachel.vcf`, `vcf/both.vcf`** — the static vCards the
  "Save our contact" sheet links to. Static `.vcf` files open the native Add-to-Contacts
  flow far more reliably than a browser-generated download, especially on iOS.
- **`scripts/gen-vcf.mjs`** — regenerates the three vCards from `index.html`.
- **`api/estimate.mjs`** — the one serverless function. Powers the home-value tool: fetches a
  real estimate (RentCast AVM) and emails Dustin on every lookup (Resend). Only displays a
  number when the estimate is reasonably confident; otherwise the card invites a text.
- **`vercel.json`** — serves `/vcf/*` as `text/vcard; charset=utf-8` so iOS opens Contacts cleanly.
- **`og.jpg`** — 1200×630 social share image (the hero photo, cover-cropped). Used by the
  Open Graph / Twitter tags so a shared link unfurls with a rich preview.
- **`favicon.ico`, `icon-32.png`, `icon-16.png`, `apple-touch-icon.png`** — browser-tab and
  home-screen icons: the white house mark on brand navy.
- **`scripts/gen-assets.py`** — regenerates `og.jpg` + the icons from `index.html` (Pillow).

## The CONFIG block — edit here, nothing else

Near the top of the `<script>` in `index.html`:

```js
const CONFIG = {
  office:"+13022176692", website:"https://theparkergroup.com", company:"The Parker Group",
  dustin:{first:"Dustin",last:"Parker",mobile:"+13022285204",email:"dustin@theparkergroup.com"},
  rachel:{first:"Rachel",last:"Parker",mobile:"+14103100816",email:"rachel@theparkergroup.com"},
  textTo:"+13022285204",   // number that receives the concierge + estimate "Text us" messages
  cardURL:""               // blank = the referral share uses this page's own live URL (correct)
};
```

- **`office` / `website` / `company`** — shown across the card and written into every vCard.
- **`dustin` / `rachel`** — name, `mobile` (E.164, e.g. `+1302…`), and `email`. The mobile also
  fills the Call/Text buttons on each person's direct-contact card.
- **`textTo`** — where the four concierge buttons and the estimate gadget's "Text us for your
  real numbers" CTA send their pre-filled SMS. Currently Dustin's mobile.
- **`cardURL`** — leave blank. The "Pass it on" share then uses the live page URL.

> Note: a multi-recipient (group) `sms:` link was considered for `textTo` but rejected — on
> iOS a second recipient frequently drops the pre-filled message body, which would break the
> concierge/estimate messages. A single recipient is reliable. To loop both of you in, use a
> forwarding/shared inbox at the carrier; the card needs no change.

## Regenerating the vCards (whenever a number or email changes)

1. Edit the values in the `CONFIG` block in `index.html`.
2. Update the matching hardcoded links in the two direct-contact cards — search for
   `aria-label="Call Dustin"`, `"Text Dustin"`, `"Call Rachel"`, `"Text Rachel"`.
3. Run:

   ```bash
   node scripts/gen-vcf.mjs
   ```

   The script reads `CONFIG` straight out of `index.html`, rewrites all three `.vcf` files,
   and **fails loudly if the hardcoded links don't match `CONFIG`** (a built-in drift guard).
4. Commit and push — Vercel redeploys automatically.

## QR code

Point any QR code at the root URL above — no path, no parameters. (The card reads an optional
`?ref=` parameter only to personalize the greeting when someone opens a *shared* link; it is
not required and stores nothing.)

## Social share image & favicon

When someone uses "Pass it on," the link unfurls with a rich preview (hero photo, title,
description) via the Open Graph / Twitter tags in `<head>`. The browser tab and "Add to Home
Screen" use the house-mark favicon. To regenerate after changing the hero photo or logo:

```bash
pip install pillow            # once (add --break-system-packages if your env requires it)
python3 scripts/gen-assets.py
```

The Open Graph tags use **absolute URLs** (`https://contact.theparkergroup.com/og.jpg`
and `og:url`). If you move to a custom domain (e.g. `card.theparkergroup.com`), update those
absolute URLs and the `<link rel="canonical">` in `index.html` to the new domain.

## The home-value tool (the one piece of backend)

The "What's my home worth?" gadget posts the address to **`/api/estimate`** (a Vercel
serverless function). That function:

1. Looks up a real automated valuation from **RentCast** (AVM API).
2. **Emails Dustin on every lookup** via **Resend** — address, rough estimate, timestamp — so
   each use is a live lead. (Best-effort: a mail hiccup never breaks the tool.)
3. **Only shows the visitor a number when RentCast is reasonably confident.** RentCast returns
   a price for almost any input and widens its range when unsure, so the function gates on
   range width: if `(high − low) / value` exceeds **`CONF_MAX_SPREAD`** (default **0.60**,
   ~±30%), the card hides the number and shows "tap below and we'll send your exact figures by
   hand" instead. The owner email still fires, flagged LOW CONFIDENCE. Raise `CONF_MAX_SPREAD`
   (top of `api/estimate.mjs`) to show more numbers; lower it to be stricter.

There are still **no forms, no databases, no analytics, and no tracking** — inbound texts and
the lead email are the only signals.

### Environment variables (Vercel → Project → Settings → Environment Variables)

| Name | What it is |
| --- | --- |
| `RENTCAST_API_KEY` | RentCast API key (the valuation source). |
| `RESEND_API_KEY` | Resend API key (sends the lead-alert email). |
| `NOTIFY_EMAIL_TO` | Where the alert goes — `dustin@theparkergroup.com`. |
| `NOTIFY_EMAIL_FROM` | Sender, e.g. `Parker Group Card <onboarding@resend.dev>`. Verify theparkergroup.com in Resend to send from your own domain. |

Keys live only in Vercel (never in the repo); the function reads them from `process.env`.

## Deploy

Static site on Vercel (personal account), no build step. Pushing to `main` triggers a redeploy.
