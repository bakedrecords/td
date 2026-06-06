import './style.css';
import { Game } from './game/Game';
import { Viewport } from './game/Viewport';
import { COLORS } from './game/constants';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const maybeCtx = canvas.getContext('2d');
if (!maybeCtx) {
  throw new Error('2D canvas context を取得できませんでした');
}
const ctx: CanvasRenderingContext2D = maybeCtx;

const viewport = new Viewport(canvas);
const game = new Game();

// デバッグ用フック: URL に ?debug を付けたときだけゲームインスタンスを公開する。
// （本番の通常アクセスでは無効。動作確認や開発時の状態参照に使う）
if (new URLSearchParams(location.search).has('debug')) {
  (window as unknown as { __game: Game }).__game = game;
}

window.addEventListener('resize', () => viewport.resize());
window.addEventListener('orientationchange', () => viewport.resize());

// pointerdown はマウス・タッチ・ペンを統一的に扱える（スマホ対応の要）
canvas.addEventListener(
  'pointerdown',
  (e) => {
    e.preventDefault();
    game.handlePointer(viewport.toVirtual(e.clientX, e.clientY));
  },
  { passive: false },
);

let last = performance.now();
function frame(now: number): void {
  // タブ非アクティブ復帰時などに dt が巨大化しないよう上限を設ける
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  game.update(dt);

  // 画面全体（レターボックスの帯を含む）を背景色で塗る
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 以降は仮想座標系で描画
  viewport.apply(ctx);
  game.render(ctx);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
