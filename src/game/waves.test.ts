import { describe, it, expect } from 'vitest';
import { enemyBaseStats } from './waves';

describe('waves', () => {
  it('ウェーブが進むほど基準 HP が増える', () => {
    expect(enemyBaseStats(2, 0).hp).toBeGreaterThan(enemyBaseStats(1, 0).hp);
  });

  it('後のステージほど同じウェーブの HP が高い', () => {
    expect(enemyBaseStats(1, 1).hp).toBeGreaterThan(enemyBaseStats(1, 0).hp);
    expect(enemyBaseStats(1, 2).hp).toBeGreaterThan(enemyBaseStats(1, 1).hp);
  });
});
