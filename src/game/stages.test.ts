import { describe, it, expect } from 'vitest';
import { STAGES } from './stages';
import { ENEMY_TYPES } from './enemyTypes';
import { buildPath } from './Path';

describe('stages', () => {
  it('3 ステージある', () => {
    expect(STAGES.length).toBe(3);
  });

  it('各ステージの経路は軸並行で、上から入り下へ抜ける', () => {
    for (const st of STAGES) {
      const grid = st.waypointsGrid;
      expect(grid.length).toBeGreaterThan(2);
      for (let i = 0; i < grid.length - 1; i++) {
        const [c0, r0] = grid[i];
        const [c1, r1] = grid[i + 1];
        expect(c0 === c1 || r0 === r1).toBe(true); // 縦 or 横のみ
      }
      expect(grid[0][1]).toBeLessThan(0); // 入口は画面上の外
      expect(grid[grid.length - 1][1]).toBeGreaterThanOrEqual(12); // 出口は画面下の外
      expect(buildPath(grid).length).toBeGreaterThan(0);
    }
  });

  it('各ステージのウェーブ定義が有効', () => {
    for (const st of STAGES) {
      expect(st.waves.length).toBeGreaterThan(0);
      expect(st.startMoney).toBeGreaterThan(0);
      expect(st.startLives).toBeGreaterThan(0);
      for (const w of st.waves) {
        expect(w.groups.length).toBeGreaterThan(0);
        for (const g of w.groups) {
          expect(ENEMY_TYPES[g.type]).toBeDefined();
          expect(g.count).toBeGreaterThan(0);
          expect(g.interval).toBeGreaterThan(0);
        }
      }
    }
  });

  it('後のステージほど開始ゴールドが多い', () => {
    expect(STAGES[1].startMoney).toBeGreaterThan(STAGES[0].startMoney);
    expect(STAGES[2].startMoney).toBeGreaterThan(STAGES[1].startMoney);
  });
});
