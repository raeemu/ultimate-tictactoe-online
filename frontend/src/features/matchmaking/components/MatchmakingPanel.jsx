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

export function MatchmakingPanel({ inviteFeatures, matchmaking, userId }) {
  const [inviteMode, setInviteMode] = useState(false);
  const invites = inviteFeatures?.invites ?? [];

  if (matchmaking.match) {
    return (
      <CurrentMatchPanel matchmaking={matchmaking} userId={userId} />
    );
  }

  return (
    <section className="panel matchmaking-panel">
      <SearchHeader status={matchmaking.status} />
      <p className="panel-copy">
        Запустите поиск, чтобы сыграть с ближайшим соперником по рейтингу, или
        отправьте приглашение по имени пользователя.
      </p>
      <QueueStatus status={matchmaking.status} />
      {matchmaking.error ? <p className="error-text">{matchmaking.error}</p> : null}
      <SearchActions
        inviteMode={inviteMode}
        matchmaking={matchmaking}
        setInviteMode={setInviteMode}
      />
      {inviteMode ? <InviteComposer inviteFeatures={inviteFeatures} /> : null}
      {inviteFeatures?.error ? (
        <p className="error-text">{inviteFeatures.error}</p>
      ) : null}
      <IncomingInvites inviteFeatures={inviteFeatures} invites={invites} />
    </section>
  );
}

function CurrentMatchPanel({ matchmaking, userId }) {
  const {
    acceptCurrentMatch,
    acceptStatus,
    error,
    isBusy,
    lastResponseStatus,
    leaveCurrentMatch,
    match,
  } = matchmaking;
  const opponent = resolveOpponent(match, userId);
  const isWaitingForAccept = match?.status === "WAITING";
  const isAcceptedByMe = Boolean(
    userId && match?.acceptedPlayerIds?.includes(userId),
  );
  const isRecoveredMatch =
    lastResponseStatus === "ACTIVE_MATCH" && match?.status === "ACTIVE";

  return (
    <section className="panel current-match-panel">
      <MatchFoundHeader isRecoveredMatch={isRecoveredMatch} />
      <dl className="current-match-table">
        <div>
          <dt>Ваш соперник</dt>
          <dd>{opponent?.username ?? "Соперник"}</dd>
        </div>
      </dl>
      {error ? <p className="error-text">{error}</p> : null}
      <MatchActions
        acceptCurrentMatch={acceptCurrentMatch}
        acceptStatus={acceptStatus}
        isAcceptedByMe={isAcceptedByMe}
        isBusy={isBusy}
        isRecoveredMatch={isRecoveredMatch}
        isWaitingForAccept={isWaitingForAccept}
        leaveCurrentMatch={leaveCurrentMatch}
        match={match}
      />
    </section>
  );
}

function MatchFoundHeader({ isRecoveredMatch }) {
  return (
    <div className="panel-heading">
      <div>
        <p className="eyebrow">
          {isRecoveredMatch ? "Текущий матч" : "Матч найден"}
        </p>
        <h2>{isRecoveredMatch ? "Игра активна" : "Соперник найден"}</h2>
      </div>
      <span className="status-pill status-matched">Матч найден</span>
    </div>
  );
}

function MatchActions(props) {
  const panelClass = props.isRecoveredMatch
    ? "panel-actions"
    : "panel-actions panel-actions-single";

  return (
    <div className={panelClass}>
      {props.isWaitingForAccept ? (
        <button
          type="button"
          disabled={props.isBusy || props.isAcceptedByMe || props.acceptStatus === "waiting"}
          onClick={props.acceptCurrentMatch}
        >
          {acceptButtonText(props.isAcceptedByMe, props.acceptStatus)}
        </button>
      ) : (
        <Link className="button-link" to={`/game/${props.match.id}`}>
          {props.isRecoveredMatch ? "Переподключиться" : "Начать игру"}
        </Link>
      )}
      {props.isRecoveredMatch ? (
        <button
          type="button"
          className="secondary danger-action"
          disabled={props.isBusy}
          onClick={props.leaveCurrentMatch}
        >
          Покинуть
        </button>
      ) : null}
    </div>
  );
}

function acceptButtonText(isAcceptedByMe, acceptStatus) {
  if (isAcceptedByMe || acceptStatus === "waiting") {
    return "Ожидаем соперника";
  }

  return acceptStatus === "accepting" ? "Принимаем..." : "Принять";
}

function SearchHeader({ status }) {
  return (
    <div className="panel-heading">
      <div>
        <p className="eyebrow">Поиск матча</p>
        <h2>Подбор соперника</h2>
      </div>
      <span className={`status-pill status-${status}`}>{statusText[status]}</span>
    </div>
  );
}

function QueueStatus({ status }) {
  return (
    <div className="queue-state-card">
      <span className={`queue-dot status-${status}`} />
      <p>{statusHint[status]}</p>
    </div>
  );
}

function SearchActions({ inviteMode, matchmaking, setInviteMode }) {
  if (matchmaking.isSearching) {
    return (
      <div className="panel-actions">
        <button
          type="button"
          className="secondary"
          onClick={matchmaking.cancelSearch}
          disabled={matchmaking.isBusy}
        >
          Отменить поиск
        </button>
      </div>
    );
  }

  return (
    <div className="panel-actions">
      <button type="button" onClick={matchmaking.startSearch} disabled={matchmaking.isBusy}>
        Начать поиск
      </button>
      <button
        type="button"
        className="secondary"
        onClick={() => setInviteMode(!inviteMode)}
      >
        Пригласить игрока
      </button>
    </div>
  );
}

function InviteComposer({ inviteFeatures }) {
  if (inviteFeatures?.sentInvite) {
    return <SentInviteCard inviteFeatures={inviteFeatures} />;
  }

  return (
    <div className="invite-inline">
      <input
        placeholder="Введите имя пользователя, которого хотите пригласить"
        value={inviteFeatures?.inviteUsername ?? ""}
        onChange={(event) => inviteFeatures?.setInviteUsername(event.target.value)}
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
  );
}

function SentInviteCard({ inviteFeatures }) {
  const sentInvite = inviteFeatures.sentInvite;
  const isDeclined = sentInvite.status === "declined";

  return (
    <div
      className={
        isDeclined
          ? "invite-sent-card invite-sent-card-declined"
          : "invite-sent-card"
      }
    >
      <div>
        <p className="eyebrow">
          {isDeclined
            ? "Приглашение отклонено"
            : "Приглашение отправлено"}
        </p>
        <strong>
          {isDeclined
            ? `${sentInvite.username} отклонил приглашение`
            : `Ожидаем ответ ${sentInvite.username}`}
        </strong>
      </div>
      <SentInviteAction inviteFeatures={inviteFeatures} isDeclined={isDeclined} />
    </div>
  );
}

function SentInviteAction({ inviteFeatures, isDeclined }) {
  return isDeclined ? (
    <button
      type="button"
      className="secondary danger-action"
      onClick={() => inviteFeatures.setSentInvite(null)}
    >
      Закрыть
    </button>
  ) : (
    <button
      type="button"
      className="secondary danger-action"
      onClick={inviteFeatures.cancelSentInvite}
    >
      Отменить
    </button>
  );
}

function IncomingInvites({ inviteFeatures, invites }) {
  if (!invites.length) {
    return null;
  }

  return (
    <div className="incoming-invites">
      <p className="eyebrow">Входящие приглашения</p>
      {invites.map((invite) => (
        <div className="incoming-invite-card" key={invite.id}>
          <div>
            <strong>{invite.fromUsername}</strong>
            <span>приглашает сыграть партию</span>
          </div>
          <div>
            <button type="button" onClick={() => inviteFeatures.accept(invite.id)}>
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
  );
}

function resolveOpponent(match, userId) {
  if (!match || !userId) {
    return null;
  }

  if (match.playerXId === userId) {
    return match.playerO ?? null;
  }

  if (match.playerOId === userId) {
    return match.playerX ?? null;
  }

  return null;
}
