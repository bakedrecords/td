import { WAYPOINTS } from './Path';
import type { Vec2 } from './types';

/** 経路に沿って進む敵。HP が 0 になると死亡、ゴールに着くと reachedEnd。 */
export class Enemy {
  readonly pos: Vec2;
  readonly maxHp: number;
  hp: number;
  readonly speed: number; // ピクセル/秒
  readonly reward: number; // 撃破時の報酬
  readonly radius = 22;

  /** 経路の総移動距離。タワーが「最も先行した敵」を狙うために使う。 */
  distanceTraveled = 0;

  private seg = 0; // 現在向かっている WAYPOINTS の区間 index
  reachedEnd = false;
  dead = false;

  constructor(hp: number, speed: number, reward: number) {
    this.maxHp = hp;
    this.hp = hp;
    this.speed = speed;
    this.reward = reward;
    this.pos = { x: WAYPOINTS[0].x, y: WAYPOINTS[0].y };
  }

  update(dt: number): void {
    let remaining = this.speed * dt;
    while (remaining > 0 && this.seg < WAYPOINTS.length - 1) {
      const target = WAYPOINTS[this.seg + 1];
      const dx = target.x - this.pos.x;
      const dy = target.y - this.pos.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= remaining) {
        // 次の曲がり角に到達
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

  damage(amount: number): void {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
  }
}
