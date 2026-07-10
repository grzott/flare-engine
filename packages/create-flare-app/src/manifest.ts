/** Declared metadata for a create-flare-app template. */
export interface TemplateManifest {
  /** Template directory name (`blank`, `topdown`, `shmup`, ...). */
  id: string;
  /** Human-readable name shown in logs. */
  displayName: string;
  /** One-line description of what the template produces. */
  description: string;
  /** Engines required — mirrors Node/npm engines field in scaffolded package.json. */
  engines: { node: string };
  /** Optional post-install instructions printed after scaffold completes. */
  postInstall?: string;
}

/** Built-in templates shipped inside `create-flare-app`. */
export const TEMPLATES = {
  blank: {
    id: 'blank',
    displayName: 'Blank',
    description: 'Empty scene with a single sprite — smallest starting point.',
    engines: { node: '>=20' },
    postInstall: 'bun run start',
  },
  topdown: {
    id: 'topdown',
    displayName: 'Top-down',
    description: 'Analog player movement with tilemap collision + camera follow.',
    engines: { node: '>=20' },
    postInstall: 'bun run start',
  },
  shmup: {
    id: 'shmup',
    displayName: 'Shoot-em-up',
    description:
      'Auto-fire player, enemy spawner, HUD score — mirrors a minimum vertical-slice shmup.',
    engines: { node: '>=20' },
    postInstall: 'bun run start',
  },
} satisfies Record<string, TemplateManifest>;

export type TemplateId = keyof typeof TEMPLATES;

export function isTemplateId(value: string): value is TemplateId {
  return Object.hasOwn(TEMPLATES, value);
}
