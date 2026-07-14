import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;
  color: string;
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}

function toGame(row: Database["public"]["Tables"]["games"]["Row"]): Game {
  return {
    id: row.id,
    title: row.title,
    short: row.short,
    long: row.long,
    cat: row.cat as Game["cat"],
    cover: row.cover,
    color: row.color,
  };
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export async function getGames(client: Client): Promise<Game[]> {
  const { data, error } = await client.from("games").select("*").order("created_at");
  if (error) throw error;
  return (data ?? []).map(toGame);
}

export async function getGame(client: Client, id: string): Promise<Game | null> {
  const { data, error } = await client.from("games").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toGame(data) : null;
}

export async function getTopScores(
  client: Client,
  gameId: string,
  limit = 10,
): Promise<ScoreRow[]> {
  const { data, error } = await client
    .from("scores")
    .select("name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row, i) => ({
    rank: i + 1,
    name: row.name,
    score: row.score,
    date: formatDate(row.created_at),
  }));
}

export async function getScoreCount(client: Client, gameId: string): Promise<number> {
  const { count, error } = await client
    .from("scores")
    .select("*", { count: "exact", head: true })
    .eq("game_id", gameId);
  if (error) throw error;
  return count ?? 0;
}

export async function insertScore(
  client: Client,
  gameId: string,
  name: string,
  score: number,
): Promise<void> {
  const { error } = await client.from("scores").insert({ game_id: gameId, name, score });
  if (error) throw error;
}
