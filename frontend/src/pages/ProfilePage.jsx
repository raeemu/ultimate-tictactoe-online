import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/components/AuthProvider";
import { useProfile } from "../features/profile/hooks/useProfile";

const resultText = {
  WIN: "Победа",
  LOSS: "Поражение",
  DRAW: "Ничья",
  ACTIVE: "Идет игра",
  ABANDONED: "Покинута",
  WAITING: "Ожидание",
};

export function ProfilePage() {
  const { logout, token } = useAuth();
  const { data, error, loadMore, loading, loadingMore } = useProfile(token);

  if (loading) {
    return (
      <main className="app-page">
        <section className="profile-layout">
          <div className="panel">
            <p>Загружаем профиль...</p>
          </div>
        </section>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="app-page">
        <section className="profile-layout">
          <div className="panel">
            <p className="error-text">{error}</p>
            <Link className="button-link" to="/lobby">В лобби</Link>
          </div>
        </section>
      </main>
    );
  }

  const { history, recentMatches, stats, user } = data;

  return (
    <main className="app-page">
      <section className="profile-layout">
        <header className="profile-header panel">
          <div className="profile-avatar" aria-hidden="true">
            {user.username.slice(0, 1).toUpperCase()}
          </div>

          <div className="profile-title">
            <p className="eyebrow">Профиль игрока</p>
            <h1>{user.username}</h1>
            <p>{user.email}</p>
            <p>В игре с {formatDate(user.createdAt)}</p>
          </div>

          <div className="profile-actions">
            <Link className="button-link button-link-secondary" to="/lobby">Лобби</Link>
            <button type="button" className="secondary" onClick={logout}>Выйти</button>
          </div>
        </header>

        <section className="stats-grid">
          <StatCard label="Рейтинг" value={user.rating} />
          <StatCard label="Матчи" value={stats.total} />
          <StatCard label="Победы" value={stats.wins} tone="win" />
          <StatCard label="Поражения" value={stats.losses} tone="loss" />
          <StatCard label="Ничьи" value={stats.draws} />
          <StatCard label="Покинутые" value={stats.abandoned} />
        </section>

        <section className="panel history-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">История</p>
              <h2>Последние партии</h2>
            </div>
          </div>

          {recentMatches.length > 0 ? (
            <>
              <div className="match-history-list">
                {recentMatches.map((match) => (
                  <article className="history-item" key={match.id}>
                    <div>
                      <strong>{resultText[match.result] ?? match.result}</strong>
                      <p>Соперник: {match.opponent?.username ?? "не назначен"}</p>
                    </div>

                    <div>
                      <span className={`history-result result-${getResultTone(match.result)}`}>
                        {match.playerSymbol}
                      </span>
                    </div>

                    <div className="history-rating">
                      <span className={getRatingDeltaClass(match.ratingDelta)}>
                        {formatRatingDelta(match.ratingDelta)}
                      </span>
                    </div>

                    <div className="history-meta">
                      <span>{match.movesCount} ходов</span>
                      <span>{formatDate(match.finishedAt ?? match.updatedAt)}</span>
                    </div>

                    {match.status === "ACTIVE" ? (
                      <Link className="button-link button-link-secondary" to={`/game/${match.id}`}>
                        Продолжить
                      </Link>
                    ) : null}
                  </article>
                ))}
              </div>

              {history?.hasMore ? (
                <div className="history-actions">
                  <button type="button" className="secondary" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? "Загружаем..." : "Показать больше"}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p>История пока пустая. Начните первую партию в лобби.</p>
          )}

          {error ? <p className="error-text history-error">{error}</p> : null}
        </section>
      </section>
    </main>
  );
}

function StatCard({ label, tone = "neutral", value }) {
  return (
    <article className={`stat-card stat-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function getResultTone(result) {
  if (result === "WIN") {
    return "win";
  }

  if (result === "LOSS") {
    return "loss";
  }

  return "neutral";
}

function getRatingDeltaClass(delta) {
  if (delta > 0) {
    return "rating-delta rating-delta-positive";
  }

  if (delta < 0) {
    return "rating-delta rating-delta-negative";
  }

  return "rating-delta";
}

function formatRatingDelta(delta) {
  if (delta > 0) {
    return `+${delta}`;
  }

  return String(delta);
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
