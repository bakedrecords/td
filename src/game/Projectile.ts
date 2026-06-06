import type { Enemy } from './Enemy';
import type { Vec2 } from './types';

/** タワーが発射する弾。ターゲットを追尾し、命中でダメージを与えて消える。 */
export class Projectile {
  readonly pos: Vec2;
  private readonly target: Enemy;
  private readonly damage: number;
  readonly speed = 620; // ピクセル/秒
  readonly radius = 7;
  dead = false;

  constructor(pos: Vec2, target: Enemy, damage: number) {
    this.pos = pos;
    this.target = target;
    this.damage = damage;
  }

  update(dt: number): void {
    // ターゲットが既にいなくなっていたら不発で消える
    if (this.target.dead || this.target.reachedEnd) {
      this.dead = true;
      return;
    }

    const dx = this.target.pos.x - this.pos.x;
    const dy = this.target.pos.y - this.pos.y;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * dt;

    if (dist <= step) {
      this.target.damage(this.damage);
      this.dead = true;
    } else {
      this.pos.x += (dx / dist) * step;
      this.pos.y += (dy / dist) * step;
    }
  }
}
