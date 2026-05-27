import { useState } from "react";
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
  idle: "Начните быстрый поиск или пригласите конкретного игрока.",
  joining: "Отправляем вас в очередь. Это займет пару секунд.",
  searching:
    "Вы в очереди. Диапазон рейтинга постепенно расширяется, пока не найдется соперник.",
  leaving: "Убираем вас из очереди.",
  matched: "Соперник найден. Можно переходить к игровому экрану.",
  error: "Попробуйте еще раз или проверьте подключение к серверу.",
};

export function MatchmakingPanel({ inviteFeatures, matchmaking }) {
  const [inviteMode, setInviteMode] = useState(false);
  const {
    cancelSearch,
    error,
    isBusy,
    isSearching,
    match,
    startSearch,
    status,
  } = matchmaking;
  const invites = inviteFeatures?.invites ?? [];

  return (
    <section className="panel matchmaking-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Быстрая игра</p>
          <h2>Найти соперника</h2>
        </div>
        <span className={`status-pill status-${status}`}>
          {statusText[status]}
        </span>
      </div>

      <p className="panel-copy">
        Запустите поиск, чтобы сыграть с ближайшим соперником по рейтингу, или
        отправьте приглашение по имени пользователя.
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
          <button
            type="button"
            className="secondary"
            onClick={cancelSearch}
            disabled={isBusy}
          >
            Отменить поиск
          </button>
        ) : (
          <>
            <button type="button" onClick={startSearch} disabled={isBusy}>
              Начать поиск
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setInviteMode((current) => !current)}
            >
              Пригласить игрока
            </button>
          </>
        )}
      </div>

      {inviteMode ? (
        inviteFeatures?.sentInvite ? (
          <div
            className={
              inviteFeatures.sentInvite.status === "declined"
                ? "invite-sent-card invite-sent-card-declined"
                : "invite-sent-card"
            }
          >
            <div>
              <p className="eyebrow">
                {inviteFeatures.sentInvite.status === "declined"
                  ? "Приглашение отклонено"
                  : "Приглашение отправлено"}
              </p>
              <strong>
                {inviteFeatures.sentInvite.status === "declined"
                  ? `${inviteFeatures.sentInvite.username} отклонил приглашение`
                  : `Ожидаем ответа ${inviteFeatures.sentInvite.username}`}
              </strong>
            </div>
            {inviteFeatures.sentInvite.status === "pending" ? (
              <button
                type="button"
                className="secondary danger-action"
                onClick={inviteFeatures.cancelSentInvite}
              >
                Отменить
              </button>
            ) : (
              <button
                type="button"
                className="secondary danger-action"
                onClick={() => inviteFeatures.setSentInvite(null)}
              >
                Закрыть
              </button>
            )}
          </div>
        ) : (
          <div className="invite-inline">
            <input
              placeholder="Введите имя пользователя, которого хотите пригласить"
              value={inviteFeatures?.inviteUsername ?? ""}
              onChange={(event) =>
                inviteFeatures?.setInviteUsername(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  inviteFeatures?.sendInvite();
                }
              }}
            />
            <button type="button" onClick={inviteFeatures?.sendInvite}>
              Пригласить
            </button>
          </div>
        )
      ) : null}

      {inviteFeatures?.error ? (
        <p className="error-text">{inviteFeatures.error}</p>
      ) : null}

      {invites.length ? (
        <div className="incoming-invites">
          <p className="eyebrow">Входящие приглашения</p>
          {invites.map((invite) => (
            <div className="incoming-invite-card" key={invite.id}>
              <div>
                <strong>{invite.fromUsername}</strong>
                <span>приглашает сыграть партию</span>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => inviteFeatures.accept(invite.id)}
                >
                  Принять
                </button>
                <button
                  type="button"
                  className="secondary danger-action"
                  onClick={() => inviteFeatures.decline(invite.id)}
                >
                  Отклонить
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
