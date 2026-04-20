export {
  type TemplateManifest,
  type TemplateId,
  TEMPLATES,
  isTemplateId,
} from './manifest.js';

export {
  type ScaffoldOptions,
  type ScaffoldResult,
  scaffoldApp,
  detectPackageManager,
} from './scaffold.js';

export { buildProgram } from './cli.js';
