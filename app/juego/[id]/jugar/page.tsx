import { notFound } from "next/navigation";
import { createClient } from "@/app/lib/supabase/server";
import { getGame } from "@/app/lib/supabase/queries";
import GamePlayer from "@/app/components/GamePlayer";

export default async function GamePlayerPage({ params }: PageProps<"/juego/[id]/jugar">) {
  const { id } = await params;
  const supabase = await createClient();
  const game = await getGame(supabase, id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
