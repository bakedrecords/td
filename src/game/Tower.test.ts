import { describe, it, expect } from 'vitest';
import { Tower } from './Tower';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';

describe('Tower', () => {
  it('射程内の敵に向けて弾を撃つ', () => {
    const e = new Enemy(100, 0, 5); // 速度 0 でスポーン地点に静止
    const tower = new Tower({ x: e.pos.x + 30, y: e.pos.y }, { fireRate: 100 });
    const projectiles: Projectile[] = [];

    tower.update(1 / 60, [e], projectiles);

    expect(projectiles.length).toBe(1);
  });

  it('射程外の敵には撃たない', () => {
    const e = new Enemy(100, 0, 5);
    const tower = new Tower({ x: e.pos.x + 5000, y: e.pos.y }, { range: 100 });
    const projectiles: Projectile[] = [];

    tower.update(1 / 60, [e], projectiles);

    expect(projectiles.length).toBe(0);
  });

  it('弾が敵に当たるとダメージを与える', () => {
    const e = new Enemy(50, 0, 5);
    const p = new Projectile({ x: e.pos.x, y: e.pos.y }, e, 20);

    p.update(1 / 60);

    expect(e.hp).toBe(30);
    expect(p.dead).toBe(true);
  });
});
