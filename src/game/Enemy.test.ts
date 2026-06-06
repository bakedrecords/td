import { describe, it, expect } from 'vitest';
import { Enemy } from './Enemy';

describe('Enemy', () => {
  it('経路に沿って進み、最終的にゴールへ到達する', () => {
    const e = new Enemy(100, 200, 5);
    let guard = 0;
    while (!e.reachedEnd && guard++ < 100_000) {
      e.update(1 / 60);
    }
    expect(e.reachedEnd).toBe(true);
    expect(e.distanceTraveled).toBeGreaterThan(0);
  });

  it('HP を超えるダメージで死亡する', () => {
    const e = new Enemy(30, 100, 5);
    e.damage(20);
    expect(e.dead).toBe(false);
    e.damage(20);
    expect(e.dead).toBe(true);
    expect(e.hp).toBe(0);
  });
});
