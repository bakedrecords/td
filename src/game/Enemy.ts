import type { EnemyType } from './enemyTypes';
import type { Vec2 } from './types';

// テスト等で経路を指定しない場合の既定経路（上から下への直線）。
const DEFAULT_WAYPOINTS: ReadonlyArray<Vec2> = [
  { x: 360, y: -100 },
  { x: 360, y: 2000 },
];

/** 経路に沿って進む敵。種別ごとに HP・速度・装甲・見た目が異なる。 */
export class Enemy {
  readonly type: EnemyType;
  readonly pos: Vec2;
  readonly maxHp: number;
  hp: number;
  readonly baseSpeed: number;
  readonly reward: number;
  readonly radius: number;
  readonly armor: number;

  /** 経路の総移動距離（タワーの「先行した敵」狙い用）。 */
  distanceTraveled = 0;

  private slowTimer = 0;
  private slowFactor = 1;

  private readonly waypoints: ReadonlyArray<Vec2>;
  private seg = 0;
  reachedEnd = false;
  dead = false;

  constructor(
    type: EnemyType,
    hp: number,
    speed: number,
    reward: number,
    waypoints: ReadonlyArray<Vec2> = DEFAULT_WAYPOINTS,
  ) {
    this.type = type;
    this.maxHp = hp;
    this.hp = hp;
    this.baseSpeed = speed;
    this.reward = reward;
    this.radius = type.radius;
    this.armor = type.armor;
    this.waypoints = waypoints;
    this.pos = { x: waypoints[0].x, y: waypoints[0].y };
  }

  get speed(): number {
    return this.slowTimer > 0 ? this.baseSpeed * this.slowFactor : this.baseSpeed;
  }

  get slowed(): boolean {
    return this.slowTimer > 0;
  }

  update(dt: number): void {
    if (this.slowTimer > 0) this.slowTimer -= dt;

    let remaining = this.speed * dt;
    while (remaining > 0 && this.seg < this.waypoints.length - 1) {
      const target = this.waypoints[this.seg + 1];
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

    if (this.seg >= this.waypoints.length - 1) {
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
