/**
 * Parity pins for BOSS_TUNING_DEFS and MINIBOSS_TUNING_DEFS.
 *
 * Every value here matches the formerly-inline literal in its FSM script.
 * A failure means a silent balance drift — treat it like a compile error.
 */

import { describe, expect, test } from 'bun:test';
import { BOSS_TUNING_DEFS, MINIBOSS_TUNING_DEFS } from '../src/visual-spec/boss-tuning';

describe('BOSS_TUNING_DEFS — smok-krzemionkowski', () => {
  const d = BOSS_TUNING_DEFS['smok-krzemionkowski'];
  test('sweepSpeed1', () => expect(d.sweepSpeed1).toBe(80));
  test('sweepSpeed2', () => expect(d.sweepSpeed2).toBe(140));
  test('fire1CooldownSec', () => expect(d.fire1CooldownSec).toBe(0.5));
  test('fire2CooldownSec', () => expect(d.fire2CooldownSec).toBe(1.1));
});

describe('BOSS_TUNING_DEFS — borowy-krol', () => {
  const d = BOSS_TUNING_DEFS['borowy-krol'];
  test('sweepSpeed1', () => expect(d.sweepSpeed1).toBe(60));
  test('sweepSpeed2', () => expect(d.sweepSpeed2).toBe(110));
  test('fire1CooldownSec', () => expect(d.fire1CooldownSec).toBe(0.7));
  test('fire2CooldownSec', () => expect(d.fire2CooldownSec).toBe(0.55));
});

describe('BOSS_TUNING_DEFS — wodnik-wislanny', () => {
  const d = BOSS_TUNING_DEFS['wodnik-wislanny'];
  test('sweepSpeed1', () => expect(d.sweepSpeed1).toBe(70));
  test('sweepSpeed2', () => expect(d.sweepSpeed2).toBe(95));
  test('fire1CooldownSec', () => expect(d.fire1CooldownSec).toBe(0.45));
  test('fire2CooldownSec', () => expect(d.fire2CooldownSec).toBe(0.9));
});

describe('BOSS_TUNING_DEFS — boruta', () => {
  const d = BOSS_TUNING_DEFS.boruta;
  test('sweepSpeed1', () => expect(d.sweepSpeed1).toBe(55));
  test('sweepSpeed2', () => expect(d.sweepSpeed2).toBe(90));
  test('fire1CooldownSec', () => expect(d.fire1CooldownSec).toBe(0.22));
  test('fire2CooldownSec', () => expect(d.fire2CooldownSec).toBe(0.7));
});

describe('BOSS_TUNING_DEFS — baba-jaga', () => {
  const d = BOSS_TUNING_DEFS['baba-jaga'];
  test('sweepSpeed1', () => expect(d.sweepSpeed1).toBe(50));
  test('sweepSpeed2', () => expect(d.sweepSpeed2).toBe(120));
  test('sweepSpeed3', () => expect(d.sweepSpeed3).toBe(35));
  test('fire1CooldownSec', () => expect(d.fire1CooldownSec).toBe(0.85));
  test('fire2CooldownSec', () => expect(d.fire2CooldownSec).toBe(0.6));
  test('fire3CooldownSec', () => expect(d.fire3CooldownSec).toBe(0.18));
});

describe('BOSS_TUNING_DEFS — bazyliszek-warszawski', () => {
  const d = BOSS_TUNING_DEFS['bazyliszek-warszawski'];
  test('sweepSpeed1', () => expect(d.sweepSpeed1).toBe(45));
  test('sweepSpeed2', () => expect(d.sweepSpeed2).toBe(80));
  test('sweepSpeed3', () => expect(d.sweepSpeed3).toBe(25));
  test('fire1CooldownSec', () => expect(d.fire1CooldownSec).toBe(0.7));
  test('fire2CooldownSec', () => expect(d.fire2CooldownSec).toBe(0.55));
  test('fire3CooldownSec', () => expect(d.fire3CooldownSec).toBe(0.22));
});

describe('BOSS_TUNING_DEFS — mefistofeles', () => {
  const d = BOSS_TUNING_DEFS.mefistofeles;
  test('sweepSpeed1', () => expect(d.sweepSpeed1).toBe(55));
  test('sweepSpeed2', () => expect(d.sweepSpeed2).toBe(80));
  test('sweepSpeed3', () => expect(d.sweepSpeed3).toBe(40));
  test('fire1CooldownSec (was MEFISTOFELES_P1_FIRE)', () => expect(d.fire1CooldownSec).toBe(1.4));
  test('fire2CooldownSec (was MEFISTOFELES_P2_FIRE)', () => expect(d.fire2CooldownSec).toBe(0.9));
  test('fire3CooldownSec resolves to 0.9 (same as P2)', () => expect(d.fire3CooldownSec).toBe(0.9));
});

describe('BOSS_TUNING_DEFS — lucyper-ksiezycowy', () => {
  const d = BOSS_TUNING_DEFS['lucyper-ksiezycowy'];
  test('sweepSpeed1', () => expect(d.sweepSpeed1).toBe(60));
  test('sweepSpeed2', () => expect(d.sweepSpeed2).toBe(90));
  test('sweepSpeed3', () => expect(d.sweepSpeed3).toBe(110));
  test('fire1CooldownSec (was LUCYPER_P1_FIRE)', () => expect(d.fire1CooldownSec).toBe(1.3));
  test('fire2CooldownSec (was LUCYPER_P2_FIRE)', () => expect(d.fire2CooldownSec).toBe(0.85));
  test('fire3CooldownSec (was LUCYPER_P3_FIRE)', () => expect(d.fire3CooldownSec).toBe(0.55));
});

describe('BOSS_TUNING_DEFS — all 8 bosses present', () => {
  test('key set', () => {
    const keys = Object.keys(BOSS_TUNING_DEFS);
    expect(keys).toContain('smok-krzemionkowski');
    expect(keys).toContain('borowy-krol');
    expect(keys).toContain('wodnik-wislanny');
    expect(keys).toContain('boruta');
    expect(keys).toContain('baba-jaga');
    expect(keys).toContain('bazyliszek-warszawski');
    expect(keys).toContain('mefistofeles');
    expect(keys).toContain('lucyper-ksiezycowy');
    expect(keys.length).toBe(8);
  });
});

describe('MINIBOSS_TUNING_DEFS — rokita', () => {
  const d = MINIBOSS_TUNING_DEFS.rokita;
  test('kind', () => expect(d.kind).toBe('simple'));
  test('sweepSpeed', () => expect(d.kind === 'simple' && d.sweepSpeed).toBe(55));
  test('fireCooldownSec', () => expect(d.kind === 'simple' && d.fireCooldownSec).toBe(1.1));
});

describe('MINIBOSS_TUNING_DEFS — leszy', () => {
  const d = MINIBOSS_TUNING_DEFS.leszy;
  test('kind', () => expect(d.kind).toBe('leszy'));
  test('sweepSpeedDeer', () => expect(d.kind === 'leszy' && d.sweepSpeedDeer).toBe(95));
  test('sweepSpeedBear', () => expect(d.kind === 'leszy' && d.sweepSpeedBear).toBe(35));
  test('sweepSpeedOwl', () => expect(d.kind === 'leszy' && d.sweepSpeedOwl).toBe(130));
  test('fireCooldownDeerSec', () => expect(d.kind === 'leszy' && d.fireCooldownDeerSec).toBe(0.8));
  test('fireCooldownBearSec', () => expect(d.kind === 'leszy' && d.fireCooldownBearSec).toBe(1.3));
  test('fireCooldownOwlSec', () => expect(d.kind === 'leszy' && d.fireCooldownOwlSec).toBe(1.6));
});

describe('MINIBOSS_TUNING_DEFS — nocny-lowca', () => {
  const d = MINIBOSS_TUNING_DEFS['nocny-lowca'];
  test('kind', () => expect(d.kind).toBe('simple'));
  test('sweepSpeed', () => expect(d.kind === 'simple' && d.sweepSpeed).toBe(120));
  test('fireCooldownSec', () => expect(d.kind === 'simple' && d.fireCooldownSec).toBe(0.9));
});

describe('MINIBOSS_TUNING_DEFS — madej', () => {
  const d = MINIBOSS_TUNING_DEFS.madej;
  test('kind', () => expect(d.kind).toBe('simple'));
  test('sweepSpeed', () => expect(d.kind === 'simple' && d.sweepSpeed).toBe(50));
  test('fireCooldownSec', () => expect(d.kind === 'simple' && d.fireCooldownSec).toBe(1.1));
});

describe('MINIBOSS_TUNING_DEFS — all 4 minibosses present', () => {
  test('key set', () => {
    const keys = Object.keys(MINIBOSS_TUNING_DEFS);
    expect(keys).toContain('rokita');
    expect(keys).toContain('leszy');
    expect(keys).toContain('nocny-lowca');
    expect(keys).toContain('madej');
    expect(keys.length).toBe(4);
  });
});

describe('BOSS_TUNING_DEFS — FSM script parity (PhaseScript reads from def)', () => {
  test('smok fire1Cooldown matches PhaseScript field', async () => {
    const { smokScript } = await import('../src/systems/boss/smok');
    expect(smokScript.fire1Cooldown).toBe(BOSS_TUNING_DEFS['smok-krzemionkowski'].fire1CooldownSec);
  });
  test('smok fire2Cooldown matches PhaseScript field', async () => {
    const { smokScript } = await import('../src/systems/boss/smok');
    expect(smokScript.fire2Cooldown).toBe(BOSS_TUNING_DEFS['smok-krzemionkowski'].fire2CooldownSec);
  });
  test('smok sweepSpeed1 matches PhaseScript field', async () => {
    const { smokScript } = await import('../src/systems/boss/smok');
    expect(smokScript.sweepSpeed1).toBe(BOSS_TUNING_DEFS['smok-krzemionkowski'].sweepSpeed1);
  });
  test('smok sweepSpeed2 matches PhaseScript field', async () => {
    const { smokScript } = await import('../src/systems/boss/smok');
    expect(smokScript.sweepSpeed2).toBe(BOSS_TUNING_DEFS['smok-krzemionkowski'].sweepSpeed2);
  });
  test('mefistofeles fire1Cooldown matches PhaseScript field', async () => {
    const { mefistofelesScript } = await import('../src/systems/boss/mefistofeles');
    expect(mefistofelesScript.fire1Cooldown).toBe(BOSS_TUNING_DEFS.mefistofeles.fire1CooldownSec);
  });
  test('mefistofeles fire2Cooldown matches PhaseScript field', async () => {
    const { mefistofelesScript } = await import('../src/systems/boss/mefistofeles');
    expect(mefistofelesScript.fire2Cooldown).toBe(BOSS_TUNING_DEFS.mefistofeles.fire2CooldownSec);
  });
  test('mefistofeles fire3Cooldown matches PhaseScript field', async () => {
    const { mefistofelesScript } = await import('../src/systems/boss/mefistofeles');
    expect(mefistofelesScript.fire3Cooldown).toBe(BOSS_TUNING_DEFS.mefistofeles.fire3CooldownSec);
  });
  test('lucyper fire1Cooldown matches PhaseScript field', async () => {
    const { lucyperScript } = await import('../src/systems/boss/lucyper');
    expect(lucyperScript.fire1Cooldown).toBe(
      BOSS_TUNING_DEFS['lucyper-ksiezycowy'].fire1CooldownSec,
    );
  });
  test('lucyper fire2Cooldown matches PhaseScript field', async () => {
    const { lucyperScript } = await import('../src/systems/boss/lucyper');
    expect(lucyperScript.fire2Cooldown).toBe(
      BOSS_TUNING_DEFS['lucyper-ksiezycowy'].fire2CooldownSec,
    );
  });
  test('lucyper fire3Cooldown matches PhaseScript field', async () => {
    const { lucyperScript } = await import('../src/systems/boss/lucyper');
    expect(lucyperScript.fire3Cooldown).toBe(
      BOSS_TUNING_DEFS['lucyper-ksiezycowy'].fire3CooldownSec,
    );
  });
  test('baba-jaga sweepSpeed3 matches PhaseScript field', async () => {
    const { babaJagaScript } = await import('../src/systems/boss/baba-jaga');
    expect(babaJagaScript.sweepSpeed3).toBe(BOSS_TUNING_DEFS['baba-jaga'].sweepSpeed3);
  });
  test('bazyliszek sweepSpeed3 matches PhaseScript field', async () => {
    const { bazyliszekScript } = await import('../src/systems/boss/bazyliszek');
    expect(bazyliszekScript.sweepSpeed3).toBe(
      BOSS_TUNING_DEFS['bazyliszek-warszawski'].sweepSpeed3,
    );
  });
});
