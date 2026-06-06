import { describe, it, expect } from 'vitest';
import { Enemy } from './Enemy';
import { ENEMY_TYPES } from './enemyTypes';

describe('Enemy', () => {
  it('経路に沿って進み、最終的にゴールへ到達する', () => {
    const e = new Enemy(ENEMY_TYPES.normal, 100, 200, 5);
    let guard = 0;
    while (!e.reachedEnd && guard++ < 100_000) {
      e.update(1 / 60);
    }
    expect(e.reachedEnd).toBe(true);
    expect(e.distanceTraveled).toBeGreaterThan(0);
  });

  it('HP を超えるダメージで死亡する', () => {
    const e = new Enemy(ENEMY_TYPES.normal, 30, 100, 5);
    e.damage(20);
    expect(e.dead).toBe(false);
    e.damage(20);
    expect(e.dead).toBe(true);
    expect(e.hp).toBe(0);
  });

  it('装甲はダメージを軽減するが最低 1 は通る', () => {
    const e = new Enemy(ENEMY_TYPES.tank, 100, 50, 9); // armor 4
    e.damage(10); // 実効 6
    expect(e.hp).toBe(94);
    e.damage(2); // 実効 max(1, 2-4) = 1
    expect(e.hp).toBe(93);
  });

  it('スローで速度が下がり、時間経過で元に戻る', () => {
    const e = new Enemy(ENEMY_TYPES.normal, 100, 80, 5);
    expect(e.speed).toBe(80);

    e.applySlow(0.5, 1);
    expect(e.slowed).toBe(true);
    expect(e.speed).toBeCloseTo(40);

    for (let i = 0; i < 70; i++) e.update(1 / 60); // 約 1.17 秒経過
    expect(e.slowed).toBe(false);
    expect(e.speed).toBe(80);
  });
});
