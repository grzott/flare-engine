import { describe, expect, it } from 'bun:test';
import { FSM } from '../src/fsm.js';
import type { State } from '../src/fsm.js';

describe('FSM', () => {
  it('starts in given state and calls onEnter', () => {
    const log: string[] = [];
    const idle: State = { name: 'idle', onEnter: () => log.push('enter-idle') };
    const fsm = new FSM();
    fsm.addState(idle);
    fsm.start('idle');
    expect(fsm.current).toBe(idle);
    expect(log).toEqual(['enter-idle']);
  });

  it('transitions between states', () => {
    const log: string[] = [];
    const idle: State = {
      name: 'idle',
      onEnter: () => log.push('enter-idle'),
      onExit: () => log.push('exit-idle'),
    };
    const run: State = {
      name: 'run',
      onEnter: () => log.push('enter-run'),
      onExit: () => log.push('exit-run'),
    };

    const fsm = new FSM();
    fsm.addState(idle).addState(run);
    fsm.addTransition('idle', 'move', 'run');
    fsm.addTransition('run', 'stop', 'idle');

    fsm.start('idle');
    log.length = 0;

    fsm.trigger('move');
    expect(fsm.current).toBe(run);
    expect(log).toEqual(['exit-idle', 'enter-run']);

    log.length = 0;
    fsm.trigger('stop');
    expect(fsm.current).toBe(idle);
    expect(log).toEqual(['exit-run', 'enter-idle']);
  });

  it('ignores unknown triggers', () => {
    const idle: State = { name: 'idle' };
    const fsm = new FSM();
    fsm.addState(idle);
    fsm.start('idle');
    fsm.trigger('nonexistent'); // No-op
    expect(fsm.current).toBe(idle);
  });

  it('calls onUpdate on current state', () => {
    let totalDt = 0;
    const idle: State = {
      name: 'idle',
      onUpdate: (dt) => {
        totalDt += dt;
      },
    };
    const fsm = new FSM();
    fsm.addState(idle);
    fsm.start('idle');
    fsm.update(0.016);
    fsm.update(0.016);
    expect(totalDt).toBeCloseTo(0.032);
  });

  it('update before start is no-op', () => {
    const fsm = new FSM();
    fsm.update(1); // Should not throw
  });

  it('passes context to state hooks', () => {
    interface Ctx {
      health: number;
    }
    const ctx: Ctx = { health: 100 };
    const alive: State<Ctx> = {
      name: 'alive',
      onUpdate: (dt, c) => {
        c.health -= dt * 10;
      },
    };
    const dead: State<Ctx> = {
      name: 'dead',
      onEnter: (c) => {
        c.health = 0;
      },
    };
    const fsm = new FSM(ctx);
    fsm.addState(alive).addState(dead);
    fsm.addTransition('alive', 'die', 'dead');
    fsm.start('alive');
    fsm.update(1);
    expect(ctx.health).toBe(90);
    fsm.trigger('die');
    expect(ctx.health).toBe(0);
  });

  it('start with unknown state is no-op', () => {
    const fsm = new FSM();
    fsm.start('nope');
    expect(fsm.current).toBeUndefined();
  });

  it('trigger to unknown target state is no-op', () => {
    const idle: State = { name: 'idle' };
    const fsm = new FSM();
    fsm.addState(idle);
    fsm.addTransition('idle', 'go', 'nonexistent');
    fsm.start('idle');
    fsm.trigger('go');
    expect(fsm.current).toBe(idle); // Stays in idle
  });

  it('supports chained addState/addTransition', () => {
    const fsm = new FSM();
    const result = fsm
      .addState({ name: 'a' })
      .addState({ name: 'b' })
      .addTransition('a', 'go', 'b');
    expect(result).toBe(fsm);
  });
});
