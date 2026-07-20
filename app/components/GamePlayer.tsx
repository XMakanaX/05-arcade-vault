"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/app/lib/supabase/queries";
import { insertScore } from "@/app/lib/supabase/queries";
import { createClient } from "@/app/lib/supabase/client";
import { useSession } from "./session-context";
import { engineRegistry } from "@/app/games/registry";
import type { AsteroidsEngine } from "@/app/games/asteroids/engine";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function GamePlayer({ game }: { game: Game }) {
  const router = useRouter();
  const { user } = useSession();
  const engineInit = engineRegistry[game.id];

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState(user ? user.name : "INVITADO");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AsteroidsEngine | null>(null);

  // Motor real registrado — se monta/desmonta solo cuando game.id tiene entrada en engineRegistry.
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

  // Placeholder falso para el resto del catálogo.
  useEffect(() => {
    if (engineInit) return;
    if (over || paused) return;
    const t = setInterval(() => setScore((s) => s + Math.floor(10 + Math.random() * 90)), 220);
    return () => clearInterval(t);
  }, [engineInit, over, paused]);

  useEffect(() => {
    if (engineInit) return;
    if (score > 0 && score % 2500 < 100) setLevel((l) => l + 1);
  }, [engineInit, score]);

  const saveScore = () => {
    setSaveState("saving");
    const supabase = createClient();
    insertScore(supabase, game.id, name, score)
      .then(() => setSaveState("saved"))
      .catch(() => setSaveState("error"));
  };

  const togglePause = () => {
    if (engineInit && engineRef.current) {
      if (paused) engineRef.current.resume();
      else engineRef.current.pause();
    }
    setPaused((p) => !p);
  };

  const endGame = () => {
    if (engineInit) engineRef.current?.pause();
    setOver(true);
  };

  const restart = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setPaused(false);
    setOver(false);
    setSaveState("idle");
    if (engineInit) engineRef.current?.restart();
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button className="btn ghost" onClick={() => router.push(`/juego/${game.id}`)}>
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {engineInit ? (
            <canvas ref={canvasRef} width={800} height={600} className="game-canvas" />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div className="crt-content" style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}>
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {saveState === "idle" && (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="TUS INICIALES"
                />
                <button className="btn yellow" onClick={saveScore} disabled={!name.trim()}>
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            )}
            {saveState === "saving" && <div className="toast-saved">▸ GUARDANDO PUNTUACIÓN…</div>}
            {saveState === "saved" && (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA COMO {name}_</div>
            )}
            {saveState === "error" && (
              <div className="input-row">
                <div className="toast-saved">▸ NO SE PUDO GUARDAR_</div>
                <button className="btn yellow" onClick={saveScore}>
                  REINTENTAR
                </button>
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button className="btn magenta" onClick={() => router.push("/biblioteca")}>
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
