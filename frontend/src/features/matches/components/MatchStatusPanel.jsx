const connectionText = {
  connecting: "Подключаемся к матчу...",
  joining: "Загружаем состояние матча...",
  joined: "Матч подключен",
  disconnected: "Соединение с матчем потеряно",
  error: "Ошибка подключения",
};

export function MatchStatusPanel({ connectionStatus, match, playerId }) {
  const playerSymbol = resolvePlayerSymbol(match, playerId);
  const turnLabel = match?.currentTurn ? `Ход ${match.currentTurn}` : "Ход неизвестен";
  const activeBoardLabel = match?.activeBoard === null || match?.activeBoard === undefined
    ? "Любое открытое поле"
    : `Локальное поле ${match.activeBoard + 1}`;

  return (
    <aside className="match-status-panel panel">
      <p className="eyebrow">Статус</p>
      <h2>{connectionText[connectionStatus] ?? connectionText.connecting}</h2>

      {match ? (
        <dl className="match-facts">
          <div>
            <dt>Вы играете за</dt>
            <dd>{playerSymbol ?? "-"}</dd>
          </div>
          <div>
            <dt>Текущий ход</dt>
            <dd>{turnLabel}</dd>
          </div>
          <div>
            <dt>Активное поле</dt>
            <dd>{activeBoardLabel}</dd>
          </div>
          <div>
            <dt>Статус матча</dt>
            <dd>{match.status}</dd>
          </div>
        </dl>
      ) : null}
    </aside>
  );
}

function resolvePlayerSymbol(match, playerId) {
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