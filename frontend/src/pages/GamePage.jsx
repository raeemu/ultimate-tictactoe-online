import { useParams } from "react-router-dom";

export function GamePage() {
  const { matchId } = useParams();

  return (
    <main className="app-page">
      <section className="lobby-layout">
        <div className="panel">
          <p className="eyebrow">Матч</p>
          <h1>Игровой экран</h1>
          <p className="panel-copy">
            Матч {matchId} готов к подключению. Интерфейс игрового поля будет реализован следующим шагом.
          </p>
        </div>
      </section>
    </main>
  );
}
