import {
  COLORS,
  COLS,
  GRID_BOTTOM,
  GRID_TOP,
  ROWS,
  START_LIVES,
  START_MONEY,
  TILE,
  TOTAL_WAVES,
  TOWER_COST,
  VIRTUAL_H,
  VIRTUAL_W,
} from './constants';
import { Enemy } from './Enemy';
import { cellCenter, isPathCell, WAYPOINTS } from './Path';
import { Projectile } from './Projectile';
import { Tower } from './Tower';
import type { GameState, Vec2 } from './types';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * ゲーム全体の状態・更新・描画を統括するクラス。
 * 仮想座標系（720x1280）で考え、入力も仮想座標で受け取る。
 */
export class Game {
  private enemies: Enemy[] = [];
  private towers: Tower[] = [];
  private projectiles: Projectile[] = [];
  private occupied = new Set<string>(); // タワーが建っているマス "col,row"

  lives = START_LIVES;
  money = START_MONEY;
  wave = 0;
  state: GameState = 'ready';

  // 現在のウェーブの敵スポーン管理
  private spawnQueue = 0;
  private spawnTimer = 0;
  private spawnInterval = 0.8;
  private waveHp = 0;
  private waveSpeed = 0;
  private waveReward = 0;

  private readonly startBtn: Rect = {
    x: VIRTUAL_W / 2 - 220,
    y: 1162,
    w: 440,
    h: 92,
  };

  // ---- 更新 -------------------------------------------------------------

  update(dt: number): void {
    if (this.state === 'gameover' || this.state === 'victory') return;

    this.updateSpawning(dt);

    for (const t of this.towers) {
      t.update(dt, this.enemies, this.projectiles);
    }

    for (const p of this.projectiles) p.update(dt);
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    this.updateEnemies(dt);
    this.checkWaveComplete();
  }

  private updateSpawning(dt: number): void {
    if (this.state !== 'wave' || this.spawnQueue <= 0) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.enemies.push(new Enemy(this.waveHp, this.waveSpeed, this.waveReward));
      this.spawnQueue--;
      this.spawnTimer = this.spawnInterval;
    }
  }

  private updateEnemies(dt: number): void {
    const survivors: Enemy[] = [];
    for (const e of this.enemies) {
      e.update(dt);
      if (e.reachedEnd) {
        // ゴール到達 → ライフ -1
        this.lives = Math.max(0, this.lives - 1);
        if (this.lives === 0) this.state = 'gameover';
        continue;
      }
      if (e.dead) {
        // 撃破 → 報酬
        this.money += e.reward;
        continue;
      }
      survivors.push(e);
    }
    this.enemies = survivors;
  }

  private checkWaveComplete(): void {
    if (this.state !== 'wave') return;
    if (this.spawnQueue === 0 && this.enemies.length === 0) {
      this.state = this.wave >= TOTAL_WAVES ? 'victory' : 'ready';
    }
  }

  private startWave(): void {
    if (this.state !== 'ready') return;
    this.wave++;
    this.waveHp = Math.round(28 + (this.wave - 1) * 16);
    this.waveSpeed = 70 + (this.wave - 1) * 5;
    this.waveReward = 6 + this.wave;
    this.spawnQueue = 4 + this.wave * 2;
    this.spawnInterval = Math.max(0.35, 0.85 - this.wave * 0.03);
    this.spawnTimer = 0;
    this.state = 'wave';
  }

  private reset(): void {
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.occupied.clear();
    this.lives = START_LIVES;
    this.money = START_MONEY;
    this.wave = 0;
    this.state = 'ready';
    this.spawnQueue = 0;
    this.spawnTimer = 0;
  }

  // ---- 入力 -------------------------------------------------------------

  handlePointer(v: Vec2): void {
    if (this.state === 'gameover' || this.state === 'victory') {
      this.reset();
      return;
    }

    if (this.state === 'ready' && this.inRect(v, this.startBtn)) {
      this.startWave();
      return;
    }

    // グリッド内タップ → タワー設置
    if (v.x >= 0 && v.x < COLS * TILE && v.y >= GRID_TOP && v.y < GRID_BOTTOM) {
      const col = Math.floor(v.x / TILE);
      const row = Math.floor((v.y - GRID_TOP) / TILE);
      this.tryPlaceTower(col, row);
    }
  }

  private tryPlaceTower(col: number, row: number): void {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    const key = `${col},${row}`;
    if (isPathCell(col, row)) return; // 経路上は不可
    if (this.occupied.has(key)) return; // 既に建っている
    if (this.money < TOWER_COST) return; // 資金不足

    this.money -= TOWER_COST;
    this.occupied.add(key);
    this.towers.push(new Tower(cellCenter(col, row)));
  }

  private inRect(v: Vec2, r: Rect): boolean {
    return v.x >= r.x && v.x <= r.x + r.w && v.y >= r.y && v.y <= r.y + r.h;
  }

  // ---- 描画 -------------------------------------------------------------

  render(ctx: CanvasRenderingContext2D): void {
    this.renderField(ctx);
    this.renderPath(ctx);
    this.renderTowers(ctx);
    this.renderEnemies(ctx);
    this.renderProjectiles(ctx);
    this.renderTopBar(ctx);
    this.renderBottomBar(ctx);
    if (this.state === 'gameover' || this.state === 'victory') {
      this.renderOverlay(ctx);
    }
  }

  private renderField(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.field;
    ctx.fillRect(0, GRID_TOP, VIRTUAL_W, ROWS * TILE);

    // 設置可能マスをタイル状に描く（経路マスは下地のまま）
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (isPathCell(c, r)) continue;
        const x = c * TILE;
        const y = GRID_TOP + r * TILE;
        ctx.fillStyle = COLORS.buildable;
        this.roundRect(ctx, x + 3, y + 3, TILE - 6, TILE - 6, 8);
        ctx.fill();
      }
    }
  }

  private renderPath(ctx: CanvasRenderingContext2D): void {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.strokeStyle = COLORS.pathOuter;
    ctx.lineWidth = TILE * 0.82;
    this.strokeWaypoints(ctx);

    ctx.strokeStyle = COLORS.pathInner;
    ctx.lineWidth = TILE * 0.56;
    this.strokeWaypoints(ctx);
  }

  private strokeWaypoints(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();
    ctx.moveTo(WAYPOINTS[0].x, WAYPOINTS[0].y);
    for (let i = 1; i < WAYPOINTS.length; i++) {
      ctx.lineTo(WAYPOINTS[i].x, WAYPOINTS[i].y);
    }
    ctx.stroke();
  }

  private renderTowers(ctx: CanvasRenderingContext2D): void {
    for (const t of this.towers) {
      // 射程の薄いリング
      ctx.strokeStyle = 'rgba(90, 209, 196, 0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.pos.x, t.pos.y, t.stats.range, 0, Math.PI * 2);
      ctx.stroke();

      // 土台
      ctx.fillStyle = COLORS.towerBase;
      this.roundRect(
        ctx,
        t.pos.x - t.radius,
        t.pos.y - t.radius,
        t.radius * 2,
        t.radius * 2,
        10,
      );
      ctx.fill();

      // 砲塔
      ctx.fillStyle = COLORS.tower;
      ctx.beginPath();
      ctx.arc(t.pos.x, t.pos.y, t.radius * 0.62, 0, Math.PI * 2);
      ctx.fill();

      // 砲身（ターゲット方向）
      ctx.save();
      ctx.translate(t.pos.x, t.pos.y);
      ctx.rotate(t.angle);
      ctx.fillStyle = COLORS.tower;
      this.roundRect(ctx, 0, -7, t.radius + 10, 14, 6);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderEnemies(ctx: CanvasRenderingContext2D): void {
    for (const e of this.enemies) {
      ctx.fillStyle = COLORS.enemy;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = COLORS.enemyDeep;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // HP バー
      const w = e.radius * 2;
      const h = 6;
      const x = e.pos.x - e.radius;
      const y = e.pos.y - e.radius - 12;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      this.roundRect(ctx, x, y, w, h, 3);
      ctx.fill();
      ctx.fillStyle = COLORS.accent;
      this.roundRect(ctx, x, y, w * (e.hp / e.maxHp), h, 3);
      ctx.fill();
    }
  }

  private renderProjectiles(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.projectile;
    for (const p of this.projectiles) {
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderTopBar(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(0, 0, VIRTUAL_W, GRID_TOP);
    ctx.strokeStyle = COLORS.panelLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GRID_TOP);
    ctx.lineTo(VIRTUAL_W, GRID_TOP);
    ctx.stroke();

    this.stat(ctx, 120, 'ライフ', String(this.lives), COLORS.life);
    this.stat(ctx, 360, 'ゴールド', String(this.money), COLORS.money);
    this.stat(ctx, 600, 'ウェーブ', `${this.wave}/${TOTAL_WAVES}`, COLORS.wave);
  }

  private stat(
    ctx: CanvasRenderingContext2D,
    cx: number,
    label: string,
    value: string,
    color: string,
  ): void {
    this.text(ctx, label, cx, 56, 24, COLORS.textDim);
    this.text(ctx, value, cx, 108, 50, color);
  }

  private renderBottomBar(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(0, GRID_BOTTOM, VIRTUAL_W, VIRTUAL_H - GRID_BOTTOM);
    ctx.strokeStyle = COLORS.panelLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GRID_BOTTOM);
    ctx.lineTo(VIRTUAL_W, GRID_BOTTOM);
    ctx.stroke();

    this.text(
      ctx,
      `空きマスをタップでタワー設置（${TOWER_COST}G）`,
      VIRTUAL_W / 2,
      1140,
      24,
      COLORS.textDim,
    );

    if (this.state === 'ready') {
      this.button(ctx, this.startBtn, `WAVE ${this.wave + 1} スタート`);
    } else if (this.state === 'wave') {
      const remaining = this.enemies.length + this.spawnQueue;
      this.text(
        ctx,
        `WAVE ${this.wave} 進行中  ／  残り ${remaining}`,
        VIRTUAL_W / 2,
        1208,
        34,
        COLORS.text,
      );
    }
  }

  private button(ctx: CanvasRenderingContext2D, r: Rect, label: string): void {
    ctx.fillStyle = COLORS.accent;
    this.roundRect(ctx, r.x, r.y, r.w, r.h, 18);
    ctx.fill();
    this.text(ctx, label, r.x + r.w / 2, r.y + r.h / 2, 38, '#04130d');
  }

  private renderOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(5, 7, 15, 0.8)';
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    const victory = this.state === 'victory';
    const title = victory ? 'クリア！' : 'ゲームオーバー';
    const color = victory ? COLORS.accent : COLORS.danger;
    const subtitle = victory
      ? `全 ${TOTAL_WAVES} ウェーブ防衛成功！`
      : `WAVE ${this.wave} まで到達`;

    this.text(ctx, title, VIRTUAL_W / 2, 540, 88, color);
    this.text(ctx, subtitle, VIRTUAL_W / 2, 640, 34, COLORS.textDim);
    this.text(ctx, 'タップでリスタート', VIRTUAL_W / 2, 740, 36, COLORS.text);
  }

  // ---- 描画ヘルパー -----------------------------------------------------

  private text(
    ctx: CanvasRenderingContext2D,
    str: string,
    x: number,
    y: number,
    size: number,
    color: string,
  ): void {
    ctx.fillStyle = color;
    ctx.font = `bold ${size}px system-ui, "Hiragino Sans", "Noto Sans JP", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
}
