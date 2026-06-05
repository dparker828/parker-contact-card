#!/usr/bin/env node
/**
 * gen-vcf.mjs — regenerate the three static vCards from index.html.
 *
 * index.html's CONFIG object is the SINGLE SOURCE OF TRUTH. This script reads
 * CONFIG straight out of the HTML, builds vCard 3.0 files for Dustin, Rachel,
 * and both, and writes them to /vcf. It also fails loudly if the hardcoded
 * Call/Text links in the two direct-contact cards drift from CONFIG.
 *
 * Usage:  node scripts/gen-vcf.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = join(root, 'index.html');
const html = readFileSync(htmlPath, 'utf8');

// --- Extract the CONFIG object literal from index.html (single source of truth) ---
const m = html.match(/const CONFIG\s*=\s*(\{[\s\S]*?\})\s*;/);
if (!m) { console.error('ERROR: CONFIG object not found in index.html'); process.exit(1); }
// Strip line comments, but keep "//" that belongs to a URL scheme (e.g. https://):
// a "//" immediately preceded by ":" is left intact.
const objText = m[1].replace(/(^|[^:])\/\/[^\n]*/g, '$1');
let CONFIG;
try { CONFIG = (0, eval)('(' + objText + ')'); }            // trusted, our own file
catch (e) { console.error('ERROR: could not parse CONFIG object literal:', e.message); process.exit(1); }
for (const k of ['office', 'website', 'company', 'textTo', 'dustin', 'rachel']) {
  if (CONFIG[k] == null) { console.error(`ERROR: CONFIG.${k} is missing`); process.exit(1); }
}

const CRLF = '\r\n';
// Escape vCard 3.0 TEXT values per RFC 2426 (backslash, semicolon, comma, newline).
// Applied only to free-text fields — never to structurally-delimited fields like N.
const esc = (s) => String(s)
  .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// vCard 3.0 — mirrors the original card's fields. NOTE carries the evergreen value
// hook (the original's dynamic "Scanned <date>" prefix is intentionally omitted,
// because a static file cannot carry a live scan date).
function vcard(p) {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(p.last)};${esc(p.first)};;;`,
    `FN:${esc(p.first + ' ' + p.last)}`,
    `ORG:${esc(CONFIG.company)}`,
    `TITLE:${esc('Real Estate Agent | Founder')}`,
    `TEL;TYPE=CELL,VOICE:${p.mobile}`,
    `TEL;TYPE=WORK,VOICE:${CONFIG.office}`,
    `EMAIL;TYPE=WORK:${p.email}`,
    `URL:${CONFIG.website}`,
    `NOTE:${esc('Free Home Intelligence Report anytime — just text. ' + CONFIG.website)}`,
    'END:VCARD',
  ].join(CRLF);
}

const outDir = join(root, 'vcf');
mkdirSync(outDir, { recursive: true });

const dustin = vcard(CONFIG.dustin);
const rachel = vcard(CONFIG.rachel);
writeFileSync(join(outDir, 'dustin.vcf'), dustin + CRLF, 'utf8');
writeFileSync(join(outDir, 'rachel.vcf'), rachel + CRLF, 'utf8');
// "Save Both" => two separate contacts (two concatenated VCARD blocks).
writeFileSync(join(outDir, 'both.vcf'), dustin + CRLF + rachel + CRLF, 'utf8');

// --- Drift guard: the hardcoded Call/Text links must match CONFIG mobiles. ---
// Order-tolerant: locate each anchor by its aria-label, then read its href,
// regardless of attribute order or whitespace.
const grab = (label) => {
  const tag = html.match(new RegExp('<a\\b[^>]*aria-label="' + label + '"[^>]*>'));
  if (!tag) return null;
  const h = tag[0].match(/href="(?:tel|sms):(\+\d+)"/);
  return h ? h[1] : null;
};
const checks = [
  ['Call Dustin', CONFIG.dustin.mobile],
  ['Text Dustin', CONFIG.dustin.mobile],
  ['Call Rachel', CONFIG.rachel.mobile],
  ['Text Rachel', CONFIG.rachel.mobile],
];
let bad = 0;
for (const [label, want] of checks) {
  const got = grab(label);
  if (got !== want) { console.error(`DRIFT: anchor "${label}" -> ${got} but CONFIG mobile is ${want}`); bad++; }
}
if (bad) { console.error(`\n${bad} drift error(s). Fix the hardcoded links in index.html, then re-run.`); process.exit(2); }

console.log('Wrote vcf/dustin.vcf, vcf/rachel.vcf, vcf/both.vcf');
console.log('Drift check passed — hardcoded Call/Text links match CONFIG.');
console.log(`textTo=${CONFIG.textTo}  office=${CONFIG.office}  website=${CONFIG.website}`);
