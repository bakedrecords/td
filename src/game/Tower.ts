import type { Enemy } from './Enemy';
import { Projectile } from './Projectile';
import { towerStatsAt, type TowerType } from './towerTypes';
import type { Vec2 } from './types';

/** 射程内の敵を狙って弾を撃つタワー。種別とレベルを持つ。 */
export class Tower {
  readonly pos: Vec2;
  readonly type: TowerType;
  readonly cellKey: string; // 設置マス "col,row"（売却時の照合用）
  readonly radius = 26;

  level = 1;
  totalInvested: number; // 売却払い戻しの基準（建設費＋強化費の総額）

  // 現在レベルの実効ステータス（upgrade 時に再計算）
  range = 0;
  damage = 0;
  fireRate = 0;

  /** 砲身の向き（描画用）。初期は上向き。 */
  angle = -Math.PI / 2;

  private cooldown = 0;

  constructor(pos: Vec2, type: TowerType, cellKey: string) {
    this.pos = pos;
    this.type = type;
    this.cellKey = cellKey;
    this.totalInvested = type.cost;
    this.recompute();
  }

  private recompute(): void {
    const s = towerStatsAt(this.type, this.level);
    this.range = s.range;
    this.damage = s.damage;
    this.fireRate = s.fireRate;
  }

  /** レベルを 1 上げ、投資総額に費用を加算する。 */
  applyUpgrade(cost: number): void {
    this.level++;
    this.totalInvested += cost;
    this.recompute();
  }

  update(dt: number, enemies: Enemy[], projectiles: Projectile[]): void {
    this.cooldown -= dt;

    const target = this.pickTarget(enemies);
    if (!target) return;

    // クールダウン中でも砲身は狙いを向ける
    this.angle = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x);

    if (this.cooldown <= 0) {
      projectiles.push(
        new Projectile({ x: this.pos.x, y: this.pos.y }, target, this.damage, {
          speed: this.type.projectileSpeed,
          color: this.type.projectileColor,
          splashRadius: this.type.splashRadius,
          slowFactor: this.type.slowFactor,
          slowDuration: this.type.slowDuration,
        }),
      );
      this.cooldown = 1 / this.fireRate;
    }
  }

  /** 射程内で最も経路を進んでいる（ゴールに近い）敵を狙う。 */
  private pickTarget(enemies: Enemy[]): Enemy | null {
    let best: Enemy | null = null;
    let bestProgress = -Infinity;
    for (const e of enemies) {
      if (e.dead || e.reachedEnd) continue;
      const dist = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
      if (dist <= this.range && e.distanceTraveled > bestProgress) {
        best = e;
        bestProgress = e.distanceTraveled;
      }
    }
    return best;
  }
}
