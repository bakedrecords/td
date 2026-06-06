import type { Enemy } from './Enemy';
import type { Vec2 } from './types';

export interface ProjectileEffect {
  speed: number;
  color: string;
  splashRadius?: number;
  slowFactor?: number;
  slowDuration?: number;
}

/** タワーが発射する弾。ターゲットを追尾し、命中で効果を適用して消える。 */
export class Projectile {
  readonly pos: Vec2;
  private readonly target: Enemy;
  private readonly damage: number;
  readonly effect: ProjectileEffect;
  readonly radius: number;
  dead = false;

  constructor(pos: Vec2, target: Enemy, damage: number, effect: ProjectileEffect) {
    this.pos = pos;
    this.target = target;
    this.damage = damage;
    this.effect = effect;
    this.radius = effect.splashRadius ? 9 : 6;
  }

  update(dt: number, enemies: Enemy[]): void {
    // ターゲットが既にいなくなっていたら不発で消える
    if (this.target.dead || this.target.reachedEnd) {
      this.dead = true;
      return;
    }

    const dx = this.target.pos.x - this.pos.x;
    const dy = this.target.pos.y - this.pos.y;
    const dist = Math.hypot(dx, dy);
    const step = this.effect.speed * dt;

    if (dist <= step) {
      this.hit(enemies);
      this.dead = true;
    } else {
      this.pos.x += (dx / dist) * step;
      this.pos.y += (dy / dist) * step;
    }
  }

  private apply(e: Enemy): void {
    e.damage(this.damage);
    if (this.effect.slowFactor) {
      e.applySlow(this.effect.slowFactor, this.effect.slowDuration ?? 1);
    }
  }

  private hit(enemies: Enemy[]): void {
    const splash = this.effect.splashRadius;
    if (splash) {
      // 着弾点の周囲にいる敵すべてに効果を適用
      for (const e of enemies) {
        if (e.dead || e.reachedEnd) continue;
        if (Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y) <= splash) {
          this.apply(e);
        }
      }
    } else {
      this.apply(this.target);
    }
  }
}
