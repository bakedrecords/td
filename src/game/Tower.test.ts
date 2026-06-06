import { describe, it, expect } from 'vitest';
import { Tower } from './Tower';
import { Enemy } from './Enemy';
import { Projectile } from './Projectile';
import { TOWER_TYPES } from './towerTypes';
import { ENEMY_TYPES } from './enemyTypes';

describe('Tower', () => {
  it('射程内の敵に向けて弾を撃つ', () => {
    const e = new Enemy(ENEMY_TYPES.normal, 100, 0, 5); // 速度 0 でスポーン地点に静止
    const tower = new Tower({ x: e.pos.x + 30, y: e.pos.y }, TOWER_TYPES.gun, '0,0');
    const projectiles: Projectile[] = [];

    tower.update(1 / 60, [e], projectiles);

    expect(projectiles.length).toBe(1);
  });

  it('射程外の敵には撃たない', () => {
    const e = new Enemy(ENEMY_TYPES.normal, 100, 0, 5);
    const tower = new Tower({ x: e.pos.x + 5000, y: e.pos.y }, TOWER_TYPES.gun, '0,0');
    const projectiles: Projectile[] = [];

    tower.update(1 / 60, [e], projectiles);

    expect(projectiles.length).toBe(0);
  });

  it('アップグレードで威力・射程・連射が上がり、投資額が増える', () => {
    const tower = new Tower({ x: 0, y: 0 }, TOWER_TYPES.gun, '0,0');
    const d0 = tower.damage;
    const r0 = tower.range;
    const f0 = tower.fireRate;

    tower.applyUpgrade(40);

    expect(tower.level).toBe(2);
    expect(tower.damage).toBeGreaterThan(d0);
    expect(tower.range).toBeGreaterThan(r0);
    expect(tower.fireRate).toBeGreaterThan(f0);
    expect(tower.totalInvested).toBe(TOWER_TYPES.gun.cost + 40);
  });
});
