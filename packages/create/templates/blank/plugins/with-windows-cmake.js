/**
 * Expo config plugin: on Windows, point the Android build at an SDK CMake that
 * can create long paths, by writing `cmake.dir` into `android/local.properties`
 * at prebuild. It does nothing on macOS and Linux.
 *
 * The Android SDK's default CMake 3.22.1 ships ninja 1.10, which ignores
 * Windows long-path support, and React Native's codegen object directories pass
 * the 260-character limit wherever the project lives. The SDK's CMake 3.31.6
 * ships ninja 1.12.1, which honours long paths; earlier SDK builds are not
 * verified, so 3.31.6 is the floor. The pick is capped at 3.x: Skia's CMakeLists
 * declares `cmake_minimum_required(VERSION 3.4.1)` and CMake 4 rejects anything
 * below 3.5.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TAG = '[with-windows-cmake] ';
const FALLBACK_VERSION = '3.31.6';
const MIN_MINOR = 31;
const MIN_PATCH = 6;
const ENABLE_LONG_PATHS =
  'New-ItemProperty -Path HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force';

function pickCmakeVersion(names) {
  let best = null;
  for (const name of names) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(name);
    if (match === null) continue;
    const minor = Number(match[2]);
    const patch = Number(match[3]);
    if (Number(match[1]) !== 3 || minor < MIN_MINOR) continue;
    if (minor === MIN_MINOR && patch < MIN_PATCH) continue;
    if (best === null || minor > best.minor || (minor === best.minor && patch > best.patch)) {
      best = { name, minor, patch };
    }
  }
  return best === null ? null : best.name;
}

// Same order as Expo CLI, so the plugin and the build agree on one SDK.
function resolveSdkRoot({ env, homedir, exists }) {
  if (env.ANDROID_HOME) return env.ANDROID_HOME;
  if (env.ANDROID_SDK_ROOT) return env.ANDROID_SDK_ROOT;
  const fallback = path.join(homedir, 'AppData', 'Local', 'Android', 'Sdk');
  return exists(fallback) ? fallback : null;
}

function withCmakeDir(properties, cmakeDir) {
  if (/^[ \t]*cmake\.dir[ \t]*[=:]/m.test(properties)) return properties;
  const gap = properties.length > 0 && !properties.endsWith('\n') ? '\n' : '';
  return `${properties}${gap}cmake.dir=${cmakeDir}\n`;
}

function parseLongPathsEnabled(result) {
  if (result.error) return null;
  const match = /LongPathsEnabled\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(result.stdout || '');
  return match === null ? false : Number.parseInt(match[1], 16) !== 0;
}

function queryLongPathsFromRegistry() {
  return parseLongPathsEnabled(
    spawnSync(
      'reg',
      ['query', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem', '/v', 'LongPathsEnabled'],
      { encoding: 'utf8' },
    ),
  );
}

function applyWindowsCmake({
  androidDir,
  platform,
  env,
  homedir,
  warn,
  exists,
  readdir,
  readFile,
  writeFile,
  queryLongPaths = queryLongPathsFromRegistry,
}) {
  if (platform !== 'win32') return null;

  if (queryLongPaths() === false) {
    warn(
      `${TAG}Windows long paths are disabled. This build creates paths past 260 characters and will fail. Enable them from an administrator PowerShell:\n  ${ENABLE_LONG_PATHS}`,
    );
  }

  const sdk = resolveSdkRoot({ env, homedir, exists });
  if (sdk === null) {
    warn(
      `${TAG}Android SDK not found (set ANDROID_HOME), so cmake.dir was not written to android/local.properties.`,
    );
    return null;
  }

  const cmakeRoot = path.join(sdk, 'cmake');
  const version = pickCmakeVersion(exists(cmakeRoot) ? readdir(cmakeRoot) : []);
  if (version === null) {
    const sdkmanager = path.join(sdk, 'cmdline-tools', 'latest', 'bin', 'sdkmanager.bat');
    const command = exists(sdkmanager) ? `"${sdkmanager}"` : 'sdkmanager';
    warn(
      `${TAG}No SDK CMake ${FALLBACK_VERSION} or newer (3.x) found in ${cmakeRoot}. The default 3.22.1 ships ninja 1.10, which cannot create the long paths this build needs. Install it with:\n  ${command} "cmake;${FALLBACK_VERSION}"\nor in Android Studio: SDK Manager > SDK Tools > Show Package Details > CMake ${FALLBACK_VERSION}. android/local.properties already points cmake.dir at ${FALLBACK_VERSION}, so rebuilding after the install needs no prebuild --clean. Do not use CMake 4.`,
    );
  }

  // .properties treats a backslash as an escape, so the path goes in with forward slashes.
  const cmakeDir = path.join(cmakeRoot, version ?? FALLBACK_VERSION).replace(/\\/g, '/');
  const propertiesPath = path.join(androidDir, 'local.properties');
  const current = exists(propertiesPath) ? readFile(propertiesPath) : '';
  const next = withCmakeDir(current, cmakeDir);
  if (next !== current) writeFile(propertiesPath, next);
  return { cmakeDir, installed: version !== null };
}

function withWindowsCmake(config) {
  // Required here, not at the top, so the helpers load without expo installed.
  const { withDangerousMod } = require('expo/config-plugins');
  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      applyWindowsCmake({
        androidDir: modConfig.modRequest.platformProjectRoot,
        platform: process.platform,
        env: process.env,
        homedir: os.homedir(),
        warn: (message) => console.warn(message),
        exists: fs.existsSync,
        readdir: (dir) => fs.readdirSync(dir),
        readFile: (file) => fs.readFileSync(file, 'utf8'),
        writeFile: (file, content) => fs.writeFileSync(file, content),
      });
      return modConfig;
    },
  ]);
}

module.exports = withWindowsCmake;
module.exports.pickCmakeVersion = pickCmakeVersion;
module.exports.resolveSdkRoot = resolveSdkRoot;
module.exports.withCmakeDir = withCmakeDir;
module.exports.parseLongPathsEnabled = parseLongPathsEnabled;
module.exports.applyWindowsCmake = applyWindowsCmake;
