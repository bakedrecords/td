import {
  AUTO_START_DELAY,
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
import { ENEMY_TYPES, ENEMY_TYPE_LIST } from './enemyTypes';
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

/** 1 ウェーブぶんの敵を順番に湧かせるスポナー（早出しで複数同時に走る）。 */
interface Spawner {
  items: SpawnItem[];
  index: number;
  timer: number;
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

  // 敵スポーン（早出しに対応するため複数のスポナーを同時進行）
  private spawners: Spawner[] = [];
  // ウェーブ終了後の自動スタートまでの残り秒（0 なら手動待ち）
  private readyCountdown = 0;
  // ステータス一覧の表示中フラグ（表示中はゲームを一時停止）
  private showInfo = false;

  // ---- 更新 -------------------------------------------------------------

  update(dt: number): void {
    if (this.showInfo) return; // 一覧表示中は一時停止
    if (this.state === 'gameover' || this.state === 'victory') return;

    if (this.state === 'ready' && this.readyCountdown > 0) {
      this.readyCountdown -= dt;
      if (this.readyCountdown <= 0) {
        this.readyCountdown = 0;
        this.launchNextWave();
      }
    }

    this.updateSpawning(dt);
    this.computeSupportBuffs();

    for (const t of this.towers.values()) {
      t.update(dt, this.enemies, this.projectiles);
    }

    for (const p of this.projectiles) p.update(dt, this.enemies);
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    this.updateEnemies(dt);
    this.checkWaveComplete();
  }

  private updateSpawning(dt: number): void {
    for (const s of this.spawners) {
      if (s.index >= s.items.length) continue;
      s.timer -= dt;
      if (s.timer <= 0) {
        const item = s.items[s.index];
        this.enemies.push(new Enemy(item.type, item.hp, item.speed, item.reward));
        s.index++;
        s.timer = item.interval;
      }
    }
    // 使い切ったスポナーを除去
    this.spawners = this.spawners.filter((s) => s.index < s.items.length);
  }

  /** 補助塔の射程内にいる味方タワーへ連射バフを設定する。 */
  private computeSupportBuffs(): void {
    const supports: Tower[] = [];
    for (const t of this.towers.values()) if (t.isSupport) supports.push(t);

    for (const t of this.towers.values()) {
      if (t.isSupport) continue;
      let mul = 1;
      for (const s of supports) {
        if (Math.hypot(t.pos.x - s.pos.x, t.pos.y - s.pos.y) <= s.range) {
          mul *= s.supportFireRateMul;
        }
      }
      t.buffMultiplier = mul;
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
    if (this.spawners.length === 0 && this.enemies.length === 0) {
      if (this.wave >= TOTAL_WAVES) {
        this.state = 'victory';
      } else {
        this.state = 'ready';
        this.readyCountdown = AUTO_START_DELAY; // 5 秒後に自動で次へ
      }
    }
  }

  /** 次のウェーブを出撃させる（手動スタート・自動スタート・早出し兼用）。 */
  private launchNextWave(): void {
    if (this.wave >= TOTAL_WAVES) return; // これ以上呼べる波がない
    this.wave++;
    const def = WAVES[this.wave - 1];
    const base = enemyBaseStats(this.wave);
    const items: SpawnItem[] = [];
    for (const g of def.groups) {
      const et = ENEMY_TYPES[g.type];
      for (let i = 0; i < g.count; i++) {
        items.push({
          type: et,
          hp: Math.round(base.hp * et.hpMul),
          speed: base.speed * et.speedMul,
          reward: et.reward + Math.floor(this.wave / 3),
          interval: g.interval,
        });
      }
    }
    this.spawners.push({ items, index: 0, timer: 0 });
    this.readyCountdown = 0;
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
    this.spawners = [];
    this.readyCountdown = 0;
    this.showInfo = false;
  }

  private get remainingEnemies(): number {
    let queued = 0;
    for (const s of this.spawners) queued += s.items.length - s.index;
    return queued + this.enemies.length;
  }

  private hasType(id: TowerTypeId): boolean {
    for (const t of this.towers.values()) if (t.type.id === id) return true;
    return false;
  }

  private findTowerOfType(id: TowerTypeId): Tower | null {
    for (const t of this.towers.values()) if (t.type.id === id) return t;
    return null;
  }

  // ---- 入力 -------------------------------------------------------------

  handlePointer(v: Vec2): void {
    if (this.showInfo) {
      this.showInfo = false; // 一覧はどこをタップしても閉じる
      return;
    }
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
      if (this.selectedTower) return; // 強化/売却パネル表示中は他を無効化

      for (let i = 0; i < TOWER_TYPE_LIST.length; i++) {
        if (this.inRect(v, this.paletteRect(i))) {
          const type = TOWER_TYPE_LIST[i];
          const existing = this.findTowerOfType(type.id);
          if (existing) {
            this.selectedTower = existing; // 設置済みなら、その塔を選択
          } else {
            this.buildType = type.id; // 未設置なら建設対象に
          }
          return;
        }
      }
      if (this.inRect(v, this.infoBtn)) {
        this.showInfo = true;
        return;
      }
      if (this.inRect(v, this.mainActionBtn)) {
        this.launchNextWave(); // ready=開始 / wave=早出し
        return;
      }
      return;
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
    if (this.hasType(this.buildType)) return; // 同じ種別は 1 基まで
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
    const margin = 10;
    const gap = 7;
    const n = TOWER_TYPE_LIST.length;
    const w = (VIRTUAL_W - margin * 2 - gap * (n - 1)) / n;
    return { x: margin + i * (w + gap), y: 1086, w, h: 84 };
  }

  private get mainActionBtn(): Rect {
    return { x: 10, y: 1182, w: 506, h: 86 };
  }

  private get infoBtn(): Rect {
    return { x: 524, y: 1182, w: 186, h: 86 };
  }

  private get upgradeBtn(): Rect {
    return { x: 12, y: 1182, w: 342, h: 86 };
  }

  private get sellBtn(): Rect {
    return { x: 366, y: 1182, w: 342, h: 86 };
  }

  // ---- 描画 -------------------------------------------------------------

  render(ctx: CanvasRenderingContext2D): void {
    this.renderField(ctx);
    this.renderPath(ctx);
    this.renderSupportAuras(ctx);
    this.renderSelectionRange(ctx);
    this.renderTowers(ctx);
    this.renderEnemies(ctx);
    this.renderProjectiles(ctx);
    this.renderTopBar(ctx);
    this.renderBottomPanel(ctx);
    if (this.state === 'gameover' || this.state === 'victory') {
      this.renderOverlay(ctx);
    }
    if (this.showInfo) this.renderInfoOverlay(ctx);
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

  /** 補助塔のバフ範囲（薄いオーラ）。 */
  private renderSupportAuras(ctx: CanvasRenderingContext2D): void {
    for (const t of this.towers.values()) {
      if (!t.isSupport) continue;
      ctx.fillStyle = 'rgba(255, 123, 213, 0.07)';
      ctx.beginPath();
      ctx.arc(t.pos.x, t.pos.y, t.range, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 123, 213, 0.30)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
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
      this.roundRect(ctx, t.pos.x - t.radius, t.pos.y - t.radius, t.radius * 2, t.radius * 2, 10);
      ctx.fill();

      // 選択中は枠を強調
      if (t === this.selectedTower) {
        ctx.strokeStyle = COLORS.selected;
        ctx.lineWidth = 3;
        this.roundRect(ctx, t.pos.x - t.radius, t.pos.y - t.radius, t.radius * 2, t.radius * 2, 10);
        ctx.stroke();
      }

      if (t.isSupport) {
        // 補助塔はリング状アイコン（砲身なし）
        ctx.strokeStyle = t.type.color;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(t.pos.x, t.pos.y, t.radius * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = t.type.color;
        ctx.beginPath();
        ctx.arc(t.pos.x, t.pos.y, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
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
        // 補助バフを受けている印（小さな三角）
        if (t.buffMultiplier > 1) {
          const bx = t.pos.x + t.radius - 5;
          const by = t.pos.y - t.radius + 9;
          ctx.fillStyle = TOWER_TYPES.support.color;
          ctx.beginPath();
          ctx.moveTo(bx, by - 7);
          ctx.lineTo(bx - 6, by + 4);
          ctx.lineTo(bx + 6, by + 4);
          ctx.closePath();
          ctx.fill();
        }
      }

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
      return;
    }

    this.renderPalette(ctx);
    this.renderMainAction(ctx);
    this.renderInfoButton(ctx);
  }

  private renderPalette(ctx: CanvasRenderingContext2D): void {
    TOWER_TYPE_LIST.forEach((type, i) => {
      const r = this.paletteRect(i);
      const placed = this.hasType(type.id);
      const isBuild = type.id === this.buildType && !placed;
      const affordable = this.money >= type.cost;

      ctx.fillStyle = isBuild ? COLORS.btnSel : COLORS.btn;
      this.roundRect(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.fill();
      ctx.strokeStyle = placed
        ? COLORS.accent
        : isBuild
          ? COLORS.selected
          : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = placed || isBuild ? 3 : 1.5;
      this.roundRect(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.stroke();

      const cx = r.x + r.w / 2;
      ctx.globalAlpha = placed ? 0.55 : affordable ? 1 : 0.4;
      ctx.fillStyle = COLORS.towerBase;
      this.roundRect(ctx, cx - 14, r.y + 7, 28, 28, 7);
      ctx.fill();
      ctx.fillStyle = type.color;
      ctx.beginPath();
      ctx.arc(cx, r.y + 21, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      this.text(ctx, type.name, cx, r.y + 50, 17, placed || !affordable ? COLORS.textDim : COLORS.text);
      if (placed) {
        this.text(ctx, '設置済', cx, r.y + 69, 16, COLORS.accent);
      } else {
        this.text(ctx, `${type.cost}G`, cx, r.y + 69, 16, affordable ? COLORS.money : COLORS.danger);
      }
    });
  }

  private renderMainAction(ctx: CanvasRenderingContext2D): void {
    const r = this.mainActionBtn;
    if (this.state === 'ready') {
      const label =
        this.readyCountdown > 0
          ? `WAVE ${this.wave + 1} 開始（自動 ${Math.ceil(this.readyCountdown)}s）`
          : `WAVE ${this.wave + 1} 開始 ▶`;
      this.button(ctx, r, label, COLORS.accent);
    } else if (this.wave < TOTAL_WAVES) {
      this.button(ctx, r, `WAVE ${this.wave + 1} を呼ぶ（残${this.remainingEnemies}）`, COLORS.wave);
    } else {
      this.button(ctx, r, `最終WAVE 進行中（残${this.remainingEnemies}）`, COLORS.btn, false);
    }
  }

  private renderInfoButton(ctx: CanvasRenderingContext2D): void {
    const r = this.infoBtn;
    ctx.fillStyle = COLORS.btnSel;
    this.roundRect(ctx, r.x, r.y, r.w, r.h, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, r.x, r.y, r.w, r.h, 16);
    ctx.stroke();
    this.text(ctx, 'ステータス', r.x + r.w / 2, r.y + r.h / 2, 22, COLORS.text);
  }

  private renderTowerActions(ctx: CanvasRenderingContext2D, t: Tower): void {
    const sub = t.levelName ? `  ${t.levelName}` : '';
    this.text(ctx, `${t.type.name}  Lv.${t.level}${sub}`, 24, 1108, 26, t.type.color, 'left');

    let stats: string;
    if (t.isSupport) {
      const pct = Math.round((t.supportFireRateMul - 1) * 100);
      stats = `周囲の連射 +${pct}%    射程 ${t.range}`;
    } else {
      const tag = t.splashRadius ? '  範囲' : t.slowFactor ? '  減速' : '';
      const buff = t.buffMultiplier > 1 ? `  （補助+${Math.round((t.buffMultiplier - 1) * 100)}%）` : '';
      stats = `攻撃 ${t.damage}  射程 ${t.range}  連射 ${t.fireRate.toFixed(1)}/s${tag}${buff}`;
    }
    this.text(ctx, stats, 24, 1146, 22, COLORS.textDim, 'left');

    const cost = upgradeCost(t.type, t.level);
    if (cost === null) {
      this.button(ctx, this.upgradeBtn, '強化 MAX', COLORS.accent, false);
    } else {
      this.button(ctx, this.upgradeBtn, `強化 Lv.${t.level + 1}  ${cost}G`, COLORS.accent, this.money >= cost);
    }

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
    this.text(ctx, label, r.x + r.w / 2, r.y + r.h / 2, 28, enabled ? '#06140e' : COLORS.textDim);
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

  /** タワー・敵のステータス一覧（図鑑）。 */
  private renderInfoOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(5, 7, 15, 0.96)';
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    this.text(ctx, 'ステータス一覧', VIRTUAL_W / 2, 60, 42, COLORS.accent);
    this.text(ctx, 'タップで閉じる', VIRTUAL_W / 2, 100, 20, COLORS.textDim);

    // --- タワー（Lv1 の基本性能＋進化の説明） ---
    this.text(ctx, 'タワー（Lv1 の基本性能）', 30, 126, 22, COLORS.text, 'left');
    TOWER_TYPE_LIST.forEach((type, i) => {
      const y = 154 + i * 88;
      this.infoRowBg(ctx, y, 80);
      const lv1 = type.levels[0];
      ctx.fillStyle = type.color;
      ctx.beginPath();
      ctx.arc(52, y + 24, 12, 0, Math.PI * 2);
      ctx.fill();
      this.text(ctx, type.name, 78, y + 22, 24, type.color, 'left');
      this.text(ctx, `建設 ${type.cost}G`, VIRTUAL_W - 28, y + 22, 20, COLORS.money, 'right');

      let stats: string;
      if (type.isSupport) {
        const pct = Math.round(((lv1.supportFireRateMul ?? 1) - 1) * 100);
        stats = `補助: 周囲の連射 +${pct}%・射程 ${lv1.range}・攻撃なし`;
      } else {
        const tag = lv1.splashRadius
          ? '・範囲'
          : lv1.slowFactor
            ? `・減速 ${Math.round((1 - lv1.slowFactor) * 100)}%`
            : '';
        stats = `攻撃 ${lv1.damage}・射程 ${lv1.range}・連射 ${lv1.fireRate.toFixed(1)}/s${tag}`;
      }
      this.text(ctx, stats, 78, y + 47, 18, COLORS.text, 'left');
      this.text(ctx, type.desc, 78, y + 69, 17, COLORS.textDim, 'left');
    });

    // --- 敵（種別倍率） ---
    const enemyTop = 154 + TOWER_TYPE_LIST.length * 88 + 8;
    this.text(ctx, '敵（種別倍率）', 30, enemyTop, 22, COLORS.text, 'left');
    ENEMY_TYPE_LIST.forEach((et, i) => {
      const y = enemyTop + 28 + i * 74;
      this.infoRowBg(ctx, y, 66);
      ctx.fillStyle = et.color;
      ctx.beginPath();
      ctx.arc(52, y + 22, 12, 0, Math.PI * 2);
      ctx.fill();
      this.text(ctx, et.name, 78, y + 20, 24, et.color, 'left');
      this.text(ctx, `報酬 ${et.reward}G`, VIRTUAL_W - 28, y + 20, 20, COLORS.money, 'right');
      this.text(
        ctx,
        `HP ×${et.hpMul}・速度 ×${et.speedMul}・装甲 ${et.armor}`,
        78,
        y + 46,
        18,
        COLORS.textDim,
        'left',
      );
    });

    this.text(
      ctx,
      '※敵の基準HP=20+9×WAVE / 速度=60+3×WAVE（種別倍率を乗算）',
      VIRTUAL_W / 2,
      enemyTop + 28 + ENEMY_TYPE_LIST.length * 74 + 22,
      17,
      COLORS.textDim,
    );
  }

  private infoRowBg(ctx: CanvasRenderingContext2D, y: number, h: number): void {
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    this.roundRect(ctx, 24, y, VIRTUAL_W - 48, h, 10);
    ctx.fill();
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
