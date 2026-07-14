import { createClient } from "@/app/lib/supabase/server";
import { getGames, getTopScores } from "@/app/lib/supabase/queries";
import BibliotecaClient from "./BibliotecaClient";

export default async function BibliotecaPage() {
  const supabase = await createClient();
  const games = await getGames(supabase);
  const withBest = await Promise.all(
    games.map(async (g) => {
      const [top] = await getTopScores(supabase, g.id, 1);
      return { ...g, best: top?.score ?? 0 };
    }),
  );

  return <BibliotecaClient games={withBest} />;
}
