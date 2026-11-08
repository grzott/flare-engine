/**
 * check-exported-types — prove that nothing a package's public API reaches is
 * declared in its built `.d.mts` without being exported. publint + attw
 * (`check-exports`) prove the `exports` map resolves; neither proves that what
 * an exported signature mentions is itself importable. #244 (seven hidden
 * types across debug/deep-links/input/share) and 8701b58d (dynamics
 * `BodyOptions`/`WorldOptions`) passed every gate with such holes.
 *
 * Per package: every `exports` entry's `import.types` file is parsed with the
 * TypeScript parser (parse only — no Program, no checker, so JSDoc prose and
 * `{@link}` tags are never mistaken for references), relative chunk imports
 * are followed, and the public set is what the ENTRY files export, resolved
 * through `export { a as b }` / `import { a as b }` aliases into the chunk
 * that declares each name. Each public declaration's AST is then walked for
 * identifiers in type positions (members, parameters, return and type
 * arguments, `extends`/`implements`, `typeof x`); one that resolves to a
 * top-level declaration of this package that is NOT public is a hole. Bare
 * package imports and `export * from "<package>"` are another package's
 * surface and are ignored. A hole is reported once per name, with every path
 * that reaches it. The walk continues into each unexported type it reaches, so
 * a type hidden inside another hidden type is reported in the same run as
 * `f via Outer`; it stops at allowlisted types.
 *
 * `ALLOWLIST` names the deliberate holes with a one-line reason. An entry that
 * is no longer reached fails the run, so the list cannot rot.
 *
 * Requires `bun run build` first (reads `dist/`). Usage:
 *   bun scripts/check-exported-types.mjs            # every publishable package
 *   bun scripts/check-exported-types.mjs <dir>...   # specific package dirs
 * Exit 0 = no holes · 1 = holes, stale allowlist entries, or a missing build.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES_DIR = join(ROOT, 'packages');
const IGNORE = new Set(['benchmarks']);

export const ALLOWLIST = [
  {
    pkg: '@flare-engine/assets',
    name: 'SkColorLike',
    reason: 'private alias of Float32Array; consumers pass a Float32Array',
  },
  {
    pkg: '@flare-engine/errors',
    name: 'ErrorBoundaryState',
    reason: 'React class component state, internal to ErrorBoundary',
  },
  {
    pkg: '@flare-engine/shapes',
    name: 'SkiaApi',
    reason: 'alias of `typeof Skia` (the RN-Skia module); its value is the module itself',
  },
];

const normalize = (path) => path.replaceAll('\\', '/');
const isRelative = (specifier) => specifier.startsWith('./') || specifier.startsWith('../');

/** `./x.mjs` → `./x.d.mts`, `./x.js` → `./x.d.ts`, `./x.cjs` → `./x.d.cts`. */
const declarationFileFor = (specifier) => {
  if (/\.d\.[cm]?ts$/.test(specifier)) return specifier;
  const m = /\.([cm]?)js$/.exec(specifier);
  if (m) return `${specifier.slice(0, -m[0].length)}.d.${m[1]}ts`;
  return `${specifier}.d.ts`;
};

const resolveSpecifier = (fromPath, specifier) =>
  posix.join(posix.dirname(fromPath), declarationFileFor(specifier));

const typesOfTarget = (target) => {
  if (!target || typeof target !== 'object') return undefined;
  if (target.import && typeof target.import === 'object' && typeof target.import.types === 'string')
    return target.import.types;
  if (typeof target.types === 'string') return target.types;
  return undefined;
};

/** Relative type-declaration entry paths a package manifest exposes, sorted and deduped. */
export const typesEntriesOf = (manifest) => {
  const out = new Set();
  const exportsField = manifest.exports;
  if (exportsField && typeof exportsField === 'object') {
    const subpaths = Object.keys(exportsField).filter((k) => k.startsWith('.'));
    if (subpaths.length === 0) {
      const t = typesOfTarget(exportsField);
      if (t) out.add(t);
    }
    for (const key of subpaths) {
      if (key === './package.json' || key.includes('*')) continue;
      const t = typesOfTarget(exportsField[key]);
      if (t) out.add(t);
    }
  }
  if (out.size === 0 && typeof manifest.types === 'string') out.add(manifest.types);
  return [...out].sort();
};

const isExported = (statement) => {
  const modifiers = ts.canHaveModifiers(statement) ? (ts.getModifiers(statement) ?? []) : [];
  let exported = false;
  for (const m of modifiers) {
    if (m.kind === ts.SyntaxKind.DefaultKeyword) return false;
    if (m.kind === ts.SyntaxKind.ExportKeyword) exported = true;
  }
  return exported;
};

const isNamedDeclaration = (statement) =>
  ts.isInterfaceDeclaration(statement) ||
  ts.isTypeAliasDeclaration(statement) ||
  ts.isClassDeclaration(statement) ||
  ts.isFunctionDeclaration(statement) ||
  ts.isEnumDeclaration(statement) ||
  ts.isModuleDeclaration(statement);

/**
 * One declaration file: its top-level declarations (local name → nodes, several
 * for overloads), its local export map (exported name → local name), its
 * relative named imports (local name → where they come from) and its relative
 * re-exports. Bare-package imports and re-exports are dropped here.
 */
const parseDeclarationFile = (path, text) => {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const decls = new Map();
  const exports = new Map();
  const imports = new Map();
  const reexports = [];
  const starReexports = [];
  const specifiers = new Set();

  const addDecl = (name, node, exported) => {
    const list = decls.get(name);
    if (list) list.push(node);
    else decls.set(name, [node]);
    if (exported) exports.set(name, name);
  };

  for (const statement of source.statements) {
    if (isNamedDeclaration(statement)) {
      if (statement.name && ts.isIdentifier(statement.name))
        addDecl(statement.name.text, statement, isExported(statement));
    } else if (ts.isVariableStatement(statement)) {
      const exported = isExported(statement);
      for (const d of statement.declarationList.declarations)
        if (ts.isIdentifier(d.name)) addDecl(d.name.text, d, exported);
    } else if (ts.isImportDeclaration(statement)) {
      if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const specifier = statement.moduleSpecifier.text;
      if (!isRelative(specifier)) continue;
      specifiers.add(specifier);
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const el of bindings.elements)
          imports.set(el.name.text, { specifier, importedName: (el.propertyName ?? el.name).text });
      }
    } else if (ts.isExportDeclaration(statement)) {
      const specifier =
        statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
          ? statement.moduleSpecifier.text
          : undefined;
      if (specifier !== undefined && !isRelative(specifier)) continue;
      if (specifier !== undefined) specifiers.add(specifier);
      const clause = statement.exportClause;
      if (clause && ts.isNamedExports(clause)) {
        for (const el of clause.elements) {
          const exportedName = el.name.text;
          const localName = (el.propertyName ?? el.name).text;
          if (specifier === undefined) exports.set(exportedName, localName);
          else reexports.push({ specifier, exportedName, importedName: localName });
        }
      } else if (!clause && specifier !== undefined) {
        starReexports.push(specifier);
      }
    }
  }
  return { path, decls, exports, imports, reexports, starReexports, specifiers };
};

/** Parse the entry files and every relative module they reach, each once. */
const loadFiles = (entryPaths, read) => {
  const files = new Map();
  const queue = entryPaths.map(normalize);
  while (queue.length > 0) {
    const path = queue.shift();
    if (files.has(path)) continue;
    const text = read(path);
    if (text === undefined) throw new Error(`types file not found: ${path}`);
    const model = parseDeclarationFile(path, text);
    files.set(path, model);
    for (const specifier of model.specifiers) queue.push(resolveSpecifier(path, specifier));
  }
  return files;
};

const declKey = (target) => `${target.file.path}\0${target.name}`;

/** Where `localName` as seen inside `file` is declared, or undefined for a bare import / global. */
const resolveLocal = (files, file, localName, seen) => {
  if (file.decls.has(localName)) return { file, name: localName };
  const imported = file.imports.get(localName);
  if (!imported) return undefined;
  const target = files.get(resolveSpecifier(file.path, imported.specifier));
  return target ? resolveExport(files, target, imported.importedName, seen) : undefined;
};

/** Where the name `file` exports as `exportedName` is declared, following aliases across chunks. */
const resolveExport = (files, file, exportedName, seen = new Set()) => {
  const key = `${file.path}\0${exportedName}`;
  if (seen.has(key)) return undefined;
  seen.add(key);
  const local = file.exports.get(exportedName);
  if (local !== undefined) return resolveLocal(files, file, local, seen);
  for (const re of file.reexports) {
    if (re.exportedName !== exportedName) continue;
    const target = files.get(resolveSpecifier(file.path, re.specifier));
    if (target) return resolveExport(files, target, re.importedName, seen);
  }
  for (const specifier of file.starReexports) {
    const target = files.get(resolveSpecifier(file.path, specifier));
    const found = target && resolveExport(files, target, exportedName, seen);
    if (found) return found;
  }
  return undefined;
};

const exportedNamesOf = (files, file, seen = new Set()) => {
  if (seen.has(file.path)) return [];
  seen.add(file.path);
  const names = new Set(file.exports.keys());
  for (const re of file.reexports) names.add(re.exportedName);
  for (const specifier of file.starReexports) {
    const target = files.get(resolveSpecifier(file.path, specifier));
    if (target) for (const n of exportedNamesOf(files, target, seen)) names.add(n);
  }
  return [...names].sort();
};

/** Leftmost identifier of `a.b.c` / `a.b.c` type names, or undefined. */
const leftmostIdentifier = (expr) => {
  let node = expr;
  while (ts.isQualifiedName(node) || ts.isPropertyAccessExpression(node))
    node = ts.isQualifiedName(node) ? node.left : node.expression;
  return ts.isIdentifier(node) ? node.text : undefined;
};

// The callback must not return a value: a truthy return short-circuits forEachChild.
const inferNamesIn = (node, out) => {
  if (ts.isInferTypeNode(node)) out.push(node.typeParameter.name.text);
  ts.forEachChild(node, (child) => {
    inferNamesIn(child, out);
  });
};

const blockDeclaredNames = (block) => {
  const names = [];
  for (const statement of block.statements) {
    if (isNamedDeclaration(statement) && statement.name && ts.isIdentifier(statement.name))
      names.push(statement.name.text);
    else if (ts.isVariableStatement(statement))
      for (const d of statement.declarationList.declarations)
        if (ts.isIdentifier(d.name)) names.push(d.name.text);
  }
  return names;
};

/**
 * Identifiers in type positions under `root`: `TypeReference` names,
 * heritage-clause expressions and `typeof x` queries (leftmost identifier of a
 * qualified name). Type parameters, `infer` names, mapped-type keys and
 * namespace-local declarations in scope at the use site are skipped.
 */
const collectTypeReferences = (root, out) => {
  const visit = (node, scope) => {
    const introduced = [];
    if (Array.isArray(node.typeParameters))
      for (const tp of node.typeParameters) introduced.push(tp.name.text);
    if (ts.isMappedTypeNode(node)) introduced.push(node.typeParameter.name.text);
    if (ts.isConditionalTypeNode(node)) inferNamesIn(node.extendsType, introduced);
    if (ts.isModuleBlock(node)) introduced.push(...blockDeclaredNames(node));
    const inner = introduced.length > 0 ? new Set([...scope, ...introduced]) : scope;

    const record = (name) => {
      if (name !== undefined && !inner.has(name)) out.add(name);
    };
    const visitArgs = (args) => {
      if (args) for (const arg of args) visit(arg, inner);
    };

    if (ts.isTypeReferenceNode(node)) {
      record(leftmostIdentifier(node.typeName));
      visitArgs(node.typeArguments);
    } else if (ts.isExpressionWithTypeArguments(node)) {
      record(leftmostIdentifier(node.expression));
      visitArgs(node.typeArguments);
    } else if (ts.isTypeQueryNode(node)) {
      record(leftmostIdentifier(node.exprName));
      visitArgs(node.typeArguments);
    } else {
      ts.forEachChild(node, (child) => visit(child, inner));
    }
  };
  visit(root, new Set());
  return out;
};

/**
 * Analyze one package. `entryPaths` are its `exports` types files; `read`
 * returns a file's text or undefined when it does not exist (the analysis then
 * throws naming the missing path). Returns the non-allowlisted holes, sorted by
 * name with sorted `reachedFrom` public names; the allowlisted names that were
 * reached; and the allowlist entries for this package that were not.
 */
export const analyzePackage = ({ name, entryPaths, read, allowlist = ALLOWLIST }) => {
  const files = loadFiles(entryPaths, read);
  const publicDecls = new Map();
  for (const entryPath of [...entryPaths].map(normalize).sort()) {
    const entry = files.get(entryPath);
    for (const exportedName of exportedNamesOf(files, entry)) {
      const target = resolveExport(files, entry, exportedName);
      if (!target) continue;
      const key = declKey(target);
      if (!publicDecls.has(key)) publicDecls.set(key, { ...target, exportedName });
    }
  }

  const allowed = new Set(allowlist.filter((e) => e.pkg === name).map((e) => e.name));

  // Breadth-first from the public declarations into every unexported one they reach, so a
  // type hidden inside another hidden type is found in the same run. `chain` holds the
  // unexported declarations walked so far: it names the path and breaks cycles.
  const reached = new Map();
  const descended = new Set();
  const queue = [...publicDecls.values()].map(({ file, name: localName, exportedName }) => ({
    file,
    localName,
    root: exportedName,
    chain: [],
  }));
  while (queue.length > 0) {
    const { file, localName, root, chain } = queue.shift();
    const path = chain.length > 0 ? `${root} via ${chain.join(' > ')}` : root;
    const refs = new Set();
    for (const node of file.decls.get(localName)) collectTypeReferences(node, refs);
    for (const ref of refs) {
      const target = resolveLocal(files, file, ref, new Set());
      if (!target || publicDecls.has(declKey(target)) || chain.includes(target.name)) continue;
      const from = reached.get(target.name);
      if (from) from.add(path);
      else reached.set(target.name, new Set([path]));
      const key = declKey(target);
      if (allowed.has(target.name) || descended.has(key)) continue;
      descended.add(key);
      queue.push({
        file: target.file,
        localName: target.name,
        root,
        chain: [...chain, target.name],
      });
    }
  }

  const holes = [];
  const allowlisted = [];
  for (const holeName of [...reached.keys()].sort()) {
    if (allowed.has(holeName)) allowlisted.push(holeName);
    else holes.push({ name: holeName, reachedFrom: [...reached.get(holeName)].sort() });
  }
  const stale = [...allowed].filter((n) => !reached.has(n)).sort();
  return { holes, allowlisted, stale };
};

const discoverPackages = () => {
  const dirs = [];
  for (const dir of readdirSync(PACKAGES_DIR).sort()) {
    const pj = join(PACKAGES_DIR, dir, 'package.json');
    if (!existsSync(pj) || IGNORE.has(dir)) continue;
    if (JSON.parse(readFileSync(pj, 'utf8')).name) dirs.push(join(PACKAGES_DIR, dir));
  }
  return dirs;
};

const readIfExists = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined);

if (import.meta.main) {
  const args = process.argv.slice(2);
  const dirs = args.length > 0 ? args.map((a) => resolve(process.cwd(), a)) : discoverPackages();
  let holeCount = 0;
  let staleCount = 0;
  let allowlistedCount = 0;

  for (const dir of dirs) {
    const pj = join(dir, 'package.json');
    if (!existsSync(pj)) {
      console.error(`check-exported-types: ${dir} has no package.json.`);
      process.exit(1);
    }
    const manifest = JSON.parse(readFileSync(pj, 'utf8'));
    const name = manifest.name ?? dir;
    const entries = typesEntriesOf(manifest);
    if (entries.length === 0) {
      console.error(`check-exported-types: ${name} declares no types entry in its exports map.`);
      process.exit(1);
    }
    const entryPaths = entries.map((rel) => join(dir, rel));
    let report;
    try {
      report = analyzePackage({ name, entryPaths, read: readIfExists });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`check-exported-types: ${name}: ${message} — run \`bun run build\` first.`);
      process.exit(1);
    }
    for (const hole of report.holes)
      console.error(`${name}: ${hole.name} (reached from ${hole.reachedFrom.join(', ')})`);
    for (const entry of report.stale) console.error(`${name}: stale allowlist entry: ${entry}`);
    holeCount += report.holes.length;
    staleCount += report.stale.length;
    allowlistedCount += report.allowlisted.length;
  }

  if (holeCount > 0 || staleCount > 0) {
    const stale =
      staleCount > 0
        ? `, ${staleCount} stale allowlist ${staleCount === 1 ? 'entry' : 'entries'}`
        : '';
    console.error(`check-exported-types: FAILED — ${holeCount} hole(s)${stale}`);
    process.exit(1);
  }
  console.log(
    `check-exported-types: OK — ${dirs.length} package(s), no declared-but-unexported type ` +
      `reachable from the public API (${allowlistedCount} allowlisted).`,
  );
  process.exit(0);
}
