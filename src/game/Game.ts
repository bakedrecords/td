import {
  COLORS,
  COLS,
  GRID_BOTTOM,
  GRID_TOP,
  ROWS,
  SELL_REFUND_RATE,
  START_LIVES,
  START_MONEY,
  TILE,
  TOTAL_WAVES,
  VIRTUAL_H,
  VIRTUAL_W,
} from './constants';
import { Enemy } from './Enemy';
import { ENEMY_TYPES } from './enemyTypes';
import { cellCenter, isPathCell, WAYPOINTS } from './Path';
import { Projectile } from './Projectile';
import { Tower } from './Tower';
import {
  TOWER_TYPES,
  TOWER_TYPE_LIST,
  upgradeCost,
  type TowerTypeId,
} from './towerTypes';
import type { EnemyType } from './enemyTypes';
import { WAVES, enemyBaseStats } from './waves';
import type { GameState, Vec2 } from './types';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SpawnItem {
  type: EnemyType;
  hp: number;
  speed: number;
  reward: number;
  interval: number;
}

/**
 * ゲーム全体の状態・更新・描画を統括するクラス。
 * 仮想座標系（720x1280）で考え、入力も仮想座標で受け取る。
 */
export class Game {
  private enemies: Enemy[] = [];
  private towers = new Map<string, Tower>(); // "col,row" -> Tower
  private projectiles: Projectile[] = [];

  lives = START_LIVES;
  money = START_MONEY;
  wave = 0;
  state: GameState = 'ready';

  // 建設対象のタワー種別 / 選択中の既設タワー
  private buildType: TowerTypeId = 'gun';
  private selectedTower: Tower | null = null;

  // 現在のウェーブの敵スポーン管理
  private spawnList: SpawnItem[] = [];
  private spawnIndex = 0;
  private spawnTimer = 0;

  // ---- 更新 -------------------------------------------------------------

  update(dt: number): void {
    if (this.state === 'gameover' || this.state === 'victory') return;

    this.updateSpawning(dt);

    for (const t of this.towers.values()) {
      t.update(dt, this.enemies, this.projectiles);
    }

    for (const p of this.projectiles) p.update(dt, this.enemies);
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    this.updateEnemies(dt);
    this.checkWaveComplete();
  }

  private updateSpawning(dt: number): void {
    if (this.state !== 'wave' || this.spawnIndex >= this.spawnList.length) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const item = this.spawnList[this.spawnIndex];
      this.enemies.push(new Enemy(item.type, item.hp, item.speed, item.reward));
      this.spawnIndex++;
      this.spawnTimer = item.interval;
    }
  }

  private updateEnemies(dt: number): void {
    const survivors: Enemy[] = [];
    for (const e of this.enemies) {
      e.update(dt);
      if (e.reachedEnd) {
        this.lives = Math.max(0, this.lives - 1);
        if (this.lives === 0) this.state = 'gameover';
        continue;
      }
      if (e.dead) {
        this.money += e.reward;
        continue;
      }
      survivors.push(e);
    }
    this.enemies = survivors;
  }

  private checkWaveComplete(): void {
    if (this.state !== 'wave') return;
    if (this.spawnIndex >= this.spawnList.length && this.enemies.length === 0) {
      this.state = this.wave >= TOTAL_WAVES ? 'victory' : 'ready';
    }
  }

  private startWave(): void {
    if (this.state !== 'ready') return;
    this.wave++;
    const def = WAVES[Math.min(this.wave, WAVES.length) - 1];
    const base = enemyBaseStats(this.wave);
    const list: SpawnItem[] = [];
    for (const g of def.groups) {
      const et = ENEMY_TYPES[g.type];
      for (let i = 0; i < g.count; i++) {
        list.push({
          type: et,
          hp: Math.round(base.hp * et.hpMul),
          speed: base.speed * et.speedMul,
          reward: et.reward + Math.floor(this.wave / 3),
          interval: g.interval,
        });
      }
    }
    this.spawnList = list;
    this.spawnIndex = 0;
    this.spawnTimer = 0;
    this.state = 'wave';
  }

  private reset(): void {
    this.enemies = [];
    this.towers.clear();
    this.projectiles = [];
    this.lives = START_LIVES;
    this.money = START_MONEY;
    this.wave = 0;
    this.state = 'ready';
    this.buildType = 'gun';
    this.selectedTower = null;
    this.spawnList = [];
    this.spawnIndex = 0;
    this.spawnTimer = 0;
  }

  private get remainingEnemies(): number {
    return this.spawnList.length - this.spawnIndex + this.enemies.length;
  }

  // ---- 入力 -------------------------------------------------------------

  handlePointer(v: Vec2): void {
    if (this.state === 'gameover' || this.state === 'victory') {
      this.reset();
      return;
    }

    // 選択中タワーの操作（強化・売却）
    if (this.selectedTower) {
      if (this.inRect(v, this.upgradeBtn)) {
        this.tryUpgradeSelected();
        return;
      }
      if (this.inRect(v, this.sellBtn)) {
        this.sellSelected();
        return;
      }
    }

    // 下部パネル
    if (v.y >= GRID_BOTTOM) {
      if (!this.selectedTower) {
        for (let i = 0; i < TOWER_TYPE_LIST.length; i++) {
          if (this.inRect(v, this.paletteRect(i))) {
            this.buildType = TOWER_TYPE_LIST[i].id;
            return;
          }
        }
        if (this.state === 'ready' && this.inRect(v, this.startBtn)) {
          this.startWave();
          return;
        }
      }
      return; // パネル内のその他は無効（選択は維持）
    }

    // グリッド内
    if (v.x >= 0 && v.x < COLS * TILE && v.y >= GRID_TOP && v.y < GRID_BOTTOM) {
      const col = Math.floor(v.x / TILE);
      const row = Math.floor((v.y - GRID_TOP) / TILE);
      const key = `${col},${row}`;
      const existing = this.towers.get(key);
      if (existing) {
        this.selectedTower = existing; // 既設タワーを選択
        return;
      }
      if (this.selectedTower) {
        this.selectedTower = null; // 空きマスで選択解除
        return;
      }
      this.tryPlaceTower(col, row); // 新規建設
      return;
    }

    // 上部 HUD など → 選択解除
    this.selectedTower = null;
  }

  private tryPlaceTower(col: number, row: number): void {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    const key = `${col},${row}`;
    if (isPathCell(col, row)) return;
    if (this.towers.has(key)) return;
    const type = TOWER_TYPES[this.buildType];
    if (this.money < type.cost) return;
    this.money -= type.cost;
    this.towers.set(key, new Tower(cellCenter(col, row), type, key));
  }

  private tryUpgradeSelected(): void {
    const t = this.selectedTower;
    if (!t) return;
    const cost = upgradeCost(t.type, t.level);
    if (cost === null) return; // 最大レベル
    if (this.money < cost) return;
    this.money -= cost;
    t.applyUpgrade(cost);
  }

  private sellSelected(): void {
    const t = this.selectedTower;
    if (!t) return;
    this.money += Math.round(t.totalInvested * SELL_REFUND_RATE);
    this.towers.delete(t.cellKey);
    this.selectedTower = null;
  }

  private inRect(v: Vec2, r: Rect): boolean {
    return v.x >= r.x && v.x <= r.x + r.w && v.y >= r.y && v.y <= r.y + r.h;
  }

  // ---- レイアウト（下部パネルのボタン矩形） -----------------------------

  private paletteRect(i: number): Rect {
    const margin = 12;
    const gap = 8;
    const n = TOWER_TYPE_LIST.length;
    const w = (VIRTUAL_W - margin * 2 - gap * (n - 1)) / n;
    return { x: margin + i * (w + gap), y: 1090, w, h: 86 };
  }

  private get startBtn(): Rect {
    return { x: VIRTUAL_W / 2 - 220, y: 1184, w: 440, h: 84 };
  }

  private get upgradeBtn(): Rect {
    return { x: 12, y: 1184, w: 342, h: 84 };
  }

  private get sellBtn(): Rect {
    return { x: 366, y: 1184, w: 342, h: 84 };
  }

  // ---- 描画 -------------------------------------------------------------

  render(ctx: CanvasRenderingContext2D): void {
    this.renderField(ctx);
    this.renderPath(ctx);
    this.renderSelectionRange(ctx);
    this.renderTowers(ctx);
    this.renderEnemies(ctx);
    this.renderProjectiles(ctx);
    this.renderTopBar(ctx);
    this.renderBottomPanel(ctx);
    if (this.state === 'gameover' || this.state === 'victory') {
      this.renderOverlay(ctx);
    }
  }

  private renderField(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.field;
    ctx.fillRect(0, GRID_TOP, VIRTUAL_W, ROWS * TILE);

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

  /** 選択中タワーの射程を強調表示。 */
  private renderSelectionRange(ctx: CanvasRenderingContext2D): void {
    const t = this.selectedTower;
    if (!t) return;
    ctx.fillStyle = 'rgba(255, 226, 122, 0.10)';
    ctx.beginPath();
    ctx.arc(t.pos.x, t.pos.y, t.range, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 226, 122, 0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  private renderTowers(ctx: CanvasRenderingContext2D): void {
    for (const t of this.towers.values()) {
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

      // 選択中は枠を強調
      if (t === this.selectedTower) {
        ctx.strokeStyle = COLORS.selected;
        ctx.lineWidth = 3;
        this.roundRect(
          ctx,
          t.pos.x - t.radius,
          t.pos.y - t.radius,
          t.radius * 2,
          t.radius * 2,
          10,
        );
        ctx.stroke();
      }

      // 砲塔
      ctx.fillStyle = t.type.color;
      ctx.beginPath();
      ctx.arc(t.pos.x, t.pos.y, t.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // 砲身（ターゲット方向）
      ctx.save();
      ctx.translate(t.pos.x, t.pos.y);
      ctx.rotate(t.angle);
      ctx.fillStyle = t.type.color;
      this.roundRect(ctx, 0, -7, t.radius + 10, 14, 6);
      ctx.fill();
      ctx.restore();

      // レベルピップ（下辺に level 個）
      for (let i = 0; i < t.level; i++) {
        const px = t.pos.x - (t.level - 1) * 6 + i * 12;
        ctx.fillStyle = COLORS.selected;
        ctx.beginPath();
        ctx.arc(px, t.pos.y + t.radius - 5, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private renderEnemies(ctx: CanvasRenderingContext2D): void {
    for (const e of this.enemies) {
      ctx.fillStyle = e.type.color;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = e.type.innerColor;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // 装甲持ちは外周リング
      if (e.armor > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y, e.radius - 1, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 減速中は青いオーラ
      if (e.slowed) {
        ctx.strokeStyle = 'rgba(123, 182, 255, 0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y, e.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // HP バー
      const w = e.radius * 2;
      const h = 6;
      const x = e.pos.x - e.radius;
      const y = e.pos.y - e.radius - 12;
      const ratio = e.hp / e.maxHp;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      this.roundRect(ctx, x, y, w, h, 3);
      ctx.fill();
      ctx.fillStyle = ratio > 0.5 ? COLORS.hpFull : COLORS.hpLow;
      this.roundRect(ctx, x, y, w * ratio, h, 3);
      ctx.fill();
    }
  }

  private renderProjectiles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.projectiles) {
      ctx.fillStyle = p.effect.color;
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
    this.text(ctx, label, cx, 42, 22, COLORS.textDim);
    this.text(ctx, value, cx, 82, 44, color);
  }

  private renderBottomPanel(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(0, GRID_BOTTOM, VIRTUAL_W, VIRTUAL_H - GRID_BOTTOM);
    ctx.strokeStyle = COLORS.panelLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GRID_BOTTOM);
    ctx.lineTo(VIRTUAL_W, GRID_BOTTOM);
    ctx.stroke();

    if (this.selectedTower) {
      this.renderTowerActions(ctx, this.selectedTower);
    } else {
      this.renderPalette(ctx);
      if (this.state === 'ready') {
        this.button(ctx, this.startBtn, `WAVE ${this.wave + 1} スタート`, COLORS.accent);
      } else if (this.state === 'wave') {
        this.text(
          ctx,
          `WAVE ${this.wave} 進行中  ／  残り ${this.remainingEnemies}`,
          VIRTUAL_W / 2,
          1226,
          32,
          COLORS.text,
        );
      }
    }
  }

  private renderPalette(ctx: CanvasRenderingContext2D): void {
    TOWER_TYPE_LIST.forEach((type, i) => {
      const r = this.paletteRect(i);
      const selected = type.id === this.buildType;
      const affordable = this.money >= type.cost;

      ctx.fillStyle = selected ? COLORS.btnSel : COLORS.btn;
      this.roundRect(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.fill();
      ctx.strokeStyle = selected ? COLORS.selected : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = selected ? 3 : 1.5;
      this.roundRect(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.stroke();

      const cx = r.x + r.w / 2;
      // アイコン（小さな砲塔）
      ctx.globalAlpha = affordable ? 1 : 0.4;
      ctx.fillStyle = COLORS.towerBase;
      this.roundRect(ctx, cx - 15, r.y + 9, 30, 30, 7);
      ctx.fill();
      ctx.fillStyle = type.color;
      ctx.beginPath();
      ctx.arc(cx, r.y + 24, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      this.text(ctx, type.name, cx, r.y + 53, 19, affordable ? COLORS.text : COLORS.textDim);
      this.text(
        ctx,
        `${type.cost}G`,
        cx,
        r.y + 73,
        18,
        affordable ? COLORS.money : COLORS.danger,
      );
    });
  }

  private renderTowerActions(ctx: CanvasRenderingContext2D, t: Tower): void {
    // 情報行
    this.text(ctx, `${t.type.name}  Lv.${t.level}`, 24, 1110, 26, t.type.color, 'left');

    let tag = '';
    if (t.type.splashRadius) tag = '  範囲';
    else if (t.type.slowFactor) tag = '  減速';
    this.text(
      ctx,
      `攻撃 ${t.damage}   射程 ${t.range}   連射 ${t.fireRate.toFixed(1)}/s${tag}`,
      24,
      1148,
      22,
      COLORS.textDim,
      'left',
    );

    // 強化ボタン
    const cost = upgradeCost(t.type, t.level);
    if (cost === null) {
      this.button(ctx, this.upgradeBtn, '強化 MAX', COLORS.accent, false);
    } else {
      const ok = this.money >= cost;
      this.button(
        ctx,
        this.upgradeBtn,
        `強化 Lv.${t.level + 1}  ${cost}G`,
        COLORS.accent,
        ok,
      );
    }

    // 売却ボタン
    const refund = Math.round(t.totalInvested * SELL_REFUND_RATE);
    this.button(ctx, this.sellBtn, `売却  +${refund}G`, COLORS.sell);
  }

  private button(
    ctx: CanvasRenderingContext2D,
    r: Rect,
    label: string,
    color: string,
    enabled = true,
  ): void {
    ctx.fillStyle = enabled ? color : COLORS.btn;
    this.roundRect(ctx, r.x, r.y, r.w, r.h, 16);
    ctx.fill();
    this.text(
      ctx,
      label,
      r.x + r.w / 2,
      r.y + r.h / 2,
      30,
      enabled ? '#06140e' : COLORS.textDim,
    );
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
    align: CanvasTextAlign = 'center',
  ): void {
    ctx.fillStyle = color;
    ctx.font = `bold ${size}px system-ui, "Hiragino Sans", "Noto Sans JP", sans-serif`;
    ctx.textAlign = align;
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
