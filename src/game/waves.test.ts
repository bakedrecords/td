import { describe, it, expect } from 'vitest';
import { WAVES, enemyBaseStats } from './waves';
import { ENEMY_TYPES } from './enemyTypes';
import { TOTAL_WAVES } from './constants';

describe('waves', () => {
  it('TOTAL_WAVES と定義数が一致する', () => {
    expect(WAVES.length).toBe(TOTAL_WAVES);
  });

  it('全ウェーブのグループが有効な敵種別と正の数を持つ', () => {
    for (const w of WAVES) {
      expect(w.groups.length).toBeGreaterThan(0);
      for (const g of w.groups) {
        expect(ENEMY_TYPES[g.type]).toBeDefined();
        expect(g.count).toBeGreaterThan(0);
        expect(g.interval).toBeGreaterThan(0);
      }
    }
  });

  it('ウェーブが進むほど基準 HP が増える', () => {
    expect(enemyBaseStats(2).hp).toBeGreaterThan(enemyBaseStats(1).hp);
  });
});
