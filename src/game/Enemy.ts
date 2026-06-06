import type { EnemyType } from './enemyTypes';
import { WAYPOINTS } from './Path';
import type { Vec2 } from './types';

/** 経路に沿って進む敵。種別ごとに HP・速度・装甲・見た目が異なる。 */
export class Enemy {
  readonly type: EnemyType;
  readonly pos: Vec2;
  readonly maxHp: number;
  hp: number;
  readonly baseSpeed: number; // ピクセル/秒（スロー無しの速度）
  readonly reward: number;
  readonly radius: number;
  readonly armor: number;

  /** 経路の総移動距離。タワーが「最も先行した敵」を狙うために使う。 */
  distanceTraveled = 0;

  // スロー（フロスト塔）効果
  private slowTimer = 0;
  private slowFactor = 1;

  private seg = 0; // 現在向かっている WAYPOINTS の区間 index
  reachedEnd = false;
  dead = false;

  constructor(type: EnemyType, hp: number, speed: number, reward: number) {
    this.type = type;
    this.maxHp = hp;
    this.hp = hp;
    this.baseSpeed = speed;
    this.reward = reward;
    this.radius = type.radius;
    this.armor = type.armor;
    this.pos = { x: WAYPOINTS[0].x, y: WAYPOINTS[0].y };
  }

  /** 現在の実効速度（スロー中は減速）。 */
  get speed(): number {
    return this.slowTimer > 0 ? this.baseSpeed * this.slowFactor : this.baseSpeed;
  }

  get slowed(): boolean {
    return this.slowTimer > 0;
  }

  update(dt: number): void {
    if (this.slowTimer > 0) this.slowTimer -= dt;

    let remaining = this.speed * dt;
    while (remaining > 0 && this.seg < WAYPOINTS.length - 1) {
      const target = WAYPOINTS[this.seg + 1];
      const dx = target.x - this.pos.x;
      const dy = target.y - this.pos.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= remaining) {
        this.pos.x = target.x;
        this.pos.y = target.y;
        this.distanceTraveled += dist;
        remaining -= dist;
        this.seg++;
      } else {
        this.pos.x += (dx / dist) * remaining;
        this.pos.y += (dy / dist) * remaining;
        this.distanceTraveled += remaining;
        remaining = 0;
      }
    }

    if (this.seg >= WAYPOINTS.length - 1) {
      this.reachedEnd = true;
    }
  }

  /** ダメージを与える。装甲ぶんは軽減されるが最低 1 は通る。 */
  damage(amount: number): void {
    const effective = Math.max(1, amount - this.armor);
    this.hp -= effective;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
  }

  /** 減速効果を付与（より強い係数を優先し、持続は長い方を採用）。 */
  applySlow(factor: number, duration: number): void {
    this.slowFactor = this.slowTimer > 0 ? Math.min(this.slowFactor, factor) : factor;
    this.slowTimer = Math.max(this.slowTimer, duration);
  }
}
