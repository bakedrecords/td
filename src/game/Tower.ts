import type { Enemy } from './Enemy';
import { Projectile } from './Projectile';
import type { TowerLevel, TowerType } from './towerTypes';
import type { Vec2 } from './types';

/** 射程内の敵を狙って弾を撃つタワー。レベル・スキルで挙動が変化する。 */
export class Tower {
  readonly pos: Vec2;
  readonly type: TowerType;
  cellKey: string; // 設置マス "col,row"（移動で書き換わる）
  readonly radius = 26;

  level = 1;
  totalInvested: number;

  // 現在レベルの実効ステータス
  range = 0;
  damage = 0;
  fireRate = 0;

  // 補助塔から受けるバフ（Game が毎フレーム設定）
  buffMultiplier = 1; // 連射倍率
  damageBuffMultiplier = 1; // 攻撃力倍率（ayase スキル）

  // スキル状態
  skillUsed = false; // 1 ステージ 1 回
  attackDisabledTimer = 0; // >0 で攻撃不能
  fireBurstTimer = 0; // >0 で連射 fireBurstMul 倍
  auraDamageBuffTimer = 0; // ayase: >0 の間、範囲内に攻撃力バフを与える
  slashTimer = 0; // 近接斬撃エフェクト表示用

  angle = -Math.PI / 2;

  private cooldown = 0;
  private fireBurstMul = 1;
  private disableAfterBurst = 0;
  private def!: TowerLevel;

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

  get isSupport(): boolean {
    return this.type.isSupport === true;
  }
  get isMelee(): boolean {
    return this.type.melee === true;
  }
  get supportFireRateMul(): number {
    return this.def.supportFireRateMul ?? 1;
  }
  get levelName(): string | undefined {
    return this.def.name;
  }
  get splashRadius(): number | undefined {
    return this.def.splashRadius;
  }
  get slowFactor(): number | undefined {
    return this.def.slowFactor;
  }
  get attackDisabled(): boolean {
    return this.attackDisabledTimer > 0;
  }

  applyUpgrade(cost: number): void {
    this.level++;
    this.totalInvested += cost;
    this.recompute();
  }

  /** 別マスへ移動（Tsukahara スキル）。 */
  moveTo(pos: Vec2, cellKey: string): void {
    this.pos.x = pos.x;
    this.pos.y = pos.y;
    this.cellKey = cellKey;
  }

  /** 一定時間 攻撃不能にする。 */
  disableAttack(sec: number): void {
    this.attackDisabledTimer = sec;
  }

  /** 連射バースト（mul 倍を sec 秒、その後 disableAfter 秒攻撃不能）。 */
  startFireBurst(mul: number, sec: number, disableAfter: number): void {
    this.fireBurstMul = mul;
    this.fireBurstTimer = sec;
    this.disableAfterBurst = disableAfter;
  }

  update(dt: number, enemies: Enemy[], projectiles: Projectile[]): void {
    if (this.attackDisabledTimer > 0) this.attackDisabledTimer -= dt;
    if (this.slashTimer > 0) this.slashTimer -= dt;
    if (this.auraDamageBuffTimer > 0) this.auraDamageBuffTimer -= dt;
    if (this.fireBurstTimer > 0) {
      this.fireBurstTimer -= dt;
      if (this.fireBurstTimer <= 0) {
        this.fireBurstTimer = 0;
        if (this.disableAfterBurst > 0) {
          this.attackDisabledTimer = this.disableAfterBurst;
          this.disableAfterBurst = 0;
        }
      }
    }

    if (this.isSupport) return; // 補助塔は通常攻撃しない
    this.cooldown -= dt;
    if (this.attackDisabledTimer > 0) return; // 攻撃不能中

    const effFireRate = this.fireRate * this.buffMultiplier * (this.fireBurstTimer > 0 ? this.fireBurstMul : 1);
    const dmg = Math.round(this.damage * this.damageBuffMultiplier);

    if (this.isMelee) {
      // 近接斬撃: 射程内の敵全員にダメージ
      let nearest: Enemy | null = null;
      let nearestD = Infinity;
      const inRange: Enemy[] = [];
      for (const e of enemies) {
        if (e.dead || e.reachedEnd) continue;
        const d = Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y);
        if (d <= this.range) {
          inRange.push(e);
          if (d < nearestD) {
            nearestD = d;
            nearest = e;
          }
        }
      }
      if (!nearest) return;
      this.angle = Math.atan2(nearest.pos.y - this.pos.y, nearest.pos.x - this.pos.x);
      if (this.cooldown <= 0) {
        for (const e of inRange) e.damage(dmg);
        this.slashTimer = 0.14;
        this.cooldown = 1 / effFireRate;
      }
      return;
    }

    // 通常: 単体ターゲット + 弾
    const target = this.pickTarget(enemies);
    if (!target) return;
    this.angle = Math.atan2(target.pos.y - this.pos.y, target.pos.x - this.pos.x);
    if (this.cooldown <= 0) {
      projectiles.push(
        new Projectile({ x: this.pos.x, y: this.pos.y }, target, dmg, {
          speed: this.type.projectileSpeed,
          color: this.def.projectileColor ?? this.type.projectileColor,
          splashRadius: this.def.splashRadius,
          slowFactor: this.def.slowFactor,
          slowDuration: this.def.slowDuration,
        }),
      );
      this.cooldown = 1 / effFireRate;
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
