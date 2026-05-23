import { Link, useParams } from "react-router-dom";
import { GameBoard } from "../features/matches/components/GameBoard";
import { MatchStatusPanel } from "../features/matches/components/MatchStatusPanel";
import { useMatchConnection } from "../features/matches/hooks/useMatchConnection";
import { useAuth } from "../features/auth/components/AuthProvider";

export function GamePage() {
  const { matchId } = useParams();
  const { token, user } = useAuth();
  const { error, match, status } = useMatchConnection(matchId, token);

  return (
    <main className="app-page game-page">
      <section className="game-layout">
        <header className="game-header panel">
          <div>
            <p className="eyebrow">Матч</p>
            <h1>Ultimate Tic-Tac-Toe</h1>
            <p>Подключение к матчу и первое состояние поля загружаются через WebSocket.</p>
          </div>
          <Link className="button-link button-link-secondary" to="/lobby">
            Вернуться в лобби
          </Link>
        </header>

        {error ? <p className="error-text panel">{error}</p> : null}

        <div className="game-content">
          <section className="panel board-panel">
            {match ? (
              <GameBoard
                activeBoard={match.activeBoard}
                cells={match.boardState}
                miniBoards={match.macroboardState}
              />
            ) : (
              <div className="board-placeholder">
                <p>{status === "error" ? "Не удалось загрузить поле" : "Загружаем поле..."}</p>
              </div>
            )}
          </section>

          <MatchStatusPanel connectionStatus={status} match={match} playerId={user?.id} />
        </div>
      </section>
    </main>
  );
}