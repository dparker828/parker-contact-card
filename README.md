# Parker Group — Digital Contact Card

A single-page digital contact card for Dustin &amp; Rachel Parker (The Parker Group).
A premium, in-person handoff card: scan a QR, save the contact, text us. It is fully
client-side — **no backend, no lead capture, no analytics, no tracking.**

## Live URL

**https://parker-contact-card.vercel.app** ← point your QR code at this root URL.

HTTPS is required (the save flow and the "Pass it on" Web Share both need a secure context),
and Vercel provides it automatically.

## What's in here

- **`index.html`** — the entire card. Self-contained: inline CSS, inline JS, base64 images,
  Google Fonts via CDN. This is the approved artifact; its design and copy are final.
- **`vcf/dustin.vcf`, `vcf/rachel.vcf`, `vcf/both.vcf`** — the static vCards the
  "Save our contact" sheet links to. Static `.vcf` files open the native Add-to-Contacts
  flow far more reliably than a browser-generated download, especially on iOS.
- **`scripts/gen-vcf.mjs`** — regenerates the three vCards from `index.html`.
- **`vercel.json`** — serves `/vcf/*` as `text/vcard; charset=utf-8` so iOS opens Contacts cleanly.

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

## By design: no backend, no lead capture

This is a contact card, not a funnel. There are no forms, email integrations, analytics,
databases, or server-side code. Inbound texts are the contact.

If you ever decide to change that, the one place a capture hook would attach is the
client-side `save()` function and the concierge / estimate click handlers in `index.html` —
that is where a `fetch()` to an endpoint of your choosing would go. None of it is built or
wired today.

## Deploy

Static site on Vercel (personal account), no build step. Pushing to `main` triggers a redeploy.
