import { pluralCategory } from './plurals.js';
import type { LocaleCode, MessageValues } from './types.js';

/**
 * Minimal ICU MessageFormat-ish parser.
 *
 * Grammar:
 *   text    := (chunk)*
 *   chunk   := literal | '{' var '}' | '{' var ',' 'plural' ',' branches '}'
 *   branches := (selector '{' text '}')+
 *   selector := '=' number | identifier   // one | few | many | other | zero | two
 *   number/ident literals inside a branch may reference '#' → the variable's number value.
 *
 * Nested plural blocks are not supported (not needed for our tables).
 */

export function formatMessage(
  template: string,
  values: MessageValues | undefined,
  locale: LocaleCode,
): string {
  const vals = values ?? {};
  let out = '';
  let i = 0;
  const len = template.length;
  while (i < len) {
    const ch = template[i];
    if (ch !== '{') {
      out += ch;
      i++;
      continue;
    }
    // Find the matching closing brace, respecting nested braces.
    const endIdx = findMatchingClose(template, i);
    if (endIdx === -1) {
      // Malformed — emit remainder literally.
      out += template.slice(i);
      break;
    }
    const inner = template.slice(i + 1, endIdx);
    out += renderPlaceholder(inner, vals, locale);
    i = endIdx + 1;
  }
  return out;
}

function findMatchingClose(src: string, startBrace: number): number {
  let depth = 0;
  for (let i = startBrace; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function renderPlaceholder(inner: string, values: MessageValues, locale: LocaleCode): string {
  // Split only on the top-level commas into at most 3 parts: name, type, body.
  const commaIdx = topLevelComma(inner);
  if (commaIdx === -1) {
    return stringifyValue(values[inner.trim()]);
  }
  const name = inner.slice(0, commaIdx).trim();
  const rest = inner.slice(commaIdx + 1).trim();
  const secondComma = topLevelComma(rest);
  if (secondComma === -1) return stringifyValue(values[name]);
  const type = rest.slice(0, secondComma).trim();
  const body = rest.slice(secondComma + 1).trim();
  if (type !== 'plural') {
    // Unknown formatter — fall back to raw substitution.
    return stringifyValue(values[name]);
  }
  const raw = values[name];
  const n = typeof raw === 'number' ? raw : Number(raw);
  const category = Number.isFinite(n) ? pluralCategory(locale, n) : 'other';
  const branches = parsePluralBranches(body);
  const branchText =
    branches[`=${Number.isFinite(n) ? n : ''}`] ?? branches[category] ?? branches.other ?? '';
  // '#' inside the branch refers to the numeric value.
  const replaced = branchText.replace(/#/g, Number.isFinite(n) ? String(n) : '');
  // Recurse so nested `{var}` inside the branch is resolved.
  return formatMessage(replaced, values, locale);
}

function topLevelComma(src: string): number {
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === ',' && depth === 0) return i;
  }
  return -1;
}

function parsePluralBranches(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < body.length) {
    // Skip whitespace.
    while (i < body.length) {
      const ch = body[i];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') i++;
      else break;
    }
    if (i >= body.length) break;
    // Read selector until whitespace or '{'.
    const selStart = i;
    while (i < body.length) {
      const ch = body[i];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '{') break;
      i++;
    }
    const selector = body.slice(selStart, i);
    while (i < body.length) {
      const ch = body[i];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') i++;
      else break;
    }
    if (body[i] !== '{') break;
    const end = findMatchingClose(body, i);
    if (end === -1) break;
    out[selector] = body.slice(i + 1, end);
    i = end + 1;
  }
  return out;
}

function stringifyValue(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v);
}
