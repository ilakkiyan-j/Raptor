#!/usr/bin/env node
/**
 * Contrast regression check for the Tailwind utility classes used in
 * src/components.
 *
 * Why this exists: the light theme is rescued by a large `html.light { ...
 * !important }` layer in src/index.css, but dark mode has no such counterpart.
 * Any utility that was never given an explicit `dark:` variant therefore kept
 * its light-theme value in dark mode. `text-slate-500` and `text-slate-600`
 * used as muted text were the worst offenders, rendering at 1.9-4.1:1 on the
 * app's dark surfaces. That is invisible to `tsc` and to a successful build, so
 * it is checked here instead.
 *
 * What it does: parses every className in src/components, resolves each colour
 * utility to sRGB, applies the override tables declared in index.css, resolves
 * the inherited background by walking the JSX tree, and fails the process on
 * any text under the WCAG AA threshold.
 *
 * No dependencies. Run with `npm run check:contrast`.
 * Pass --verbose to print every failure instead of the first 6 per file.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const COMPONENT_DIR = join(process.cwd(), 'src', 'components');
const CSS_FILE = join(process.cwd(), 'src', 'index.css');
const VERBOSE = process.argv.includes('--verbose');
const PER_FILE = 6;

/* ------------------------------------------------------------------ *
 * Colour maths (WCAG 2.1 relative luminance / contrast ratio)
 * ------------------------------------------------------------------ */

const channel = (raw) => {
  const c = raw / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (a, b) => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/* ------------------------------------------------------------------ *
 * Tailwind palette
 * ------------------------------------------------------------------ */

const SLATE = {
  50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8',
  500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a',
  950: '#020617',
};

const HUES = {
  amber: { 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e' },
  emerald: { 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46' },
  indigo: { 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' },
  purple: { 300: '#d8b4fe', 400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce' },
  rose: { 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c' },
  cyan: { 300: '#67e8f9', 400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490', 800: '#155e75' },
  sky: { 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985' },
  teal: { 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e' },
};

/** Resolve a Tailwind colour token such as `slate-50` or `[#0a0e16]`. */
function tokenToHex(value) {
  if (value === 'white') return '#ffffff';
  if (value === 'black') return '#000000';
  if (value.startsWith('[')) {
    const m = value.match(/#([0-9a-fA-F]{3,8})/);
    if (!m) return null;
    let hex = `#${m[1]}`;
    if (hex.length === 4) hex = `#${[...hex.slice(1)].map((c) => c + c).join('')}`;
    return (hex.length === 9 ? hex.slice(0, 7) : hex).toLowerCase();
  }
  // Note: slate-50 is two digits, every other slate step is three.
  const slate = value.match(/^slate-(\d{2,3})$/);
  if (slate) return SLATE[slate[1]] ?? null;
  const hue = value.match(/^(amber|emerald|indigo|purple|rose|cyan|sky|teal)-(\d{3})$/);
  if (hue) return HUES[hue[1]]?.[hue[2]] ?? null;
  return null;
}

/* ------------------------------------------------------------------ *
 * Override layers declared in index.css
 * ------------------------------------------------------------------ */

const PROPERTY_OF = { color: 'text', 'background-color': 'bg', 'border-color': 'border' };

/** Parse `#rgb`, `#rrggbb`, `rgb()` or `rgba()` into `{ hex, alpha }`. */
function parseColour(value) {
  const text = value.replace(/!important/i, '').trim();
  const hex = text.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hex) {
    let full = `#${hex[1]}`;
    if (full.length === 4) full = `#${[...full.slice(1)].map((c) => c + c).join('')}`;
    if (full.length === 9) return { hex: full.slice(0, 7).toLowerCase(), alpha: Number(full.slice(7, 9), 16) / 255 };
    return { hex: full.toLowerCase(), alpha: 1 };
  }
  const rgb = text.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.%]+))?\s*\)$/i);
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map((n) => Math.round(Number(n)));
    const toHex = (n) => n.toString(16).padStart(2, '0');
    let alpha = 1;
    if (rgb[4] !== undefined) {
      alpha = rgb[4].endsWith('%') ? Number(rgb[4].slice(0, -1)) / 100 : Number(rgb[4]);
    }
    return { hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`, alpha };
  }
  return null;
}

/** Flatten a translucent foreground over an opaque background. */
function composite(foreground, background) {
  const a = foreground.alpha;
  if (a >= 1) return foreground.hex;
  const mix = (i) => {
    const f = parseInt(foreground.hex.slice(i, i + 2), 16);
    const b = parseInt(background.slice(i, i + 2), 16);
    return Math.round(f * a + b * (1 - a));
  };
  return `#${[1, 3, 5].map((i) => mix(i).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Extract the remap tables declared in index.css for both themes, so this
 * checker resolves the same values the browser will rather than the raw
 * Tailwind palette.
 */
function parseOverrides(css) {
  const tables = {
    light: { text: new Map(), bg: new Map() },
    dark: { text: new Map(), bg: new Map() },
  };
  // Strip comments first. Without this, a selector prefix mentioned inside a
  // comment is matched as if it were a real rule, and the regex then runs on
  // past the end of that comment to the next `{`, swallowing the rule that
  // follows it.
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blockRe = /(html\.light|:where\(html\.dark\))\s*([^{}]*?)\s*\{([^}]*)\}/g;
  let match;
  while ((match = blockRe.exec(source))) {
    const mode = match[1].startsWith('html.light') ? 'light' : 'dark';
    const declaration = match[3].match(/(background-color|border-color|color)\s*:\s*([^;}]+)/);
    if (!declaration) continue;
    const kind = PROPERTY_OF[declaration[1]];
    if (kind !== 'text' && kind !== 'bg') continue;
    const colour = parseColour(declaration[2]);
    if (!colour) continue;
    for (const raw of match[2].split(',')) {
      // A selector list is usually written one per line, each repeating the
      // `html.light` / `:where(html.dark)` prefix. Drop it before checking
      // that the remainder is a single class.
      const selector = raw.trim().replace(/^(html\.light|:where\(html\.dark\))\s+/, '');
      if (!selector.startsWith('.')) continue;
      if (selector.includes(':') || selector.includes(' ')) continue;
      const cls = selector.slice(1).replace(/\\(.)/g, '$1');
      const prefix = kind === 'text' ? 'text-' : 'bg-';
      if (!cls.startsWith(prefix)) continue;
      tables[mode][kind].set(cls, colour);
    }
  }
  return tables;
}

/* ------------------------------------------------------------------ *
 * Source extraction
 * ------------------------------------------------------------------ */

const STATEFUL = new Set([
  'hover', 'group-hover', 'focus', 'focus-visible', 'active', 'disabled', 'first', 'last', 'odd', 'even',
]);

/**
 * Variants that style a pseudo-element rather than the element itself. Their
 * colour does not describe the resting text, so it must not be read as one.
 */
const PSEUDO = new Set([
  'selection', 'marker', 'file', 'first-letter', 'first-line', 'placeholder',
  'backdrop', 'before', 'after', 'details-marker', 'input', 'textarea', 'select',
]);

/** Pull every className literal out of a tag's attribute string. */
function classNamesOf(attrs) {
  const out = [];
  const re = /className\s*=\s*("(?:[^"]*)"|'(?:[^']*)'|\{(?:[^{}]|\{[^{}]*\})*\})/g;
  let m;
  while ((m = re.exec(attrs))) out.push(m[1].replace(/^["'{]|["'}]$/g, ''));
  return out;
}

/**
 * Walk JSX tags so each element knows its inherited background. A flat scan of
 * className strings cannot distinguish `text-slate-500` on the page from the
 * same colour inside a card, and a single worst-case page colour either hides
 * real failures or invents them.
 */
function walkTree(src, visit) {
  const VOID = /^(br|hr|img|input|meta|link|source|path|circle|rect|line|polyline|polygon|ellipse|svg|use|stop|defs|pattern|mask|clipPath)$/i;
  const tagRe = /<(\/?)([A-Za-z][A-Za-z0-9._-]*)((?:[^<>{}]|\{(?:[^{}]|\{[^{}]*\})*\})*?)(\/?)>/g;
  const stack = [];
  let m;
  while ((m = tagRe.exec(src))) {
    const [, closing, name, attrs, selfClose] = m;
    if (closing) {
      stack.pop();
      continue;
    }
    if (VOID.test(name)) continue;
    const parent = stack[stack.length - 1] ?? null;
    // `.dark-isolate` marks a surface that stays dark in both themes, so no
    // light-theme override may be applied to it or anything inside it.
    const selfIsolate = classNamesOf(attrs).some((b) => /(^|\s)dark-isolate(\s|$)/.test(b));
    visit({
      name,
      attrs,
      line: src.slice(0, m.index).split('\n').length,
      parent,
      isolate: selfIsolate || (parent ? parent.isolate : false),
    });
    if (!selfClose) stack.push({ attrs, parent, isolate: selfIsolate || (parent ? parent.isolate : false) });
  }
  return stack.length === 0;
}

/* ------------------------------------------------------------------ *
 * Token resolution
 * ------------------------------------------------------------------ */

const PROP_RE = /^(bg|text|border|divide|ring|fill|stroke)-(.+)$/;
/** Suffixes that are spatial utilities, not colours: `px-2`, `rounded-t`, etc. */
const GEOMETRIC = /^(t|r|b|l|x|y|s|e|inset|start|end)$/;

function parseToken(raw) {
  const parts = raw.split(':');
  if (parts.some((p) => PSEUDO.has(p))) return null;
  const dark = parts.includes('dark');
  const state = parts.filter((p) => STATEFUL.has(p)).sort().join('+');
  const base = parts[parts.length - 1];
  const m = base.match(PROP_RE);
  if (!m) return null;
  let value = m[2];
  let alpha = 1;
  const alphaMatch = value.match(/\/(\d+)$/);
  if (alphaMatch) {
    alpha = Number(alphaMatch[1]) / 100;
    value = value.slice(0, alphaMatch.index);
  }
  if (GEOMETRIC.test(value)) return null;
  const hex = tokenToHex(value);
  if (!hex) return null;
  // `className` is the alpha-stripped utility, which is also the key the
  // override tables in index.css are written against (`text-amber-400/90`
  // resolves through the `text-amber-400` override).
  return { prop: m[1], dark, state, hex, alpha, className: base.replace(/\/\d+$/, ''), raw: base };
}

const tokenCache = new Map();

function resolveTokens(body) {
  const cached = tokenCache.get(body);
  if (cached) return cached;
  const map = new Map();
  for (const raw of body.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
    const token = raw.replace(/['"`]/g, '');
    if (!token) continue;
    const parsed = parseToken(token);
    if (!parsed) continue;
    const key = `${parsed.prop}|${parsed.state}`;
    const slot = map.get(key) ?? {};
    if (parsed.dark) slot.dark = parsed;
    else slot.light = parsed;
    map.set(key, slot);
  }
  tokenCache.set(body, map);
  return map;
}

/** Resolve a token for one mode: pick the mode's variant, then the other. */
function pick(slot, mode) {
  if (!slot) return null;
  return mode === 'dark' ? (slot.dark ?? slot.light) : (slot.light ?? slot.dark);
}

const textSize = (body) => {
  const arbitrary = body.match(/text-\[(\d+)px\]/);
  if (arbitrary) return Number(arbitrary[1]);
  const named = body.match(/\btext-(xs|sm|base|lg|xl|\dxl)\b/);
  const table = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36, '5xl': 48, '6xl': 60, '7xl': 72 };
  return named ? (table[named[1]] ?? 14) : 14;
};

/* ------------------------------------------------------------------ *
 * Check
 * ------------------------------------------------------------------ */

const PAGE_BACKGROUND = { dark: '#0a0e16', light: '#ffffff' };

/**
 * Resolve the opaque background an element sits on, compositing any
 * translucent fill over whatever it inherits. Returns `null` when the element
 * has no resolvable background of its own or above it.
 */
function resolveBackground(element, mode, tables, cache) {
  if (!element) return null;
  const cached = cache.get(element);
  if (cached !== undefined) return cached;

  let result = null;
  for (const body of classNamesOf(element.attrs)) {
    const candidate = pick(resolveTokens(body).get('bg|'), mode);
    if (!candidate) continue;
    const colour = tables[mode].bg.get(candidate.className) ?? { hex: candidate.hex, alpha: candidate.alpha };
    if (colour.alpha >= 1) {
      result = { hex: colour.hex, origin: 'own background' };
    } else {
      const below = resolveBackground(element.parent, mode, tables, cache)
        ?? { hex: PAGE_BACKGROUND[mode], origin: 'page background' };
      result = { hex: composite(colour, below.hex), origin: `own background over ${below.origin}` };
    }
    break;
  }

  if (!result && element.parent) {
    const inherited = resolveBackground(element.parent, mode, tables, cache);
    if (inherited) result = { hex: inherited.hex, origin: 'inherited background' };
  }

  cache.set(element, result);
  return result;
}

function checkMode(mode, tables) {
  const failures = [];
  const review = [];
  const files = readdirSync(COMPONENT_DIR).filter((f) => f.endsWith('.tsx'));

  for (const file of files) {
    const src = readFileSync(join(COMPONENT_DIR, file), 'utf8');
    const cache = new Map();

    walkTree(src, (element) => {
      for (const body of classNamesOf(element.attrs)) {
        // Inside a `.dark-isolate` the light theme keeps the dark palette, so
        // resolve those colours with the dark table instead.
        const effective = mode === 'light' && element.isolate ? 'dark' : mode;

        const rawText = pick(resolveTokens(body).get('text|'), effective);
        if (!rawText) continue;
        if (rawText.alpha < 0.9) {
          review.push({ file, line: element.line, body, why: 'translucent text colour' });
          continue;
        }
        const textHex = tables[effective].text.get(rawText.className)?.hex ?? rawText.hex;

        const background = resolveBackground(element, effective, tables, cache)
          ?? { hex: PAGE_BACKGROUND[effective], origin: 'page background' };

        const size = textSize(body);
        const required = size >= 24 ? 3 : 4.5;
        const ratio = contrast(textHex, background.hex);
        if (ratio >= required) continue;

        failures.push({
          file, line: element.line, ratio, required, size,
          text: rawText.raw, textHex, surface: background.hex, origin: background.origin,
          body: body.replace(/\s+/g, ' ').trim(),
        });
      }
    });
  }

  return { failures, review };
}

/* ------------------------------------------------------------------ */

const tables = parseOverrides(readFileSync(CSS_FILE, 'utf8'));
console.log(
  `index.css overrides: light ${tables.light.text.size} text / ${tables.light.bg.size} bg, ` +
  `dark ${tables.dark.text.size} text / ${tables.dark.bg.size} bg\n`
);

let total = 0;
for (const mode of ['dark', 'light']) {
  const { failures, review } = checkMode(mode, tables);

  for (const r of review) {
    console.log(`  review  ${r.file}:${r.line}  ${r.why}`);
    console.log(`          ${r.body.slice(0, 100)}`);
  }
  if (review.length) console.log('');

  if (!failures.length) {
    console.log(`${mode}: no contrast failures\n`);
    continue;
  }

  total += failures.length;
  const byFile = new Map();
  for (const f of failures) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }

  console.log(`${mode}: ${failures.length} contrast failure(s) across ${byFile.size} file(s)\n`);
  for (const [file, list] of byFile) {
    console.log(`  ${file}  (${list.length})`);
    for (const f of list.slice(0, VERBOSE ? list.length : PER_FILE)) {
      console.log(`    :${f.line}  ${f.text} ${f.textHex} on ${f.surface} = ${f.ratio.toFixed(2)}:1 (needs ${f.required} @${f.size}px, ${f.origin})`);
      console.log(`        ${f.body.slice(0, 100)}`);
    }
    if (!VERBOSE && list.length > PER_FILE) console.log(`    ... and ${list.length - PER_FILE} more`);
    console.log('');
  }
}

if (total) {
  console.error(`check-contrast: ${total} failure(s).`);
  console.error('Fix by darkening the text, lightening the surface, or adding a `dark:` variant.');
  process.exit(1);
}

console.log('check-contrast: all text meets WCAG AA in both themes.');
