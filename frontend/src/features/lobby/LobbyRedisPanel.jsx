export function LobbyRedisPanel({ features }) {
  return (
    <section className="panel lobby-redis-panel">
      <p className="eyebrow">ТАБЛИЦА ЛИДЕРОВ</p>
      <h2>Топ игроков</h2>
      <ol className="leaderboard-list">
        {features.leaderboard.map((player) => (
          <li key={player.id}>
            <span>{player.username}</span>
            <strong>{player.rating}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}
