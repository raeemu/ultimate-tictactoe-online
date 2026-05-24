import { MatchmakingPanel } from "../features/matchmaking/components/MatchmakingPanel";
import { useMatchmaking } from "../features/matchmaking/hooks/useMatchmaking";
import { useAuth } from "../features/auth/components/AuthProvider";

export function LobbyPage() {
  const { logout, token, user } = useAuth();
  const matchmaking = useMatchmaking(token);

  return (
    <main className="app-page">
      <section className="lobby-layout">
        <header className="lobby-hero">
          <div>
            <p className="eyebrow">Ultimate Tic-Tac-Toe Online</p>
            <h1>Лобби</h1>
            <p>Начните поиск, чтобы начать играть.</p>
          </div>

          <div className="profile-card">
            <p className="eyebrow">Игрок</p>
            <strong>{user?.username ?? "Игрок"}</strong>
            <span>{user?.email ?? "Email не указан"}</span>
            <button type="button" className="secondary" onClick={logout}>
              Выйти
            </button>
          </div>
        </header>

        <MatchmakingPanel matchmaking={matchmaking} />
      </section>
    </main>
  );
}
