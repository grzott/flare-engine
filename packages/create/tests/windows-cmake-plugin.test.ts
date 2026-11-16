import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface RegResult {
  error?: Error;
  status: number | null;
  stdout: string;
}

interface ApplyOptions {
  androidDir: string;
  platform: string;
  env: Record<string, string | undefined>;
  homedir: string;
  warn: (message: string) => void;
  exists: (path: string) => boolean;
  readdir: (path: string) => string[];
  readFile: (path: string) => string;
  writeFile: (path: string, content: string) => void;
  queryLongPaths?: () => boolean | null;
}

interface WindowsCmakePlugin {
  (config: unknown): unknown;
  pickCmakeVersion(names: string[]): string | null;
  resolveSdkRoot(deps: {
    env: Record<string, string | undefined>;
    homedir: string;
    exists: (path: string) => boolean;
  }): string | null;
  withCmakeDir(properties: string, cmakeDir: string): string;
  parseLongPathsEnabled(result: RegResult): boolean | null;
  applyWindowsCmake(options: ApplyOptions): { cmakeDir: string; installed: boolean } | null;
}

const TEMPLATE_IDS = ['blank', 'shmup', 'topdown'] as const;
const PLUGIN_REF = './plugins/with-windows-cmake';
const TEMPLATES_DIR = join(__dirname, '..', 'templates');
const pluginPath = (id: string): string =>
  join(TEMPLATES_DIR, id, 'plugins', 'with-windows-cmake.js');

const plugin = createRequire(import.meta.url)(pluginPath('topdown')) as WindowsCmakePlugin;

const forward = (p: string): string => p.replace(/\\/g, '/');

describe('pickCmakeVersion', () => {
  test('picks the newest 3.x from 3.31.6, comparing numerically, never 4.x', () => {
    expect(plugin.pickCmakeVersion(['3.22.1', '3.31.6', '3.31.10', '4.1.2'])).toBe('3.31.10');
    expect(plugin.pickCmakeVersion(['3.31.5', '3.32.0'])).toBe('3.32.0');
  });

  test('returns null when only 4.x is installed', () => {
    expect(plugin.pickCmakeVersion(['4.0.2', '4.1.2'])).toBeNull();
  });

  test('returns null when every 3.x is older than 3.31.6', () => {
    expect(plugin.pickCmakeVersion(['3.30.5', '3.22.1'])).toBeNull();
    expect(plugin.pickCmakeVersion(['3.31.0', '3.31.1', '3.31.4', '3.31.5'])).toBeNull();
  });

  test('ignores names that are not plain x.y.z', () => {
    expect(plugin.pickCmakeVersion(['3.31.6', '.DS_Store', '3.31.6-rc1'])).toBe('3.31.6');
  });

  test('returns null for an empty list', () => {
    expect(plugin.pickCmakeVersion([])).toBeNull();
  });
});

describe('resolveSdkRoot', () => {
  const never = (): boolean => false;

  test('ANDROID_HOME wins over ANDROID_SDK_ROOT', () => {
    const env = { ANDROID_HOME: 'C:/home-sdk', ANDROID_SDK_ROOT: 'C:/root-sdk' };
    expect(plugin.resolveSdkRoot({ env, homedir: 'C:/Users/u', exists: never })).toBe(
      'C:/home-sdk',
    );
  });

  test('ANDROID_SDK_ROOT is used when ANDROID_HOME is empty or unset', () => {
    expect(
      plugin.resolveSdkRoot({
        env: { ANDROID_HOME: '', ANDROID_SDK_ROOT: 'C:/root-sdk' },
        homedir: 'C:/Users/u',
        exists: never,
      }),
    ).toBe('C:/root-sdk');
    expect(
      plugin.resolveSdkRoot({
        env: { ANDROID_SDK_ROOT: 'C:/root-sdk' },
        homedir: 'C:/Users/u',
        exists: never,
      }),
    ).toBe('C:/root-sdk');
  });

  test('falls back to the homedir default only when it exists', () => {
    const expected = join('C:/Users/u', 'AppData', 'Local', 'Android', 'Sdk');
    const asked: string[] = [];
    const exists = (p: string): boolean => {
      asked.push(p);
      return true;
    };
    expect(plugin.resolveSdkRoot({ env: {}, homedir: 'C:/Users/u', exists })).toBe(expected);
    expect(asked).toEqual([expected]);
    expect(plugin.resolveSdkRoot({ env: {}, homedir: 'C:/Users/u', exists: never })).toBeNull();
  });
});

describe('withCmakeDir', () => {
  test('writes the entry into an empty file', () => {
    expect(plugin.withCmakeDir('', 'X')).toBe('cmake.dir=X\n');
  });

  test('adds the missing newline before appending', () => {
    expect(plugin.withCmakeDir('sdk.dir=Y', 'X')).toBe('sdk.dir=Y\ncmake.dir=X\n');
    expect(plugin.withCmakeDir('sdk.dir=Y\n', 'X')).toBe('sdk.dir=Y\ncmake.dir=X\n');
  });

  test('keeps an existing cmake.dir in either separator form', () => {
    expect(plugin.withCmakeDir('sdk.dir=Y\ncmake.dir = Z\n', 'X')).toBe(
      'sdk.dir=Y\ncmake.dir = Z\n',
    );
    expect(plugin.withCmakeDir('  cmake.dir:Z', 'X')).toBe('  cmake.dir:Z');
  });

  test('is idempotent', () => {
    const once = plugin.withCmakeDir('sdk.dir=Y', 'X');
    expect(plugin.withCmakeDir(once, 'X')).toBe(once);
  });
});

describe('parseLongPathsEnabled', () => {
  const stdoutFor = (value: string): string =>
    `\r\nHKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\FileSystem\r\n    LongPathsEnabled    REG_DWORD    ${value}\r\n\r\n`;

  test('0x1 is enabled', () => {
    expect(plugin.parseLongPathsEnabled({ status: 0, stdout: stdoutFor('0x1') })).toBe(true);
  });

  test('0x0 is disabled', () => {
    expect(plugin.parseLongPathsEnabled({ status: 0, stdout: stdoutFor('0x0') })).toBe(false);
  });

  test('an absent value is disabled', () => {
    expect(plugin.parseLongPathsEnabled({ status: 1, stdout: '' })).toBe(false);
  });

  test('an unrunnable reg is unknown', () => {
    expect(
      plugin.parseLongPathsEnabled({ error: new Error('ENOENT'), status: null, stdout: '' }),
    ).toBeNull();
  });
});

describe('applyWindowsCmake', () => {
  let root = '';
  let sdk = '';
  let androidDir = '';
  let propsPath = '';
  let warnings: string[] = [];
  let longPathQueries = 0;

  const options = (over: Partial<ApplyOptions> = {}): ApplyOptions => ({
    androidDir,
    platform: 'win32',
    env: { ANDROID_HOME: sdk },
    homedir: join(root, 'home'),
    warn: (message) => {
      warnings.push(message);
    },
    exists: existsSync,
    readdir: (p) => readdirSync(p),
    readFile: (p) => readFileSync(p, 'utf8'),
    writeFile: (p, content) => writeFileSync(p, content),
    queryLongPaths: () => {
      longPathQueries++;
      return true;
    },
    ...over,
  });

  const installCmake = (...versions: string[]): void => {
    for (const v of versions) mkdirSync(join(sdk, 'cmake', v), { recursive: true });
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'flare-windows-cmake-'));
    sdk = join(root, 'sdk');
    androidDir = join(root, 'android');
    propsPath = join(androidDir, 'local.properties');
    mkdirSync(sdk);
    mkdirSync(androidDir);
    warnings = [];
    longPathQueries = 0;
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('writes cmake.dir for the newest installed 3.31.6+ with forward slashes', () => {
    installCmake('3.22.1', '3.31.6');
    const result = plugin.applyWindowsCmake(options());
    const cmakeDir = `${forward(sdk)}/cmake/3.31.6`;
    expect(readFileSync(propsPath, 'utf8')).toBe(`cmake.dir=${cmakeDir}\n`);
    expect(result).toEqual({ cmakeDir, installed: true });
    expect(warnings).toEqual([]);
  });

  test('keeps existing properties and a second run changes nothing', () => {
    installCmake('3.31.6');
    writeFileSync(propsPath, 'sdk.dir=C\\:\\\\sdk');
    plugin.applyWindowsCmake(options());
    const first = readFileSync(propsPath);
    expect(first.toString('utf8')).toBe(
      `sdk.dir=C\\:\\\\sdk\ncmake.dir=${forward(sdk)}/cmake/3.31.6\n`,
    );
    plugin.applyWindowsCmake(options());
    expect(readFileSync(propsPath).equals(first)).toBe(true);
  });

  test("keeps the user's own cmake.dir", () => {
    installCmake('3.31.6');
    const own = 'sdk.dir=Y\ncmake.dir=D:/my/cmake\n';
    writeFileSync(propsPath, own);
    plugin.applyWindowsCmake(options());
    expect(readFileSync(propsPath, 'utf8')).toBe(own);
  });

  test('points at 3.31.6 and warns once when no 3.31.6+ is installed', () => {
    installCmake('3.22.1');
    const result = plugin.applyWindowsCmake(options());
    const cmakeDir = `${forward(sdk)}/cmake/3.31.6`;
    expect(result).toEqual({ cmakeDir, installed: false });
    expect(readFileSync(propsPath, 'utf8')).toBe(`cmake.dir=${cmakeDir}\n`);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toStartWith('[with-windows-cmake] ');
    expect(warnings[0]).toContain('sdkmanager "cmake;3.31.6"');
  });

  test('treats an older 3.31 like none: points at 3.31.6 and warns', () => {
    installCmake('3.22.1', '3.31.4');
    const result = plugin.applyWindowsCmake(options());
    const cmakeDir = `${forward(sdk)}/cmake/3.31.6`;
    expect(result).toEqual({ cmakeDir, installed: false });
    expect(readFileSync(propsPath, 'utf8')).toBe(`cmake.dir=${cmakeDir}
`);
    expect(warnings).toHaveLength(1);
  });

  test('quotes the full sdkmanager path when the SDK has command-line tools', () => {
    const bin = join(sdk, 'cmdline-tools', 'latest', 'bin');
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, 'sdkmanager.bat'), '');
    plugin.applyWindowsCmake(options());
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(`"${join(bin, 'sdkmanager.bat')}" "cmake;3.31.6"`);
  });

  test('does nothing off Windows', () => {
    installCmake('3.31.6');
    const result = plugin.applyWindowsCmake(options({ platform: 'linux' }));
    expect(result).toBeNull();
    expect(existsSync(propsPath)).toBe(false);
    expect(longPathQueries).toBe(0);
    expect(warnings).toHaveLength(0);
  });

  test('warns when long paths are disabled and still writes cmake.dir', () => {
    installCmake('3.31.6');
    const result = plugin.applyWindowsCmake(options({ queryLongPaths: () => false }));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toStartWith('[with-windows-cmake] ');
    expect(warnings[0]).toContain('LongPathsEnabled');
    expect(result?.installed).toBe(true);
    expect(readFileSync(propsPath, 'utf8')).toBe(`cmake.dir=${forward(sdk)}/cmake/3.31.6\n`);
  });

  test('does not warn when the long-path state is unknown', () => {
    installCmake('3.31.6');
    plugin.applyWindowsCmake(options({ queryLongPaths: () => null }));
    expect(warnings).toEqual([]);
  });

  test('warns and writes nothing when no Android SDK is found', () => {
    const result = plugin.applyWindowsCmake(options({ env: {}, exists: () => false }));
    expect(result).toBeNull();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('ANDROID_HOME');
    expect(existsSync(propsPath)).toBe(false);
  });
});

describe('template wiring', () => {
  test('the three plugin copies are byte-identical and carry no scaffold token', () => {
    const reference = readFileSync(pluginPath('topdown'));
    expect(reference.includes('{{')).toBe(false);
    for (const id of TEMPLATE_IDS) {
      expect(readFileSync(pluginPath(id)).equals(reference), id).toBe(true);
    }
  });

  test('every template app.json registers the plugin', () => {
    for (const id of TEMPLATE_IDS) {
      const app = JSON.parse(readFileSync(join(TEMPLATES_DIR, id, 'app.json'), 'utf8')) as {
        expo: { plugins?: string[] };
      };
      expect(app.expo.plugins, id).toContain(PLUGIN_REF);
    }
  });
});
