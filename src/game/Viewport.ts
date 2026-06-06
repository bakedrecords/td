import { VIRTUAL_W, VIRTUAL_H } from './constants';
import type { Vec2 } from './types';

/**
 * 仮想解像度 (VIRTUAL_W x VIRTUAL_H) を実際のキャンバスへ
 * アスペクト比を保ったままレターボックス表示するための変換を管理する。
 * 入力座標（指やマウス）→ 仮想座標への変換もここで行う。
 */
export class Viewport {
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  dpr = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.resize();
  }

  resize(): void {
    // 高解像度ディスプレイでもくっきり描くため devicePixelRatio を反映（上限 2 で負荷抑制）。
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;

    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);

    this.scale = Math.min(
      this.canvas.width / VIRTUAL_W,
      this.canvas.height / VIRTUAL_H,
    );
    this.offsetX = (this.canvas.width - VIRTUAL_W * this.scale) / 2;
    this.offsetY = (this.canvas.height - VIRTUAL_H * this.scale) / 2;
  }

  /** 以降の描画を仮想座標系で行えるよう、コンテキストへ変換を適用する。 */
  apply(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
  }

  /** 画面上のクライアント座標を仮想座標へ変換する。 */
  toVirtual(clientX: number, clientY: number): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * this.dpr;
    const y = (clientY - rect.top) * this.dpr;
    return {
      x: (x - this.offsetX) / this.scale,
      y: (y - this.offsetY) / this.scale,
    };
  }
}
