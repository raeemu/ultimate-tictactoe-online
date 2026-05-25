import { Link, useNavigate, useParams } from "react-router-dom";
import { GameBoard } from "../features/matches/components/GameBoard";
import { MatchResultBanner } from "../features/matches/components/MatchResultBanner";
import { MatchStatusPanel, resolvePlayerSymbol } from "../features/matches/components/MatchStatusPanel";
import { useMatchConnection } from "../features/matches/hooks/useMatchConnection";
import { useAuth } from "../features/auth/components/AuthProvider";
import { useMatchmaking } from "../features/matchmaking/hooks/useMatchmaking";

export function GamePage() {
  const navigate = useNavigate();
  const { matchId } = useParams();
  const { token, user } = useAuth();
  const matchmaking = useMatchmaking(token);
  const {
    abandonError,
    abandonMatch,
    abandonStatus,
    error,
    match,
    moveError,
    moveStatus,
    sendMove,
    status,
  } = useMatchConnection(matchId, token);
  const playerSymbol = resolvePlayerSymbol(match, user?.id);
  const isMatchOver = Boolean(match && match.status !== "ACTIVE" && match.status !== "WAITING");
  const canMove = Boolean(
    match &&
    !isMatchOver &&
    status === "joined" &&
    moveStatus !== "sending" &&
    playerSymbol === match.currentTurn,
  );

  const goToLobby = () => {
    if (!match || match.status !== "ACTIVE") {
      navigate("/lobby");
      return;
    }

    const confirmed = window.confirm("Вы уверены, что хотите покинуть матч?");
    if (!confirmed) {
      return;
    }

    abandonMatch(() => navigate("/lobby"));
  };

  return (
    <main className="app-page game-page">
      <section className="game-layout">
        <header className="game-header panel">
          <div>
            <p className="eyebrow">Партия</p>
            <h1>Ultimate Tic-Tac-Toe</h1>
            <p>Следите за подсвеченным полем и выбирайте клетку для хода. Игра сама подскажет, когда очередь за вами.</p>
          </div>
          <div className="game-header-actions">
            <Link className="button-link button-link-secondary" to="/rules">
              Правила
            </Link>
            <button
              className="button-link button-link-secondary"
              disabled={abandonStatus === "leaving"}
              onClick={goToLobby}
              type="button"
            >
              В лобби
            </button>
          </div>
        </header>

        {error ? <p className="error-text panel">{error}</p> : null}

        <MatchResultBanner match={match} matchmaking={matchmaking} playerId={user?.id} />

        <div className="game-content">
          <section className={isMatchOver ? "panel board-panel board-panel-finished" : "panel board-panel"}>
            {match ? (
              <GameBoard
                activeBoard={match.activeBoard}
                cells={match.boardState}
                disabled={!canMove}
                isMatchOver={isMatchOver}
                miniBoards={match.macroboardState}
                onCellClick={sendMove}
              />
            ) : (
              <div className="board-placeholder">
                <p>{status === "error" ? "Не удалось открыть партию" : "Готовим поле..."}</p>
              </div>
            )}
          </section>

          <MatchStatusPanel
            abandonError={abandonError}
            abandonStatus={abandonStatus}
            connectionStatus={status}
            match={match}
            moveError={moveError}
            moveStatus={moveStatus}
            playerId={user?.id}
          />
        </div>
      </section>
    </main>
  );
}
