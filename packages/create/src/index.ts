export { buildProgram } from './cli.js';
export {
  isTemplateId,
  TEMPLATES,
  type TemplateId,
  type TemplateManifest,
} from './manifest.js';
export {
  detectPackageManager,
  installSpawnSpec,
  isValidAppName,
  type ScaffoldOptions,
  type ScaffoldResult,
  scaffoldApp,
} from './scaffold.js';
