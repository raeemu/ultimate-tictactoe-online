const connectionText = {
  connecting: "Подключаемся к партии...",
  joining: "Открываем игровое поле...",
  joined: "Партия идет",
  disconnected: "Связь с партией прервалась",
  error: "Не удалось подключиться",
};

const matchStatusText = {
  WAITING: "Ожидаем второго игрока",
  ACTIVE: "Партия идет",
  FINISHED: "Партия завершена",
  ABANDONED: "Партия покинута",
};

export function MatchStatusPanel({ abandonError, abandonStatus, connectionStatus, match, moveError, moveStatus, playerId }) {
  const playerSymbol = resolvePlayerSymbol(match, playerId);
  const isMyTurn = Boolean(playerSymbol && match?.currentTurn === playerSymbol && match?.status === "ACTIVE");
  const isMatchOver = Boolean(match && match.status !== "ACTIVE" && match.status !== "WAITING");
  const activeBoardLabel = match?.activeBoard === null || match?.activeBoard === undefined
    ? "Можно выбрать любое открытое поле"
    : `Играем в поле ${match.activeBoard + 1}`;
  const panelTitle = match ? matchStatusText[match.status] ?? connectionText[connectionStatus] : connectionText[connectionStatus];
  const playerTurnLabel = getTurnLabel(match, isMyTurn);

  return (
    <aside className="match-status-panel panel">
      <p className="eyebrow">Партия</p>
      <h2>{panelTitle ?? connectionText.connecting}</h2>

      {match ? (
        <>
          <div className={isMyTurn ? "turn-banner turn-banner-active" : "turn-banner"}>
            {moveStatus === "sending" ? "Отправляем ход..." : playerTurnLabel}
          </div>

          {moveError ? <p className="error-text">{moveError}</p> : null}
          {abandonStatus === "leaving" ? <p className="helper-text">Покидаем партию...</p> : null}
          {abandonError ? <p className="error-text">{abandonError}</p> : null}

          <dl className="match-facts">
            <div>
              <dt>Ваш знак</dt>
              <dd>{playerSymbol ?? "-"}</dd>
            </div>
            <div>
              <dt>{isMatchOver ? "Что дальше" : "Куда ходить"}</dt>
              <dd>{isMatchOver ? "Можно вернуться в лобби и начать новую партию" : activeBoardLabel}</dd>
            </div>
          </dl>
        </>
      ) : null}
    </aside>
  );
}

export function resolvePlayerSymbol(match, playerId) {
  if (!match || !playerId) {
    return null;
  }

  if (match.playerXId === playerId) {
    return "X";
  }

  if (match.playerOId === playerId) {
    return "O";
  }

  return null;
}

function getTurnLabel(match, isMyTurn) {
  if (!match) {
    return "Открываем партию";
  }

  if (match.status === "ABANDONED") {
    return "Один из игроков покинул матч";
  }

  if (match.status === "FINISHED") {
    return "Игра завершена";
  }

  return isMyTurn ? "Ваш ход" : "Ждем ход соперника";
}
