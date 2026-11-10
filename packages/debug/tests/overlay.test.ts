import { describe, expect, test } from 'bun:test';
import { DebugOverlay } from '../src/overlay.js';

describe('DebugOverlay', () => {
  test('starts with all flags disabled', () => {
    const overlay = new DebugOverlay();
    expect(overlay.flags.showCollisionBounds).toBe(false);
    expect(overlay.flags.showEntityOrigins).toBe(false);
    expect(overlay.flags.showVelocityVectors).toBe(false);
    expect(overlay.flags.showStats).toBe(false);
  });

  test('starts with zero commands', () => {
    const overlay = new DebugOverlay();
    expect(overlay.commandCount).toBe(0);
    expect(overlay.commands).toHaveLength(0);
  });

  test('drawRect adds a rect command', () => {
    const overlay = new DebugOverlay();
    overlay.drawRect(10, 20, 32, 48, '#ff0000');
    expect(overlay.commandCount).toBe(1);
    const cmd = overlay.commands[0]!;
    expect(cmd.type).toBe('rect');
    if (cmd.type === 'rect') {
      expect(cmd.x).toBe(10);
      expect(cmd.y).toBe(20);
      expect(cmd.width).toBe(32);
      expect(cmd.height).toBe(48);
      expect(cmd.color).toBe('#ff0000');
    }
  });

  test('drawCircle adds a circle command', () => {
    const overlay = new DebugOverlay();
    overlay.drawCircle(50, 60, 16, '#0000ff');
    expect(overlay.commandCount).toBe(1);
    const cmd = overlay.commands[0]!;
    expect(cmd.type).toBe('circle');
    if (cmd.type === 'circle') {
      expect(cmd.x).toBe(50);
      expect(cmd.y).toBe(60);
      expect(cmd.radius).toBe(16);
      expect(cmd.color).toBe('#0000ff');
    }
  });

  test('drawLine adds a line command', () => {
    const overlay = new DebugOverlay();
    overlay.drawLine(0, 0, 100, 100, '#ffffff');
    expect(overlay.commandCount).toBe(1);
    const cmd = overlay.commands[0]!;
    expect(cmd.type).toBe('line');
    if (cmd.type === 'line') {
      expect(cmd.x1).toBe(0);
      expect(cmd.y1).toBe(0);
      expect(cmd.x2).toBe(100);
      expect(cmd.y2).toBe(100);
      expect(cmd.color).toBe('#ffffff');
    }
  });

  test('uses default colors', () => {
    const overlay = new DebugOverlay();
    overlay.drawRect(0, 0, 10, 10);
    overlay.drawCircle(0, 0, 5);
    overlay.drawLine(0, 0, 10, 10);
    expect(overlay.commands[0]!.color).toBe('#00ff00');
    expect(overlay.commands[1]!.color).toBe('#00ff00');
    expect(overlay.commands[2]!.color).toBe('#ffff00');
  });

  test('clear removes all commands', () => {
    const overlay = new DebugOverlay();
    overlay.drawRect(0, 0, 10, 10);
    overlay.drawCircle(5, 5, 3);
    expect(overlay.commandCount).toBe(2);
    overlay.clear();
    expect(overlay.commandCount).toBe(0);
  });

  test('reuses the slot-0 command object across frames with the new values', () => {
    const overlay = new DebugOverlay({ reuseCommands: true });
    overlay.drawRect(1, 2, 3, 4, '#111111');
    const first = overlay.commands[0];
    overlay.clear();
    overlay.drawRect(5, 6, 7, 8, '#222222');
    const second = overlay.commands[0];
    expect(second).toBe(first);
    expect(second).toEqual({ type: 'rect', x: 5, y: 6, width: 7, height: 8, color: '#222222' });
  });

  test('a shorter frame after a longer one exposes only its own commands', () => {
    const overlay = new DebugOverlay({ reuseCommands: true });
    overlay.drawRect(1, 1, 1, 1, '#aaaaaa');
    overlay.drawRect(2, 2, 2, 2, '#bbbbbb');
    overlay.drawRect(3, 3, 3, 3, '#cccccc');
    overlay.clear();
    overlay.drawRect(9, 8, 7, 6);
    expect(overlay.commands.length).toBe(1);
    expect(overlay.commandCount).toBe(1);
    expect(overlay.commands[0]).toEqual({
      type: 'rect',
      x: 9,
      y: 8,
      width: 7,
      height: 6,
      color: '#00ff00',
    });
  });

  test('preserves mixed draw order and reuses same-type slots in the next frame', () => {
    const overlay = new DebugOverlay({ reuseCommands: true });
    overlay.drawRect(1, 2, 3, 4, '#000001');
    overlay.drawLine(5, 6, 7, 8, '#000002');
    overlay.drawCircle(9, 10, 11, '#000003');
    overlay.drawRect(12, 13, 14, 15, '#000004');
    expect(overlay.commands.map((c) => c.type)).toEqual(['rect', 'line', 'circle', 'rect']);
    expect(overlay.commands[0]).toEqual({
      type: 'rect',
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      color: '#000001',
    });
    expect(overlay.commands[1]).toEqual({
      type: 'line',
      x1: 5,
      y1: 6,
      x2: 7,
      y2: 8,
      color: '#000002',
    });
    expect(overlay.commands[2]).toEqual({
      type: 'circle',
      x: 9,
      y: 10,
      radius: 11,
      color: '#000003',
    });
    expect(overlay.commands[3]).toEqual({
      type: 'rect',
      x: 12,
      y: 13,
      width: 14,
      height: 15,
      color: '#000004',
    });
    const frame1 = overlay.commands.slice();

    overlay.clear();
    overlay.drawRect(21, 22, 23, 24, '#000011');
    overlay.drawLine(25, 26, 27, 28, '#000012');
    overlay.drawCircle(29, 30, 31, '#000013');
    overlay.drawRect(32, 33, 34, 35, '#000014');
    expect(overlay.commands.map((c) => c.type)).toEqual(['rect', 'line', 'circle', 'rect']);
    for (let i = 0; i < 4; i++) {
      expect(overlay.commands[i]).toBe(frame1[i]);
    }
    expect(overlay.commands[0]).toEqual({
      type: 'rect',
      x: 21,
      y: 22,
      width: 23,
      height: 24,
      color: '#000011',
    });
    expect(overlay.commands[1]).toEqual({
      type: 'line',
      x1: 25,
      y1: 26,
      x2: 27,
      y2: 28,
      color: '#000012',
    });
    expect(overlay.commands[2]).toEqual({
      type: 'circle',
      x: 29,
      y: 30,
      radius: 31,
      color: '#000013',
    });
    expect(overlay.commands[3]).toEqual({
      type: 'rect',
      x: 32,
      y: 33,
      width: 34,
      height: 35,
      color: '#000014',
    });
  });

  test('a frame larger than any earlier frame records every command', () => {
    const overlay = new DebugOverlay({ reuseCommands: true });
    overlay.drawRect(0, 0, 1, 1);
    overlay.drawCircle(0, 0, 1);
    overlay.drawLine(0, 0, 1, 1);
    overlay.clear();

    for (let i = 0; i < 5; i++) {
      overlay.drawRect(i, i + 1, i + 2, i + 3, `#r${i}`);
      overlay.drawCircle(i * 10, i * 10 + 1, i + 4, `#c${i}`);
      overlay.drawLine(i, i * 2, i * 3, i * 4, `#l${i}`);
    }
    expect(overlay.commandCount).toBe(15);
    for (let i = 0; i < 5; i++) {
      expect(overlay.commands[i * 3]).toEqual({
        type: 'rect',
        x: i,
        y: i + 1,
        width: i + 2,
        height: i + 3,
        color: `#r${i}`,
      });
      expect(overlay.commands[i * 3 + 1]).toEqual({
        type: 'circle',
        x: i * 10,
        y: i * 10 + 1,
        radius: i + 4,
        color: `#c${i}`,
      });
      expect(overlay.commands[i * 3 + 2]).toEqual({
        type: 'line',
        x1: i,
        y1: i * 2,
        x2: i * 3,
        y2: i * 4,
        color: `#l${i}`,
      });
    }
    expect(new Set(overlay.commands).size).toBe(15);
  });

  test('creates a fresh command object per call by default, across a clear', () => {
    const overlay = new DebugOverlay();
    overlay.drawRect(1, 2, 3, 4, '#111111');
    overlay.drawCircle(9, 10, 11, '#333333');
    overlay.drawLine(12, 13, 14, 15, '#555555');
    const firstRect = overlay.commands[0];
    const firstCircle = overlay.commands[1];
    const firstLine = overlay.commands[2];
    overlay.clear();
    overlay.drawRect(5, 6, 7, 8, '#222222');
    overlay.drawCircle(19, 20, 21, '#444444');
    overlay.drawLine(22, 23, 24, 25, '#666666');

    expect(overlay.commands[0]).not.toBe(firstRect);
    expect(overlay.commands[1]).not.toBe(firstCircle);
    expect(overlay.commands[2]).not.toBe(firstLine);
    expect(firstRect).toEqual({ type: 'rect', x: 1, y: 2, width: 3, height: 4, color: '#111111' });
    expect(firstCircle).toEqual({ type: 'circle', x: 9, y: 10, radius: 11, color: '#333333' });
    expect(firstLine).toEqual({ type: 'line', x1: 12, y1: 13, x2: 14, y2: 15, color: '#555555' });
    expect(overlay.commands[0]).toEqual({
      type: 'rect',
      x: 5,
      y: 6,
      width: 7,
      height: 8,
      color: '#222222',
    });
    expect(overlay.commands[1]).toEqual({
      type: 'circle',
      x: 19,
      y: 20,
      radius: 21,
      color: '#444444',
    });
    expect(overlay.commands[2]).toEqual({
      type: 'line',
      x1: 22,
      y1: 23,
      x2: 24,
      y2: 25,
      color: '#666666',
    });
  });

  test('reuseCommands: false behaves like the default', () => {
    const overlay = new DebugOverlay({ reuseCommands: false });
    overlay.drawRect(1, 2, 3, 4, '#111111');
    overlay.drawCircle(9, 10, 11, '#333333');
    overlay.drawLine(12, 13, 14, 15, '#555555');
    const frame1 = overlay.commands.slice();
    overlay.clear();
    overlay.drawRect(5, 6, 7, 8, '#222222');
    overlay.drawCircle(19, 20, 21, '#444444');
    overlay.drawLine(22, 23, 24, 25, '#666666');

    for (let i = 0; i < 3; i++) {
      expect(overlay.commands[i]).not.toBe(frame1[i]);
    }
    expect(frame1[0]).toEqual({ type: 'rect', x: 1, y: 2, width: 3, height: 4, color: '#111111' });
    expect(frame1[1]).toEqual({ type: 'circle', x: 9, y: 10, radius: 11, color: '#333333' });
    expect(frame1[2]).toEqual({ type: 'line', x1: 12, y1: 13, x2: 14, y2: 15, color: '#555555' });
    expect(overlay.commands[0]).toEqual({
      type: 'rect',
      x: 5,
      y: 6,
      width: 7,
      height: 8,
      color: '#222222',
    });
  });

  test('toggleFlag flips a flag', () => {
    const overlay = new DebugOverlay();
    overlay.toggleFlag('showCollisionBounds');
    expect(overlay.flags.showCollisionBounds).toBe(true);
    overlay.toggleFlag('showCollisionBounds');
    expect(overlay.flags.showCollisionBounds).toBe(false);
  });

  test('enableAll sets all flags true', () => {
    const overlay = new DebugOverlay();
    overlay.enableAll();
    expect(overlay.flags.showCollisionBounds).toBe(true);
    expect(overlay.flags.showEntityOrigins).toBe(true);
    expect(overlay.flags.showVelocityVectors).toBe(true);
    expect(overlay.flags.showStats).toBe(true);
  });

  test('disableAll sets all flags false', () => {
    const overlay = new DebugOverlay();
    overlay.enableAll();
    overlay.disableAll();
    expect(overlay.flags.showCollisionBounds).toBe(false);
    expect(overlay.flags.showEntityOrigins).toBe(false);
    expect(overlay.flags.showVelocityVectors).toBe(false);
    expect(overlay.flags.showStats).toBe(false);
  });
});
