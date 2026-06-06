export interface Vec2 {
  x: number;
  y: number;
}

export type GameState = 'ready' | 'wave' | 'stageclear' | 'gameover' | 'victory';
