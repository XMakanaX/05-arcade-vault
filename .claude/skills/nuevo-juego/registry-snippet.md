# Refactor: registro de motores

Rompe el acoplamiento `game.id === "asteroides"` hardcodeado en `GamePlayer.tsx`. Se hace **una sola vez** (cuando `app/games/registry.ts` no existe todavía); juegos siguientes solo agregan una entrada.

## 1. Crear `app/games/registry.ts`

```ts
import { initAsteroids } from "@/app/games/asteroids/engine";
import type { GameCallbacks, GameEngine } from "@/app/games/asteroids/engine"; // o mover estos tipos a un archivo compartido, ver nota abajo

export type EngineInit = (canvas: HTMLCanvasElement, cb: GameCallbacks) => GameEngine;

// game.id -> factory del motor. Juego sin entrada aquí usa el placeholder falso en GamePlayer.
export const engineRegistry: Record<string, EngineInit> = {
  asteroides: initAsteroids,
  // <slug>: init<Name>,   <- agregar una línea por juego nuevo
};
```

**Nota de tipos:** `AsteroidsCallbacks`/`AsteroidsEngine` en `app/games/asteroids/engine.ts` ya calzan estructuralmente con `GameCallbacks`/`GameEngine` del contrato estándar (mismos campos). No hace falta renombrarlos ahí — el registro solo necesita que la forma coincida. Si se prefiere un nombre común, mover las interfaces a `app/games/types.ts` y re-exportarlas desde cada motor; opcional, no bloqueante.

## 2. Editar `app/components/GamePlayer.tsx`

Reemplazar:

```ts
import { initAsteroids, type AsteroidsEngine } from "@/app/games/asteroids/engine";
...
const isAsteroids = game.id === "asteroides";
...
const engineRef = useRef<AsteroidsEngine | null>(null);
...
useEffect(() => {
  if (!isAsteroids) return;
  ...
  const engine = initAsteroids(canvas, { ... });
  ...
}, [isAsteroids, game.id]);
```

Por:

```ts
import { engineRegistry } from "@/app/games/registry";
import type { GameEngine } from "@/app/games/asteroids/engine"; // o el tipo compartido, ver nota arriba
...
const engineInit = engineRegistry[game.id];
...
const engineRef = useRef<GameEngine | null>(null);
...
useEffect(() => {
  if (!engineInit) return;
  const canvas = canvasRef.current;
  if (!canvas) return;

  const engine = engineInit(canvas, {
    onScore: setScore,
    onLives: setLives,
    onLevel: setLevel,
    onGameOver: () => setOver(true),
  });
  engineRef.current = engine;

  return () => {
    engine.destroy();
    engineRef.current = null;
  };
}, [engineInit, game.id]);
```

Todas las demás referencias a `isAsteroids` (placeholder falso, canvas vs `.game-arena`, `togglePause`, `endGame`, `restart`) cambian de `isAsteroids` a `!!engineInit` / `engineInit != null` — misma lógica, solo la condición de origen cambia.

## 3. Verificación de no-regresión

- `npm run build` sin errores de tipos.
- `/juego/asteroides/jugar` sigue funcionando igual (motor real, HUD real, pausa/fin/salir).
- Juego sin entrada en el registro sigue mostrando el placeholder falso (`.game-arena` + score aleatorio) sin cambios.
