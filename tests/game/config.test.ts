import { describe, expect, it } from 'vitest';
import { getBoardDimensions } from '../../src/game/config';

describe('getBoardDimensions', () => {
  it('uses 4 rows and 6 columns on a portrait phone', () => {
    expect(getBoardDimensions(390, 844)).toEqual({ rows: 4, columns: 6 });
  });

  it('uses 4 rows and 6 columns on a landscape phone', () => {
    expect(getBoardDimensions(844, 390)).toEqual({ rows: 4, columns: 6 });
  });

  it('keeps the 6 by 6 board on a large screen', () => {
    expect(getBoardDimensions(1280, 720)).toEqual({ rows: 6, columns: 6 });
  });
});
