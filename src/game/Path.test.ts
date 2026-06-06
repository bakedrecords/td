import { describe, it, expect } from 'vitest';
import { WAYPOINTS, isPathCell, pathLength } from './Path';

describe('Path', () => {
  it('経路の曲がり角が 3 点以上ある', () => {
    expect(WAYPOINTS.length).toBeGreaterThan(2);
  });

  it('連続する区間はすべて縦か横（斜め移動が無い）', () => {
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
      const a = WAYPOINTS[i];
      const b = WAYPOINTS[i + 1];
      const sameX = Math.abs(a.x - b.x) < 1e-6;
      const sameY = Math.abs(a.y - b.y) < 1e-6;
      expect(sameX || sameY).toBe(true);
    }
  });

  it('経路マスとそうでないマスを正しく判定する', () => {
    expect(isPathCell(4, 0)).toBe(true); // 上からの縦入口
    expect(isPathCell(0, 0)).toBe(false); // 左上の設置可能マス
  });

  it('経路の総延長は正の値', () => {
    expect(pathLength()).toBeGreaterThan(0);
  });
});
