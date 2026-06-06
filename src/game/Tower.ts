import type { Enemy } from './Enemy';
import { Projectile } from './Projectile';
import type { TowerLevel, TowerType } from './towerTypes';
import type { Vec2 } from './types';

/** 射程内の敵を狙って弾を撃つタワー。レベルごとに性能・特殊効果が変化する。 */
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

  /** 補助塔から受けている連射倍率（Game が毎フレーム設定）。 */
  buffMultiplier = 1;

  /** 砲身の向き（描画用）。初期は上向き。 */
  angle = -Math.PI / 2;

  private cooldown = 0;
  private def!: TowerLevel; // 現在レベルの定義

  constructor(pos: Vec2, type: TowerType, cellKey: string) {
    this.pos = pos;
    this.type = type;
    this.cellKey = cellKey;
    this.totalInvested = type.cost;
    this.recompute();
  }

  private recompute(): void {
    this.def = this.type.levels[this.level - 1];
    this.range = this.def.range;
    this.damage = this.def.damage;
    this.fireRate = this.def.fireRate;
  }

  /** 補助塔かどうか。 */
  get isSupport(): boolean {
    return this.type.isSupport === true;
  }

  /** 補助塔として味方に与える連射倍率（攻撃塔なら 1）。 */
  get supportFireRateMul(): number {
    return this.def.supportFireRateMul ?? 1;
  }

  /** 現在レベルの呼び名（あれば）。 */
  get levelName(): string | undefined {
    return this.def.name;
  }

  /** 現在レベルが範囲攻撃を持つなら半径。 */
  get splashRadius(): number | undefined {
    return this.def.splashRadius;
  }

  /** 現在レベルが減速を持つなら係数。 */
  get slowFactor(): number | undefined {
    return this.def.slowFactor;
  }

  /** レベルを 1 上げ、投資総額に費用を加算する。 */
  applyUpgrade(cost: number): void {
    this.level++;
    this.totalInvested += cost;
    this.recompute();
  }

  update(dt: number, enemies: Enemy[], projectiles: Projectile[]): void {
    if (this.isSupport) return; // 補助塔は攻撃しない

    this.cooldown -= dt;

    const target = this.pickTarget(enemies);
    if (!target) return;

    // クールダウン中でも砲身は狙いを向ける
    this.angle = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x);

    if (this.cooldown <= 0) {
      projectiles.push(
        new Projectile({ x: this.pos.x, y: this.pos.y }, target, this.damage, {
          speed: this.type.projectileSpeed,
          color: this.def.projectileColor ?? this.type.projectileColor,
          splashRadius: this.def.splashRadius,
          slowFactor: this.def.slowFactor,
          slowDuration: this.def.slowDuration,
        }),
      );
      // 補助塔の連射バフを反映（buffMultiplier 倍だけ間隔を短縮）
      this.cooldown = 1 / (this.fireRate * this.buffMultiplier);
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
