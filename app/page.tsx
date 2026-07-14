import { createClient } from "@/app/lib/supabase/server";
import { getGames, getTopScores } from "@/app/lib/supabase/queries";
import HomeClient from "./HomeClient";

const TICKER_TIMES = [
  "hace 2 min",
  "hace 5 min",
  "hace 8 min",
  "hace 12 min",
  "hace 18 min",
  "hace 24 min",
  "hace 31 min",
];
const TICKER_COLORS = ["magenta", "yellow", "green", "cyan"];

export default async function Home() {
  const supabase = await createClient();
  const games = await getGames(supabase);
  const primaryGameId = games[0]?.id;

  const [tickerScores, top5] = primaryGameId
    ? await Promise.all([
        getTopScores(supabase, primaryGameId, 7),
        getTopScores(supabase, primaryGameId, 5),
      ])
    : [[], []];

  const ticker = tickerScores.map((row, i) => ({
    ...row,
    game: games[i % games.length]?.title ?? "",
    time: TICKER_TIMES[i] ?? "",
    color: TICKER_COLORS[i % TICKER_COLORS.length],
  }));

  return <HomeClient games={games} ticker={ticker} top5={top5} />;
}
