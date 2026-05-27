import { Link } from "react-router-dom";
import { MatchmakingPanel } from "../features/matchmaking/components/MatchmakingPanel";
import { useMatchmaking } from "../features/matchmaking/hooks/useMatchmaking";
import { useAuth } from "../features/auth/components/AuthProvider";
import { LobbyRedisPanel } from "../features/lobby/LobbyRedisPanel";
import { useLobbyRedisFeatures } from "../features/lobby/useLobbyRedisFeatures";

export function LobbyPage() {
  const { logout, token, user } = useAuth();
  const matchmaking = useMatchmaking(token);
  const redisFeatures = useLobbyRedisFeatures(token);

  return (
    <main className="app-page">
      <section className="lobby-layout">
        <header className="lobby-hero">
          <div>
            <p className="eyebrow">Ultimate Tic-Tac-Toe Online</p>
            <h1>Лобби</h1>
            <p>Начните поиск, чтобы сыграть онлайн-партию.</p>
          </div>

          <div className="profile-card">
            <p className="eyebrow">Игрок</p>
            <strong>{user?.username ?? "Игрок"}</strong>
            <span>{user?.email ?? "Email не указан"}</span>
            <Link className="button-link button-link-secondary" to="/rules">
              Правила
            </Link>
            <Link className="button-link button-link-secondary" to="/profile">
              Профиль
            </Link>
            <button type="button" className="secondary" onClick={logout}>
              Выйти
            </button>
          </div>
        </header>

        <MatchmakingPanel
          inviteFeatures={redisFeatures}
          matchmaking={matchmaking}
        />
        <LobbyRedisPanel features={redisFeatures} />
      </section>
    </main>
  );
}
