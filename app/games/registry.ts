import { initAsteroids } from "@/app/games/asteroids/engine";
import type { AsteroidsCallbacks, AsteroidsEngine } from "@/app/games/asteroids/engine";
import { initTetris } from "@/app/games/tetris/engine";
import { initArkanoid } from "@/app/games/arkanoid/engine";
import { initSnake } from "@/app/games/snake/engine";

export type EngineInit = (canvas: HTMLCanvasElement, cb: AsteroidsCallbacks) => AsteroidsEngine;

// game.id -> factory del motor. Juego sin entrada aquí usa el placeholder falso en GamePlayer.
export const engineRegistry: Partial<Record<string, EngineInit>> = {
  asteroides: initAsteroids,
  tetris: initTetris,
  arkanoid: initArkanoid,
  snake: initSnake,
};
