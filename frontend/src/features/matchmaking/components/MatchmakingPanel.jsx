import { Link } from "react-router-dom";

const statusText = {
  idle: "Готовы к игре",
  joining: "Подключаемся...",
  searching: "Ищем соперника...",
  leaving: "Отменяем поиск...",
  matched: "Матч найден",
  error: "Не удалось начать поиск",
};

const statusHint = {
  idle: "Нажмите кнопку, когда будете готовы. Мы подберем соперника и подготовим матч.",
  joining: "Отправляем вас в очередь. Это займет пару секунд.",
  searching: "Вы в очереди. Можно не обновлять страницу, статус изменится после подбора пары.",
  leaving: "Убираем вас из очереди.",
  matched: "Соперник найден. Дальше здесь появится переход к игровому экрану.",
  error: "Попробуйте еще раз или проверьте подключение к серверу.",
};

export function MatchmakingPanel({ matchmaking }) {
  const {
    cancelSearch,
    error,
    isBusy,
    isSearching,
    match,
    startSearch,
    status,
  } = matchmaking;

  return (
    <section className="panel matchmaking-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Быстрая игра</p>
          <h2>Найти соперника</h2>
        </div>
        <span className={`status-pill status-${status}`}>{statusText[status]}</span>
      </div>

      <p className="panel-copy">
        Запустите поиск, когда будете готовы сыграть онлайн. Как только найдется соперник,
        ваш матч начнет, и вы сможете перейти к игре. Не беспокойтесь, если захотите отменить поиск - это можно сделать в любой момент.
      </p>

      <div className="queue-state-card">
        <span className={`queue-dot status-${status}`} />
        <p>{statusHint[status]}</p>
      </div>

      {match ? (
        <div className="match-summary">
          <p className="eyebrow">Матч готов</p>
          <strong>{match.id}</strong>
          <p>Соперник найден. Можно переходить к игровому экрану.</p>
          <Link className="button-link" to={`/game/${match.id}`}>
            Перейти к игре
          </Link>
        </div>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <div className="panel-actions">
        {isSearching ? (
          <button type="button" className="secondary" onClick={cancelSearch} disabled={isBusy}>
            Отменить поиск
          </button>
        ) : (
          <button type="button" onClick={startSearch} disabled={isBusy}>
            Начать поиск
          </button>
        )}
      </div>
    </section>
  );
}
