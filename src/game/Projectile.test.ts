import { describe, it, expect } from 'vitest';
import { Projectile } from './Projectile';
import { Enemy } from './Enemy';
import { ENEMY_TYPES } from './enemyTypes';

describe('Projectile', () => {
  it('命中した敵にダメージを与えて消える', () => {
    const e = new Enemy(ENEMY_TYPES.normal, 50, 0, 5);
    const p = new Projectile({ x: e.pos.x, y: e.pos.y }, e, 20, {
      speed: 600,
      color: '#fff',
    });

    p.update(1 / 60, [e]);

    expect(e.hp).toBe(30);
    expect(p.dead).toBe(true);
  });

  it('範囲攻撃は着弾点周囲の複数の敵に当たる', () => {
    const e1 = new Enemy(ENEMY_TYPES.normal, 100, 0, 5);
    const e2 = new Enemy(ENEMY_TYPES.normal, 100, 0, 5);
    e1.pos.x = 100;
    e1.pos.y = 100;
    e2.pos.x = 130;
    e2.pos.y = 100;

    const p = new Projectile({ x: 100, y: 100 }, e1, 10, {
      speed: 600,
      color: '#fff',
      splashRadius: 70,
    });

    p.update(1 / 60, [e1, e2]);

    expect(e1.hp).toBeLessThan(100);
    expect(e2.hp).toBeLessThan(100);
  });

  it('スロー弾は命中した敵を減速させる', () => {
    const e = new Enemy(ENEMY_TYPES.normal, 100, 80, 5);
    const p = new Projectile({ x: e.pos.x, y: e.pos.y }, e, 5, {
      speed: 600,
      color: '#fff',
      slowFactor: 0.5,
      slowDuration: 1,
    });

    p.update(1 / 60, [e]);

    expect(e.slowed).toBe(true);
    expect(e.speed).toBeCloseTo(40);
  });
});
