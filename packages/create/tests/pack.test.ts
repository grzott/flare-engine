import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

describe('pack tarball', () => {
  test('every template gitignore is packed as gitignore (not .gitignore)', () => {
    const cwd = join(__dirname, '..');
    const output = execFileSync('bun', ['pm', 'pack', '--dry-run'], { cwd, encoding: 'utf8' });
    for (const template of ['blank', 'shmup', 'topdown']) {
      expect(output).toContain(`templates/${template}/gitignore`);
      expect(output).not.toContain(`templates/${template}/.gitignore`);
    }
  });
});
