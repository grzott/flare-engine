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
