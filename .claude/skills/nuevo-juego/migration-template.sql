-- Plantilla de migración para un juego nuevo — usar con mcp__supabase__apply_migration.
-- Reemplazar los placeholders <...> con los valores confirmados en Fase 2 del skill.
-- Tablas `games`/`scores` ya existen (spec 06) — esta migración solo inserta filas, no crea tablas.

-- Fila del juego nuevo en `games`.
insert into games (id, title, short, long, cat, cover, color)
values (
  '<id>',            -- slug, ej. 'tetris'
  '<TITLE>',         -- ej. 'TETRIS'
  '<short>',         -- descripción corta (tarjeta)
  '<long>',          -- descripción larga (detalle)
  '<CAT>',           -- 'ARCADE' | 'PUZZLE' | 'SHOOTER' | 'VERSUS'
  '<cover-class>',   -- clase CSS existente o nueva, ej. 'cover-tetro'
  '<color>'          -- acento del botón JUGAR
);

-- Seed de scores ficticios (opcional, solo si Fase 2 lo pidió) — evita leaderboard vacío.
-- Repetir/ajustar filas según la cantidad y rango acordados.
insert into scores (game_id, name, score) values
  ('<id>', '<NOMBRE1>', <score1>),
  ('<id>', '<NOMBRE2>', <score2>),
  ('<id>', '<NOMBRE3>', <score3>);

-- Verificación posterior (no parte de la migración, correr aparte con execute_sql o list_tables):
--   select * from games where id = '<id>';
--   select count(*) from scores where game_id = '<id>';
