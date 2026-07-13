import { notFound } from "next/navigation";
import { GAMES } from "@/app/data/games";
import GamePlayer from "@/app/components/GamePlayer";

export async function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export default async function GamePlayerPage({ params }: PageProps<"/juego/[id]/jugar">) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
