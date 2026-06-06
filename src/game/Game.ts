import {
  AUTO_START_DELAY,
  COLORS,
  COLS,
  GRID_BOTTOM,
  GRID_TOP,
  ROWS,
  TILE,
  VIRTUAL_H,
  VIRTUAL_W,
} from './constants';
import { Enemy } from './Enemy';
import { ENEMY_TYPES, ENEMY_TYPE_LIST } from './enemyTypes';
import { buildPath, cellCenter, type GamePath } from './Path';
import { Projectile } from './Projectile';
import { Tower } from './Tower';
import {
  TOWER_TYPES,
  TOWER_TYPE_LIST,
  upgradeCost,
  type TowerTypeId,
} from './towerTypes';
import type { EnemyType } from './enemyTypes';
import { enemyBaseStats } from './waves';
import { STAGES } from './stages';
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

  stageIndex = 0;
  private path: GamePath = buildPath(STAGES[0].waypointsGrid);

  lives = STAGES[0].startLives;
  money = STAGES[0].startMoney;
  wave = 0;
  state: GameState = 'ready';

  // 建設対象のタワー種別 / 選択中の既設タワー / 移動待ちのタワー
  private buildType: TowerTypeId = 'gun';
  private selectedTower: Tower | null = null;
  private relocatingTower: Tower | null = null;

  // 敵スポーン（早出しに対応するため複数のスポナーを同時進行）
  private spawners: Spawner[] = [];
  private readyCountdown = 0; // ウェーブ終了後の自動スタートまでの残り秒
  private showInfo = false; // ステータス一覧（表示中は一時停止）
  private flashTimer = 0; // 全体攻撃スキルの画面フラッシュ
  private flashColor = '#ffffff';

  private get stageWaveCount(): number {
    return STAGES[this.stageIndex].waves.length;
  }

  /** 指定ステージを読み込んで盤面を初期化する。 */
  private loadStage(index: number): void {
    this.stageIndex = Math.max(0, Math.min(index, STAGES.length - 1));
    const st = STAGES[this.stageIndex];
    this.path = buildPath(st.waypointsGrid);
    this.enemies = [];
    this.towers.clear();
    this.projectiles = [];
    this.spawners = [];
    this.lives = st.startLives;
    this.money = st.startMoney;
    this.wave = 0;
    this.state = 'ready';
    this.readyCountdown = 0;
    this.buildType = 'gun';
    this.selectedTower = null;
    this.relocatingTower = null;
    this.flashTimer = 0;
    this.showInfo = false;
  }

  // ---- 更新 -------------------------------------------------------------

  update(dt: number): void {
    if (this.showInfo) return; // 一覧表示中は一時停止
    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this.state === 'gameover' || this.state === 'victory' || this.state === 'stageclear') return;

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
        this.enemies.push(
          new Enemy(item.type, item.hp, item.speed, item.reward, this.path.waypoints),
        );
        s.index++;
        s.timer = item.interval;
      }
    }
    this.spawners = this.spawners.filter((s) => s.index < s.items.length);
  }

  /** 補助塔の射程内の味方タワーへ連射・攻撃力バフを設定する。 */
  private computeSupportBuffs(): void {
    const supports: Tower[] = [];
    for (const t of this.towers.values()) if (t.isSupport) supports.push(t);

    for (const t of this.towers.values()) {
      if (t.isSupport) continue;
      let fireMul = 1;
      let dmgMul = 1;
      for (const s of supports) {
        if (Math.hypot(t.pos.x - s.pos.x, t.pos.y - s.pos.y) <= s.range) {
          fireMul *= s.supportFireRateMul;
          if (s.auraDamageBuffTimer > 0) dmgMul *= 1.2;
        }
      }
      t.buffMultiplier = fireMul;
      t.damageBuffMultiplier = dmgMul;
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
      if (this.wave >= this.stageWaveCount) {
        // ステージ完了
        this.state = this.stageIndex >= STAGES.length - 1 ? 'victory' : 'stageclear';
      } else {
        this.state = 'ready';
        this.readyCountdown = AUTO_START_DELAY;
      }
    }
  }

  /** 次のウェーブを出撃させる（手動・自動・早出し兼用）。 */
  private launchNextWave(): void {
    if (this.wave >= this.stageWaveCount) return;
    this.wave++;
    const def = STAGES[this.stageIndex].waves[this.wave - 1];
    const base = enemyBaseStats(this.wave, this.stageIndex);
    const items: SpawnItem[] = [];
    for (const g of def.groups) {
      const et = ENEMY_TYPES[g.type];
      for (let i = 0; i < g.count; i++) {
        items.push({
          type: et,
          hp: Math.round(base.hp * et.hpMul),
          speed: base.speed * et.speedMul,
          reward: et.reward + Math.floor(this.wave / 3) + this.stageIndex * 2,
          interval: g.interval,
        });
      }
    }
    this.spawners.push({ items, index: 0, timer: 0 });
    this.readyCountdown = 0;
    this.state = 'wave';
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
      this.showInfo = false;
      return;
    }
    if (this.state === 'gameover') {
      this.loadStage(this.stageIndex); // 同じステージを再挑戦
      return;
    }
    if (this.state === 'stageclear') {
      this.loadStage(this.stageIndex + 1); // 次のステージへ
      return;
    }
    if (this.state === 'victory') {
      this.loadStage(0); // 最初から
      return;
    }

    // Tsukahara 移動モード
    if (this.relocatingTower) {
      if (v.x >= 0 && v.x < COLS * TILE && v.y >= GRID_TOP && v.y < GRID_BOTTOM) {
        this.relocateTower(Math.floor(v.x / TILE), Math.floor((v.y - GRID_TOP) / TILE));
      } else {
        this.relocatingTower = null;
      }
      return;
    }

    // 選択中タワーの操作（強化・スキル）
    if (this.selectedTower) {
      if (this.inRect(v, this.upgradeBtn)) {
        this.tryUpgradeSelected();
        return;
      }
      if (this.inRect(v, this.skillBtn)) {
        this.activateSkill(this.selectedTower);
        return;
      }
    }

    // 下部パネル
    if (v.y >= GRID_BOTTOM) {
      if (this.selectedTower) return;
      for (let i = 0; i < TOWER_TYPE_LIST.length; i++) {
        if (this.inRect(v, this.paletteRect(i))) {
          const type = TOWER_TYPE_LIST[i];
          const existing = this.findTowerOfType(type.id);
          if (existing) this.selectedTower = existing;
          else this.buildType = type.id;
          return;
        }
      }
      if (this.inRect(v, this.infoBtn)) {
        this.showInfo = true;
        return;
      }
      if (this.inRect(v, this.mainActionBtn)) {
        this.launchNextWave();
        return;
      }
      return;
    }

    // グリッド内
    if (v.x >= 0 && v.x < COLS * TILE && v.y >= GRID_TOP && v.y < GRID_BOTTOM) {
      const col = Math.floor(v.x / TILE);
      const row = Math.floor((v.y - GRID_TOP) / TILE);
      const existing = this.towers.get(`${col},${row}`);
      if (existing) {
        this.selectedTower = existing;
        return;
      }
      if (this.selectedTower) {
        this.selectedTower = null;
        return;
      }
      this.tryPlaceTower(col, row);
      return;
    }

    this.selectedTower = null;
  }

  private tryPlaceTower(col: number, row: number): void {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    const key = `${col},${row}`;
    if (this.path.isPathCell(col, row)) return;
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
    if (cost === null) return;
    if (this.money < cost) return;
    this.money -= cost;
    t.applyUpgrade(cost);
  }

  /** 選択中タワーのスキルを発動（1 ステージ 1 回）。 */
  private activateSkill(t: Tower): void {
    if (t.skillUsed) return;
    switch (t.type.id) {
      case 'gun': // Matenrou: 画面全体攻撃 → 3 秒攻撃不能
        this.screenAttack(t.damage * 4, '#ff8a3c');
        t.disableAttack(3);
        t.skillUsed = true;
        break;
      case 'frost': // Eita: 画面全体攻撃＋減速 → 10 秒攻撃不能
        this.screenAttack(t.damage * 3, '#7bb6ff');
        for (const e of this.enemies) e.applySlow(0.45, 4);
        t.disableAttack(10);
        t.skillUsed = true;
        break;
      case 'support': // ayase: 10 秒間 範囲内の攻撃力 1.2 倍
        t.auraDamageBuffTimer = 10;
        t.skillUsed = true;
        break;
      case 'cannon': // Sae: 3 秒 連射×3 → その後 10 秒攻撃不能
        t.startFireBurst(3, 3, 10);
        t.skillUsed = true;
        break;
      case 'sniper': // Tsukahara: 別マスへ移動（移動完了で消費）
        this.relocatingTower = t;
        break;
    }
  }

  private screenAttack(amount: number, color: string): void {
    for (const e of this.enemies) e.damage(amount);
    this.flashTimer = 0.3;
    this.flashColor = color;
  }

  /** Tsukahara を指定マスへ移動。無効マスならキャンセル。 */
  private relocateTower(col: number, row: number): void {
    const t = this.relocatingTower;
    if (!t) return;
    const key = `${col},${row}`;
    const valid =
      col >= 0 &&
      col < COLS &&
      row >= 0 &&
      row < ROWS &&
      !this.path.isPathCell(col, row) &&
      !this.towers.has(key);
    if (valid) {
      this.towers.delete(t.cellKey);
      t.moveTo(cellCenter(col, row), key);
      this.towers.set(key, t);
      t.skillUsed = true;
      this.selectedTower = t;
    }
    this.relocatingTower = null;
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
  private get skillBtn(): Rect {
    return { x: 366, y: 1182, w: 342, h: 86 };
  }

  // ---- 描画 -------------------------------------------------------------

  render(ctx: CanvasRenderingContext2D): void {
    this.renderField(ctx);
    this.renderPath(ctx);
    if (this.relocatingTower) this.renderRelocationHighlight(ctx);
    this.renderSupportAuras(ctx);
    this.renderSelectionRange(ctx);
    this.renderTowers(ctx);
    this.renderEnemies(ctx);
    this.renderProjectiles(ctx);
    this.renderFlash(ctx);
    this.renderTopBar(ctx);
    this.renderBottomPanel(ctx);
    if (this.relocatingTower) this.renderRelocationHint(ctx);
    if (this.state === 'gameover' || this.state === 'stageclear' || this.state === 'victory') {
      this.renderOverlay(ctx);
    }
    if (this.showInfo) this.renderInfoOverlay(ctx);
  }

  private renderFlash(ctx: CanvasRenderingContext2D): void {
    if (this.flashTimer <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(0.5, (this.flashTimer / 0.3) * 0.5);
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, GRID_TOP, VIRTUAL_W, GRID_BOTTOM - GRID_TOP);
    ctx.restore();
  }

  private renderRelocationHighlight(ctx: CanvasRenderingContext2D): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.path.isPathCell(c, r) || this.towers.has(`${c},${r}`)) continue;
        const x = c * TILE;
        const y = GRID_TOP + r * TILE;
        ctx.fillStyle = 'rgba(123,182,255,0.18)';
        this.roundRect(ctx, x + 3, y + 3, TILE - 6, TILE - 6, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(123,182,255,0.5)';
        ctx.lineWidth = 2;
        this.roundRect(ctx, x + 3, y + 3, TILE - 6, TILE - 6, 8);
        ctx.stroke();
      }
    }
  }

  private renderRelocationHint(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(11,16,32,0.88)';
    this.roundRect(ctx, 50, GRID_TOP + 16, VIRTUAL_W - 100, 56, 12);
    ctx.fill();
    ctx.strokeStyle = COLORS.wave;
    ctx.lineWidth = 2;
    this.roundRect(ctx, 50, GRID_TOP + 16, VIRTUAL_W - 100, 56, 12);
    ctx.stroke();
    this.text(ctx, '移動先の空きマスをタップ（外でキャンセル）', VIRTUAL_W / 2, GRID_TOP + 44, 22, COLORS.text);
  }

  private renderField(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.field;
    ctx.fillRect(0, GRID_TOP, VIRTUAL_W, ROWS * TILE);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.path.isPathCell(c, r)) continue;
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
    const wp = this.path.waypoints;
    ctx.beginPath();
    ctx.moveTo(wp[0].x, wp[0].y);
    for (let i = 1; i < wp.length; i++) ctx.lineTo(wp[i].x, wp[i].y);
    ctx.stroke();
  }

  private renderSupportAuras(ctx: CanvasRenderingContext2D): void {
    for (const t of this.towers.values()) {
      if (!t.isSupport) continue;
      const active = t.auraDamageBuffTimer > 0;
      ctx.fillStyle = active ? 'rgba(196,167,255,0.14)' : 'rgba(255,123,213,0.07)';
      ctx.beginPath();
      ctx.arc(t.pos.x, t.pos.y, t.range, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = active ? 'rgba(196,167,255,0.60)' : 'rgba(255,123,213,0.30)';
      ctx.lineWidth = active ? 3 : 2;
      ctx.stroke();
    }
  }

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
      ctx.fillStyle = COLORS.towerBase;
      this.roundRect(ctx, t.pos.x - t.radius, t.pos.y - t.radius, t.radius * 2, t.radius * 2, 10);
      ctx.fill();

      if (t === this.selectedTower) {
        ctx.strokeStyle = COLORS.selected;
        ctx.lineWidth = 3;
        this.roundRect(ctx, t.pos.x - t.radius, t.pos.y - t.radius, t.radius * 2, t.radius * 2, 10);
        ctx.stroke();
      }

      if (t.isSupport) {
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
        ctx.fillStyle = t.type.color;
        ctx.beginPath();
        ctx.arc(t.pos.x, t.pos.y, t.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(t.pos.x, t.pos.y);
        ctx.rotate(t.angle);
        ctx.fillStyle = t.type.color;
        this.roundRect(ctx, 0, -7, t.radius + 10, 14, 6);
        ctx.fill();
        ctx.restore();
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

      for (let i = 0; i < t.level; i++) {
        const px = t.pos.x - (t.level - 1) * 6 + i * 12;
        ctx.fillStyle = COLORS.selected;
        ctx.beginPath();
        ctx.arc(px, t.pos.y + t.radius - 5, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      if (t.isMelee && t.slashTimer > 0) {
        ctx.strokeStyle = 'rgba(255, 245, 220, 0.85)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(t.pos.x, t.pos.y, t.range * 0.92, t.angle - 0.9, t.angle + 0.9);
        ctx.stroke();
      }

      if (t.attackDisabled) {
        ctx.fillStyle = 'rgba(5, 7, 15, 0.55)';
        ctx.beginPath();
        ctx.arc(t.pos.x, t.pos.y, t.radius + 2, 0, Math.PI * 2);
        ctx.fill();
        this.text(ctx, `${Math.ceil(t.attackDisabledTimer)}`, t.pos.x, t.pos.y, 26, COLORS.danger);
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

      if (e.armor > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y, e.radius - 1, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (e.slowed) {
        ctx.strokeStyle = 'rgba(123, 182, 255, 0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y, e.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      const w = e.radius * 2;
      const x = e.pos.x - e.radius;
      const y = e.pos.y - e.radius - 12;
      const ratio = e.hp / e.maxHp;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      this.roundRect(ctx, x, y, w, 6, 3);
      ctx.fill();
      ctx.fillStyle = ratio > 0.5 ? COLORS.hpFull : COLORS.hpLow;
      this.roundRect(ctx, x, y, w * ratio, 6, 3);
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

    this.text(
      ctx,
      `STAGE ${this.stageIndex + 1}/${STAGES.length}   ${STAGES[this.stageIndex].name}`,
      VIRTUAL_W / 2,
      18,
      20,
      COLORS.wave,
    );
    this.stat(ctx, 120, 'ライフ', String(this.lives), COLORS.life);
    this.stat(ctx, 360, 'ゴールド', String(this.money), COLORS.money);
    this.stat(ctx, 600, 'ウェーブ', `${this.wave}/${this.stageWaveCount}`, COLORS.wave);
  }

  private stat(
    ctx: CanvasRenderingContext2D,
    cx: number,
    label: string,
    value: string,
    color: string,
  ): void {
    this.text(ctx, label, cx, 50, 21, COLORS.textDim);
    this.text(ctx, value, cx, 88, 42, color);
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
      ctx.strokeStyle = placed ? COLORS.accent : isBuild ? COLORS.selected : 'rgba(255,255,255,0.08)';
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

      this.text(ctx, type.name, cx, r.y + 50, 16, placed || !affordable ? COLORS.textDim : COLORS.text);
      if (placed) this.text(ctx, '設置済', cx, r.y + 69, 16, COLORS.accent);
      else this.text(ctx, `${type.cost}G`, cx, r.y + 69, 16, affordable ? COLORS.money : COLORS.danger);
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
    } else if (this.wave < this.stageWaveCount) {
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
    this.text(ctx, `${t.type.name}  Lv.${t.level}${sub}`, 24, 1104, 26, t.type.color, 'left');

    let stats: string;
    if (t.isSupport) {
      const pct = Math.round((t.supportFireRateMul - 1) * 100);
      stats = `周囲の連射 +${pct}%   射程 ${t.range}`;
    } else {
      const tag = t.isMelee ? '  斬撃(範囲)' : t.splashRadius ? '  範囲' : t.slowFactor ? '  減速' : '';
      const fb = t.buffMultiplier > 1 ? `  補助連+${Math.round((t.buffMultiplier - 1) * 100)}%` : '';
      const db = t.damageBuffMultiplier > 1 ? '  攻+20%' : '';
      stats = `攻撃 ${t.damage}  射程 ${t.range}  連射 ${t.fireRate.toFixed(1)}/s${tag}${fb}${db}`;
    }
    this.text(ctx, stats, 24, 1138, 21, COLORS.textDim, 'left');

    const status = this.skillStatusText(t);
    if (status) this.text(ctx, status, 24, 1164, 20, COLORS.skill, 'left');

    const cost = upgradeCost(t.type, t.level);
    if (cost === null) this.button(ctx, this.upgradeBtn, '強化 MAX', COLORS.accent, false);
    else this.button(ctx, this.upgradeBtn, `強化 Lv.${t.level + 1}  ${cost}G`, COLORS.accent, this.money >= cost);

    if (this.relocatingTower === t) {
      this.button(ctx, this.skillBtn, '移動先を選択', COLORS.wave);
    } else if (t.skillUsed) {
      this.button(ctx, this.skillBtn, 'スキル 使用済', COLORS.skill, false);
    } else {
      this.button(ctx, this.skillBtn, `スキル: ${t.type.skill.name}`, COLORS.skill);
    }
  }

  private skillStatusText(t: Tower): string {
    if (t.attackDisabled) return `攻撃不能 ${Math.ceil(t.attackDisabledTimer)}s`;
    if (t.fireBurstTimer > 0) return `高速斬撃 ${Math.ceil(t.fireBurstTimer)}s`;
    if (t.isSupport && t.auraDamageBuffTimer > 0) return `攻撃力UP ${Math.ceil(t.auraDamageBuffTimer)}s`;
    return '';
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
    ctx.fillStyle = 'rgba(5, 7, 15, 0.82)';
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    let title: string;
    let color: string;
    let subtitle: string;
    let hint: string;

    if (this.state === 'victory') {
      title = '全ステージ制覇！';
      color = COLORS.accent;
      subtitle = `${STAGES.length} ステージ クリア！`;
      hint = 'タップで最初から';
    } else if (this.state === 'stageclear') {
      const next = STAGES[this.stageIndex + 1];
      title = `STAGE ${this.stageIndex + 1} クリア！`;
      color = COLORS.accent;
      subtitle = `次は STAGE ${this.stageIndex + 2}「${next.name}」`;
      hint = 'タップで次のステージへ';
    } else {
      title = 'ゲームオーバー';
      color = COLORS.danger;
      subtitle = `STAGE ${this.stageIndex + 1} / WAVE ${this.wave} まで到達`;
      hint = 'タップでこのステージを再挑戦';
    }

    this.text(ctx, title, VIRTUAL_W / 2, 540, 76, color);
    this.text(ctx, subtitle, VIRTUAL_W / 2, 632, 32, COLORS.textDim);
    this.text(ctx, hint, VIRTUAL_W / 2, 720, 34, COLORS.text);
  }

  /** タワー・敵のステータス一覧（図鑑）。 */
  private renderInfoOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(5, 7, 15, 0.96)';
    ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

    this.text(ctx, 'ステータス一覧', VIRTUAL_W / 2, 60, 42, COLORS.accent);
    this.text(ctx, 'タップで閉じる', VIRTUAL_W / 2, 100, 20, COLORS.textDim);

    this.text(ctx, 'タワー（Lv1基本 / 進化 / スキルは1ステージ1回）', 30, 134, 20, COLORS.text, 'left');
    TOWER_TYPE_LIST.forEach((type, i) => {
      const y = 160 + i * 98;
      this.infoRowBg(ctx, y, 90);
      const lv1 = type.levels[0];
      ctx.fillStyle = type.color;
      ctx.beginPath();
      ctx.arc(52, y + 22, 12, 0, Math.PI * 2);
      ctx.fill();
      this.text(ctx, type.name, 78, y + 22, 23, type.color, 'left');
      this.text(ctx, `建設 ${type.cost}G`, VIRTUAL_W - 28, y + 22, 19, COLORS.money, 'right');

      let stats: string;
      if (type.isSupport) {
        const pct = Math.round(((lv1.supportFireRateMul ?? 1) - 1) * 100);
        stats = `補助: 周囲の連射 +${pct}%・射程 ${lv1.range}・攻撃なし`;
      } else {
        const tag = type.melee
          ? '・斬撃(範囲)'
          : lv1.splashRadius
            ? '・範囲'
            : lv1.slowFactor
              ? `・減速 ${Math.round((1 - lv1.slowFactor) * 100)}%`
              : '';
        stats = `攻撃 ${lv1.damage}・射程 ${lv1.range}・連射 ${lv1.fireRate.toFixed(1)}/s${tag}`;
      }
      this.text(ctx, stats, 78, y + 44, 17, COLORS.text, 'left');
      this.text(ctx, type.desc, 78, y + 63, 15, COLORS.textDim, 'left');
      this.text(ctx, `スキル: ${type.skill.desc}`, 78, y + 82, 16, COLORS.skill, 'left');
    });

    const enemyTop = 160 + TOWER_TYPE_LIST.length * 98 + 14;
    this.text(ctx, '敵（種別倍率）', 30, enemyTop, 20, COLORS.text, 'left');
    ENEMY_TYPE_LIST.forEach((et, i) => {
      const y = enemyTop + 26 + i * 68;
      this.infoRowBg(ctx, y, 60);
      ctx.fillStyle = et.color;
      ctx.beginPath();
      ctx.arc(52, y + 20, 12, 0, Math.PI * 2);
      ctx.fill();
      this.text(ctx, et.name, 78, y + 19, 23, et.color, 'left');
      this.text(ctx, `報酬 ${et.reward}G`, VIRTUAL_W - 28, y + 19, 19, COLORS.money, 'right');
      this.text(ctx, `HP ×${et.hpMul}・速度 ×${et.speedMul}・装甲 ${et.armor}`, 78, y + 43, 17, COLORS.textDim, 'left');
    });

    this.text(
      ctx,
      '※基準HP=20+9×WAVE（ステージで増加）/ 速度=60+3×WAVE',
      VIRTUAL_W / 2,
      enemyTop + 26 + ENEMY_TYPE_LIST.length * 68 + 18,
      16,
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
