import type { Enemy } from './Enemy';
import { Projectile } from './Projectile';
import type { Vec2 } from './types';

export interface TowerStats {
  range: number; // 射程（ピクセル）
  damage: number; // 1 発のダメージ
  fireRate: number; // 1 秒あたりの発射数
}

export const DEFAULT_TOWER_STATS: TowerStats = {
  range: 170,
  damage: 18,
  fireRate: 1.5,
};

/** 射程内の敵を狙って弾を撃つタワー。 */
export class Tower {
  readonly pos: Vec2;
  readonly stats: TowerStats;
  readonly radius = 26;

  /** 砲身の向き（描画用）。初期は上向き。 */
  angle = -Math.PI / 2;

  private cooldown = 0;

  constructor(pos: Vec2, stats: Partial<TowerStats> = {}) {
    this.pos = pos;
    this.stats = { ...DEFAULT_TOWER_STATS, ...stats };
  }

  update(dt: number, enemies: Enemy[], projectiles: Projectile[]): void {
    this.cooldown -= dt;

    const target = this.pickTarget(enemies);
    if (!target) return;

    // クールダウン中でも砲身は狙いを向ける
    this.angle = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x);

    if (this.cooldown <= 0) {
      projectiles.push(
        new Projectile({ x: this.pos.x, y: this.pos.y }, target, this.stats.damage),
      );
      this.cooldown = 1 / this.stats.fireRate;
    }
  }

  /** 射程内で最も経路を進んでいる（ゴールに近い）敵を狙う。 */
  private pickTarget(enemies: Enemy[]): Enemy | null {
    let best: Enemy | null = null;
    let bestProgress = -Infinity;
    for (const e of enemies) {
      if (e.dead || e.reachedEnd) continue;
      const dist = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
      if (dist <= this.stats.range && e.distanceTraveled > bestProgress) {
        best = e;
        bestProgress = e.distanceTraveled;
      }
    }
    return best;
  }
}
