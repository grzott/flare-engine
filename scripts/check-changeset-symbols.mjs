/**
 * check-changeset-symbols — every backticked symbol a pending changeset or ADR
 * names must actually resolve against a real package surface. A changeset
 * naming `QueryBuiIder` (typo) or a symbol nobody ever exported ships that
 * error to every consumer, permanently, in the document they read to decide
 * whether to upgrade — the published `0.4.0` changelog is built from these
 * files verbatim.
 *
 * BE HONEST ABOUT THE LIMIT: this catches names that do not resolve to
 * anything. It does NOT catch a claim that is wrong about *behaviour* — e.g.
 * "returns null when apart" when the code actually throws. That failure class
 * (the one that bit Arc PFA four times) needs a human reader, not this gate.
 * See `AGENTS.md`'s "An audit finding's prose is an argument, not a
 * measurement" for the rule this script mechanises one slice of.
 *
 * ---------------------------------------------------------------------------
 * THE EXTRACTION HEURISTIC (the whole design — tuned against the 24 real
 * pending changesets and 4 real ADRs, see the task-16 report for the full
 * trace)
 * ---------------------------------------------------------------------------
 * A backtick span in these files holds a symbol about as often as it holds a
 * file path, a shell command, a version, a flag, a package name, a type
 * expression, an error string, or ordinary prose ("sorted", "type", "error").
 * A candidate must survive, in order:
 *
 *  1. Truncate at the first `(` — `Prefab.spawn(world)` and
 *     `wasButtonReleased(state, button)` are call-form references; the
 *     argument list is discarded before anything else is checked, so commas
 *     and paths *inside* the parens never leak into later rejections.
 *  2. Collapse a trailing generic — `SpatialEntry<T>` -> `SpatialEntry`,
 *     `Set<number>` -> `Set` — before anything else, for the same reason.
 *  3. Strip a trailing `[]` array marker.
 *  4. Reject a filename: the final dotted segment is a known extension
 *     (`AGENTS.md`, `api-specs.md`, `curves.ts`, `index.ts`).
 *  5. Reject anything with `/` (a path), `-` (a flag, an env-var-with-hyphen,
 *     a kebab package/file name — no JS identifier ever contains one), or
 *     whitespace (a command or a prose phrase — this is what's left of
 *     `new QueryBuilder()` after step 1 only strips the *trailing* call).
 *  6. Require the identifier/member-path shape:
 *     `head(.member|#member)*`, each segment `[A-Za-z_$][\w$]*`. This is
 *     also what rejects `:246`, `?? 0`, `0.3.1`, `^0.3.x`, `--registry` and
 *     `@flare-engine/ecs` outright — none start with a legal identifier char.
 *  7. Reject a single character (`T`, `n`, `z` — generic-parameter/loop-var
 *     prose, never a real export here).
 *  8. A DOTTED candidate must have an uppercase-starting head. `Query.entities`
 *     and `Prefab.spawn` read as type/class member access; `grid.data`,
 *     `entitlementStore.grant`, `scene.camera`, `Date.now`, `console.log` read
 *     as *instance* access in a usage example — the head is a local variable
 *     or a JS/DOM builtin, never a symbol this repo could export. This single
 *     rule is the highest-leverage cut: it silently removes the entire class
 *     of "illustrating a call on some instance" prose without a denylist.
 *  9. A BARE (no-dot) candidate that is pure lowercase letters (`ecs`,
 *     `render`, `physics`, `solid`, `collision`, `shape`, `world`, `error`,
 *     `constructor`, `type`, `sorted`...) is rejected as ordinary English/
 *     jargon prose. This also quietly disposes of every TS primitive type
 *     keyword (`number`, `string`, `boolean`, `undefined`, `null`, `void`)
 *     without a dedicated list. A real camelCase export always has an
 *     interior capital (`scaleToLengthInto`, `parseTiled`, `definePrefab`),
 *     so this never eats a real symbol in this codebase's naming convention.
 * 10. Reject a name in `AMBIENT` (below) — see that constant's comment.
 *
 * WHAT THIS HEURISTIC CANNOT DO: a bare camelCase name that happens to share
 * its shape with both "our export" and "someone else's API" (`useTimeScrub`
 * vs `useAnimatedStyle`) is structurally indistinguishable without a curated
 * list or a real resolve. `AMBIENT` covers the closed, stable set (JS/DOM/TS
 * builtins, test-matcher vocabulary) plus the peer-framework names this
 * repo's own ADRs discuss for interop (Reanimated/worklets/gesture-handler/
 * safe-area-context/Skia). A one-off third-party name outside that list
 * (`LegacySurfaceTexture`, an RN-Skia Android log-tag) will still be flagged
 * — correctly, in the sense that it is not a Flare export, but not usefully,
 * in the sense that nobody claimed it was. That is what `symbols-ok` is for.
 *
 * ---------------------------------------------------------------------------
 * REMOVALS ARE NOT A FAILURE (the crux)
 * ---------------------------------------------------------------------------
 * Several pending changesets correctly announce that a symbol was DELETED —
 * `ShopPanel`, `SpatialEntry`, `TileData`, `MemoryLeaderboards`,
 * `resetKeyboardFrame`, `_WorldQueryBuilder`, `World._registerQuery`,
 * `entitlementKey`. Their names correctly no longer resolve at HEAD; that is
 * not a defect in the changeset.
 *
 * This gate resolves a candidate against the UNION of two surfaces:
 *   - HEAD's built surface — every publishable package's `dist/index.d.ts`
 *     (or `.d.mts`), parsed for its top-level `export { ... }` list and, more
 *     leniently, every indented `name:`/`name(` line in the file (a flat,
 *     un-scoped "member name" set — good enough for `Vec2.scaleToLengthInto`
 *     or `Prefab.spawn` without a real type checker; see the report for what
 *     that flatness costs).
 *   - The last published release tag's SOURCE (every `packages/<pkg>/src` file, read via
 *     `git show <tag-commit>:<path>`, not rebuilt), regex-scanned for the same
 *     two things. This is a best-effort, NOT a compile — it can under-match
 *     (a barrel indirection it doesn't chase, an enum body it doesn't parse)
 *     but that only makes the gate MORE lenient, never less: it can rescue a
 *     genuine removal it fails to see as clearly, never hide a genuine typo,
 *     because a typo would have to coincidentally collide with some name that
 *     really existed at the baseline.
 *
 * Why the last release tag and not a merge-base commit: every pending
 * changeset in `.changeset/` describes a change made since the last publish
 * (this is exactly `check-changeset.mjs`'s own baseline), and this repo
 * versions all 42 packages in lockstep, so one tag is the correct baseline
 * for every package uniformly. `dist/` is gitignored (never committed), so
 * the baseline's BUILT output cannot be read back — only its source can.
 *
 * What this still cannot catch: a symbol removed, and ALSO never present at
 * the baseline release (e.g. a typo of an already-unpublished internal name)
 * would incorrectly resolve if some OTHER type happens to have a
 * same-named member — the member set is a flat, package-wide union, not
 * scoped per parent type. Not observed in the real 28 files this shipped
 * against; documented as a known gap rather than solved, because solving it
 * needs a real type checker, not a text scan.
 *
 * ---------------------------------------------------------------------------
 * THE ESCAPE HATCH
 * ---------------------------------------------------------------------------
 * `<!-- symbols-ok: FooBar, baz.qux -->` anywhere in a file skips those exact
 * names in that file only. This exists so a prose noun that this heuristic
 * cannot structurally rule out (a one-off third-party name, an internal
 * non-exported identifier named for context) is DECLARED, not silently
 * ignored — an unknown name must be either fixed or acknowledged.
 *
 * Not wired into `.claude/hooks/verify.sh` or CI — ships as a script the
 * owner runs; adding it to the gate sequence is a separate decision.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { git, gitLines } from './lib/git.mjs';
import { discoverPublishTargets, REPO_ROOT } from './lib/pack.mjs';

// ---------------------------------------------------------------------------
// Ambient / third-party names — see "WHAT THIS HEURISTIC CANNOT DO" above.
// Grouped and commented so a future addition states which bucket it is in,
// rather than growing into an unexplained pile.
// ---------------------------------------------------------------------------
export const AMBIENT = new Set([
  // ECMAScript / Node / DOM globals, prototypes and typed arrays. Closed,
  // stable set — a Flare package never re-exports one of these under its own
  // name, so treating the name as ambient is always correct, not just usually.
  'Array',
  'Object',
  'Date',
  'Math',
  'JSON',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Promise',
  'RegExp',
  'Error',
  'TypeError',
  'RangeError',
  'Number',
  'String',
  'Boolean',
  'Symbol',
  'Reflect',
  'Proxy',
  'Buffer',
  'Function',
  'ArrayBuffer',
  'DataView',
  'BigInt',
  'console',
  'globalThis',
  'NaN',
  'Infinity',
  'Uint8Array',
  'Uint16Array',
  'Uint32Array',
  'Int8Array',
  'Int16Array',
  'Int32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'addEventListener',
  'removeEventListener',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'indexOf',
  'toString',
  'isArray',
  '__DEV__',
  // TypeScript utility types — never something a package exports under its
  // own name; referenced constantly when explaining a signature change.
  'Record',
  'Partial',
  'Required',
  'Readonly',
  'Pick',
  'Omit',
  'Exclude',
  'Extract',
  'ReturnType',
  'Parameters',
  'InstanceType',
  'Awaited',
  'NonNullable',
  // bun:test / Jest-style matcher & runner vocabulary, referenced in prose
  // when a changeset or ADR cites the test that pins a behaviour.
  'toBe',
  'toEqual',
  'toStrictEqual',
  'toThrow',
  'toHaveBeenCalled',
  'toContain',
  'describe',
  'expect',
  // Peer-framework APIs this repo's own ADRs/changesets name for interop
  // (React, Reanimated, worklets, gesture-handler, safe-area-context,
  // react-native-skia) — never a Flare export, but structurally identical
  // in shape to one. Curated from the real files (ADR-0001, ADR-0002, PF-7,
  // PF-8), not guessed; extend the same way — read what the gate flags.
  'React',
  'Children',
  'useContext',
  'useAnimatedStyle',
  'useDerivedValue',
  'useSharedValue',
  'withSpring',
  'withTiming',
  'runOnUI',
  'scheduleOnUI',
  'ErrorUtils',
  'GestureDetector',
  'useSafeAreaInsets',
  'SafeAreaProvider',
  'Skia',
  // `Math.*` method names this numerics-heavy repo's own prose references
  // bare (without the `Math.` prefix a dotted reference would need — see
  // rule 8 above). Only added when the real files actually do this; kept
  // narrow rather than pre-listing every `Math` method.
  'atan2',
]);

const KNOWN_EXTENSIONS =
  /\.(ts|tsx|js|jsx|mjs|cjs|json|md|ya?ml|toml|css|s?html?|svg|png|jpe?g|gif|lock)$/i;
const GENERIC_SUFFIX_RE = /^([A-Za-z_$][\w$]*(?:[.#][A-Za-z_$][\w$]*)*)<.*>$/;
const SHAPE_RE = /^[A-Za-z_$][\w$]*(?:[.#][A-Za-z_$][\w$]*)*$/;
const BACKTICK_RE = /`([^`\n]+)`/g;
const ALL_LOWERCASE_RE = /^[a-z]+$/;

/**
 * Pull candidate symbol references out of `text`. Returns one entry per
 * unique surviving candidate, in first-seen order, with the raw backtick
 * span kept for the failure report's context.
 */
export function extractCandidates(text) {
  const seen = new Set();
  const out = [];
  for (const m of text.matchAll(BACKTICK_RE)) {
    const raw = m[1];
    let s = raw.trim();
    if (!s) continue;

    const parenIdx = s.indexOf('(');
    if (parenIdx !== -1) s = s.slice(0, parenIdx).trim();
    if (!s) continue;

    const generic = GENERIC_SUFFIX_RE.exec(s);
    if (generic) s = generic[1];

    while (s.endsWith('[]')) s = s.slice(0, -2);
    if (!s) continue;

    const lastDot = s.lastIndexOf('.');
    if (lastDot !== -1 && KNOWN_EXTENSIONS.test(s.slice(lastDot))) continue;
    if (s.includes('/') || s.includes('-') || /\s/.test(s)) continue;
    if (!SHAPE_RE.test(s)) continue;
    if (s.length === 1) continue;

    const hasDot = s.includes('.') || s.includes('#');
    const head = hasDot ? s.split(/[.#]/)[0] : s;

    if (hasDot && !/^[A-Z]/.test(head)) continue; // instance access, not a type/class reference
    if (!hasDot && ALL_LOWERCASE_RE.test(s)) continue; // bare common-word / TS primitive keyword
    if (AMBIENT.has(head)) continue;

    if (seen.has(s)) continue;
    seen.add(s);
    out.push({ raw, candidate: s, hasDot });
  }
  return out;
}

const SYMBOLS_OK_RE = /<!--\s*symbols-ok:\s*([^>]*?)\s*-->/g;

/** Names a file explicitly declares as intentional non-symbols. */
export function parseSymbolsOk(text) {
  const out = new Set();
  for (const m of text.matchAll(SYMBOLS_OK_RE)) {
    for (const part of m[1].split(',')) {
      const name = part.trim();
      if (name) out.add(name);
    }
  }
  return out;
}

const EXPORT_BLOCK_RE = /export\s+(?:type\s+)?\{([^}]*)\}/g;

/** One export specifier ("type X", "X as Y", "type X as Y") -> the public name. */
function publicNameOf(specifier) {
  let s = specifier.trim();
  if (!s) return null;
  s = s.replace(/^type\s+/, '');
  const asIdx = s.indexOf(' as ');
  if (asIdx !== -1) s = s.slice(asIdx + 4).trim();
  return /^[A-Za-z_$][\w$]*$/.test(s) ? s : null;
}

/** Every top-level exported name declared by a bundled `export { ... }` list. */
export function parseExportedNames(distText) {
  const names = new Set();
  for (const m of distText.matchAll(EXPORT_BLOCK_RE)) {
    for (const part of m[1].split(',')) {
      const name = publicNameOf(part);
      if (name) names.add(name);
    }
  }
  return names;
}

const MEMBER_LINE_RE =
  /^[ \t]+(?:private\s+|protected\s+|public\s+|static\s+|readonly\s+|abstract\s+|override\s+|async\s+|get\s+|set\s+|\*\s*)*([A-Za-z_$][\w$]*)\s*[:(?]/;

// A parameter name inside a signature: preceded by `(` or `,`, optionally
// followed by `?`, then `:`. Catches a bare-referenced parameter like
// `elapsedSinceDown` in `pointerUp(x, y, elapsedSinceDown?: number)`, which
// the line-anchored MEMBER_LINE_RE above misses (it only takes the first
// identifier on a line, and multi-param signatures are one line each).
const PARAM_RE = /[(,]\s*([A-Za-z_$][\w$]*)\??\s*:/g;

/**
 * Every indented `name:` / `name(` line, plus every signature parameter name,
 * in a `.d.ts` or `.ts` text — a flat, un-scoped set of interface/class/
 * object-type member and parameter names. Cheap and deliberately imprecise:
 * see the header comment on what that flatness costs.
 */
export function parseMemberNames(text) {
  const names = new Set();
  for (const line of text.split('\n')) {
    const m = MEMBER_LINE_RE.exec(line);
    if (m) names.add(m[1]);
  }
  for (const m of text.matchAll(PARAM_RE)) names.add(m[1]);
  return names;
}

// A top-level declaration, `export` and `declare` both optional, so a
// name that is real but never reached the public surface (an internal
// helper mentioned for context, like `applyDeadZone`, or a since-deleted
// internal class, like `_WorldQueryBuilder`) still counts as "exists" —
// see the header comment's "REMOVALS ARE NOT A FAILURE" section for why
// that is the deliberately lenient direction to err in. `^` is anchored
// per-line (`m` flag): every sample in this codebase, built or source,
// declares top-level names at column 0.
const DECLARED_NAME_RE =
  /^(?:export\s+)?(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\s*\*?|class|interface|enum|const|let|var|type)\s+([A-Za-z_$][\w$]*)/gm;

/**
 * Every top-level declared name in a `.ts`/`.d.ts` text, whether or not it is
 * exported, unioned with the barrel-style `export { ... }` list. Used for
 * both HEAD (current source + built `dist/`) and the baseline release
 * (source only — `dist/` is gitignored and cannot be read back at an old
 * commit).
 */
export function parseDeclaredNames(text) {
  const names = parseExportedNames(text);
  for (const m of text.matchAll(DECLARED_NAME_RE)) names.add(m[1]);
  return names;
}

/**
 * Does `candidate` resolve against the given export/member sets? A dotted
 * path requires its head in `exportSet` and every remaining segment in
 * `memberSet` (the member set is flat/un-scoped — see header comment).
 */
export function resolveCandidate(candidate, hasDot, exportSet, memberSet) {
  if (!hasDot) return exportSet.has(candidate) || memberSet.has(candidate);
  const segments = candidate.split(/[.#]/);
  if (!exportSet.has(segments[0])) return false;
  return segments.slice(1).every((seg) => memberSet.has(seg));
}

const DIST_CANDIDATES = ['index.d.ts', 'index.d.mts'];

/** The package's built declaration file, or `null` if it has not been built. */
export function findDistFile(pkgDir) {
  for (const name of DIST_CANDIDATES) {
    const p = join(pkgDir, 'dist', name);
    if (existsSync(p)) return p;
  }
  return null;
}

/** Publishable packages with no built declaration file — the loud-failure input. */
export function findUnbuiltPackages(targets) {
  return targets.filter((t) => findDistFile(t.dir) === null);
}

/** Every `.ts`/`.tsx` file under `dir` (recursive), or `[]` if `dir` does not exist. */
function walkTsFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => join(dir, f));
}

/**
 * HEAD's global export/member surface across every publishable package:
 * each package's built `dist/index.d.ts` (authoritative for what a consumer
 * can actually import) UNIONED with its current `src/**` (so a real,
 * currently-present identifier that never reached the public surface — an
 * internal helper named for context — still resolves; see the header
 * comment's "REMOVALS ARE NOT A FAILURE" section).
 */
export function buildHeadSurface(targets) {
  const exportSet = new Set();
  const memberSet = new Set();
  for (const t of targets) {
    const distFile = findDistFile(t.dir);
    if (!distFile) continue; // caller must have already failed loudly on this
    const distText = readFileSync(distFile, 'utf8');
    for (const name of parseDeclaredNames(distText)) exportSet.add(name);
    for (const name of parseMemberNames(distText)) memberSet.add(name);

    for (const file of walkTsFiles(join(t.dir, 'src'))) {
      const srcText = readFileSync(file, 'utf8');
      for (const name of parseDeclaredNames(srcText)) exportSet.add(name);
      for (const name of parseMemberNames(srcText)) memberSet.add(name);
    }
  }
  return { exportSet, memberSet };
}

/**
 * The commit of the newest `@flare-engine/*@*` release tag — the same
 * baseline `check-changeset.mjs` uses. Every pending changeset describes a
 * change since this point, and lockstep versioning means one tag is the
 * correct baseline for every package. `null` when no release tag exists yet.
 */
export function resolveBaselineCommit() {
  const tag = gitLines(
    'for-each-ref',
    '--sort=-creatordate',
    '--format=%(refname:short)',
    'refs/tags/@flare-engine/*@*',
  )[0];
  if (!tag) return null;
  const sha = git('rev-list', '-n', '1', tag);
  return sha || null;
}

/**
 * Best-effort baseline export/member surface, read from `packages/*\/src` AT
 * the given commit (never rebuilt — see header comment on why this is
 * deliberately lenient rather than exact).
 */
export function buildBaselineSurface(targets, baselineCommit) {
  const exportSet = new Set();
  const memberSet = new Set();
  if (!baselineCommit) return { exportSet, memberSet };
  for (const t of targets) {
    const relDir = `packages/${basename(t.dir)}/src`;
    const files = gitLines('ls-tree', '-r', '--name-only', baselineCommit, '--', relDir);
    for (const file of files) {
      if (!/\.tsx?$/.test(file)) continue;
      const content = git('show', `${baselineCommit}:${file}`);
      if (!content) continue;
      for (const name of parseDeclaredNames(content)) exportSet.add(name);
      for (const name of parseMemberNames(content)) memberSet.add(name);
    }
  }
  return { exportSet, memberSet };
}

/** `.changeset/*.md` (except README) and `docs/design/adr-*.md` (except the template). */
export function collectInputFiles() {
  const files = [];
  const changesetDir = join(REPO_ROOT, '.changeset');
  for (const name of readdirSync(changesetDir).sort()) {
    if (!name.endsWith('.md') || name === 'README.md') continue;
    files.push(join(changesetDir, name));
  }
  const designDir = join(REPO_ROOT, 'docs', 'design');
  for (const name of readdirSync(designDir).sort()) {
    if (!/^adr-\d+.*\.md$/i.test(name) || name === 'adr-0000-template.md') continue;
    files.push(join(designDir, name));
  }
  return files;
}

if (import.meta.main) {
  const targets = discoverPublishTargets();

  const unbuilt = findUnbuiltPackages(targets);
  if (unbuilt.length > 0) {
    console.error('check-changeset-symbols: FAILED — missing build output for:');
    for (const t of unbuilt) console.error(`  ${t.name}`);
    console.error(
      '\nRun `bun run build` first — a gate that cannot see its input must not pass.\n',
    );
    process.exit(1);
  }

  const head = buildHeadSurface(targets);
  const baselineCommit = resolveBaselineCommit();
  const baseline = buildBaselineSurface(targets, baselineCommit);
  const exportSet = new Set([...head.exportSet, ...baseline.exportSet]);
  const memberSet = new Set([...head.memberSet, ...baseline.memberSet]);

  if (!baselineCommit) {
    console.log(
      'check-changeset-symbols: no release tag found — removals cannot be excused; every ' +
        'candidate is checked against HEAD only.\n',
    );
  }

  const inputFiles = collectInputFiles();
  const failures = [];
  let candidateCount = 0;

  for (const filePath of inputFiles) {
    const text = readFileSync(filePath, 'utf8');
    const escaped = parseSymbolsOk(text);
    const candidates = extractCandidates(text);
    for (const { raw, candidate, hasDot } of candidates) {
      candidateCount++;
      if (escaped.has(candidate)) continue;
      if (resolveCandidate(candidate, hasDot, exportSet, memberSet)) continue;
      failures.push({ file: filePath, candidate, raw });
    }
  }

  if (failures.length > 0) {
    console.error('check-changeset-symbols: FAILED — unresolved symbol(s):\n');
    for (const f of failures) {
      console.error(`  ${f.file}`);
      console.error(`    \`${f.raw}\` -> candidate \`${f.candidate}\` does not resolve.`);
      console.error(
        `    Fix: correct the name, or add \`<!-- symbols-ok: ${f.candidate} -->\` with a reason.\n`,
      );
    }
    process.exit(1);
  }

  console.log(
    `check-changeset-symbols: OK — ${candidateCount} candidate(s) across ${inputFiles.length} file(s), all resolved or acknowledged.`,
  );
  process.exit(0);
}
