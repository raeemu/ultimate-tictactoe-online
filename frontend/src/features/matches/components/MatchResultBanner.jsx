import { Link } from "react-router-dom";

export function MatchResultBanner({ match, matchmaking, playerId }) {
  if (!match || match.status === "ACTIVE" || match.status === "WAITING") {
    return null;
  }

  const result = getMatchResult(match, playerId);
  const nextMatch =
    matchmaking.match?.id && matchmaking.match.id !== match.id
      ? matchmaking.match
      : null;

  return (
    <section className={`panel result-banner result-${result.tone}`}>
      <div>
        <p className="eyebrow">Итог партии</p>
        <h2>{result.title}</h2>
        <p>{result.description}</p>
        {matchmaking.error ? <p className="error-text">{matchmaking.error}</p> : null}
      </div>

      <div className="result-actions">
        {nextMatch ? (
          <Link className="button-link" to={`/game/${nextMatch.id}`}>
            Перейти к новой игре
          </Link>
        ) : (
          <button
            className="button-link"
            disabled={matchmaking.isBusy || matchmaking.isSearching}
            onClick={matchmaking.startSearch}
            type="button"
          >
            {matchmaking.isSearching ? "Ищем соперника..." : "Найти новую игру"}
          </button>
        )}
      </div>
    </section>
  );
}

function getMatchResult(match, playerId) {
  if (match.status === "ABANDONED") {
    return {
      description: "Партия остановлена. Можно сразу найти нового соперника.",
      title: "Партия покинута",
      tone: "neutral",
    };
  }

  if (match.status === "FINISHED" && !match.winnerId) {
    return {
      description: "Все решающие поля закрыты, победителя нет.",
      title: "Ничья",
      tone: "neutral",
    };
  }

  if (match.status === "FINISHED" && match.winnerId === playerId) {
    return {
      description: "Вы собрали выигрышную линию на большом поле.",
      title: "Победа",
      tone: "win",
    };
  }

  if (match.status === "FINISHED") {
    return {
      description: "Соперник забрал эту партию. Можно попробовать еще раз в следующей игре.",
      title: "Поражение",
      tone: "loss",
    };
  }

  return {
    description: "Партия завершилась.",
    title: "Игра окончена",
    tone: "neutral",
  };
}
