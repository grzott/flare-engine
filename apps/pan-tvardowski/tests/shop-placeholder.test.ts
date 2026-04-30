import { describe, expect, test } from 'bun:test';
import enJson from '../locales/en.json';
import plJson from '../locales/pl.json';

describe('ShopOverlay placeholder keys', () => {
  test('en.json has shop.full_game.placeholder_price', () => {
    expect((enJson as Record<string, string>)['shop.full_game.placeholder_price']).toBe('$2.99');
  });

  test('en.json has shop.supporter_pack.placeholder_price', () => {
    expect((enJson as Record<string, string>)['shop.supporter_pack.placeholder_price']).toBe(
      '$0.99',
    );
  });

  test('pl.json has shop.noop_notice with expected Polish text', () => {
    expect((plJson as Record<string, string>)['shop.noop_notice']).toBe(
      'Ceny niedostępne w tej kompilacji.',
    );
  });
});
