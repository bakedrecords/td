import { describe, it, expect } from 'vitest';
import { buildPath, cellCenter } from './Path';
import { STAGES } from './stages';

describe('Path', () => {
  it('buildPath: 曲がり角は軸並行・通過マス判定・正の長さ', () => {
    const p = buildPath(STAGES[0].waypointsGrid);
    expect(p.waypoints.length).toBeGreaterThan(2);
    for (let i = 0; i < p.waypoints.length - 1; i++) {
      const a = p.waypoints[i];
      const b = p.waypoints[i + 1];
      const sameX = Math.abs(a.x - b.x) < 1e-6;
      const sameY = Math.abs(a.y - b.y) < 1e-6;
      expect(sameX || sameY).toBe(true);
    }
    expect(p.length).toBeGreaterThan(0);
  });

  it('isPathCell が経路マスと空きマスを判定する', () => {
    const p = buildPath(STAGES[0].waypointsGrid);
    expect(p.isPathCell(4, 0)).toBe(true); // 上からの縦入口
    expect(p.isPathCell(0, 0)).toBe(false); // 左上の空きマス
  });

  it('cellCenter はマス中心を返す', () => {
    expect(cellCenter(0, 0).x).toBe(40);
  });
});
