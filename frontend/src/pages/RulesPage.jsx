import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/components/AuthProvider";

const guideCells = Array.from({ length: 9 }, (_, index) => index);

function MiniBoardGuide({ activeIndex, moveIndex }) {
  return (
    <div className="rules-mini-board" aria-label="Малое поле">
      {guideCells.map((cellIndex) => {
        const className = [
          "rules-mini-cell",
          cellIndex === activeIndex ? "rules-mini-cell-active" : "",
          cellIndex === moveIndex ? "rules-mini-cell-move" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <span className={className} key={cellIndex}>
            {cellIndex === moveIndex ? "X" : ""}
          </span>
        );
      })}
    </div>
  );
}

function MacroBoardGuide({ targetIndex }) {
  return (
    <div className="rules-macro-board" aria-label="Большое поле">
      {guideCells.map((cellIndex) => (
        <div
          className={cellIndex === targetIndex ? "rules-macro-cell rules-macro-cell-target" : "rules-macro-cell"}
          key={cellIndex}
        >
          {cellIndex === targetIndex ? <MiniBoardGuide activeIndex={targetIndex} /> : null}
        </div>
      ))}
    </div>
  );
}

export function RulesPage() {
  const { isAuthenticated } = useAuth();
  const backLink = isAuthenticated ? "/lobby" : "/auth";
  const backText = isAuthenticated ? "В лобби" : "К входу";

  return (
    <main className="app-page">
      <section className="rules-layout">
        <header className="rules-header panel">
          <div>
            <p className="eyebrow">Ultimate Tic-Tac-Toe</p>
            <h1>Правила игры</h1>
            <p>
              Это обычные крестики-нолики, но каждое малое поле становится клеткой большого поля. Побеждает тот,
              кто первым соберет линию из трех выигранных малых полей.
            </p>
          </div>
          <Link className="button-link button-link-secondary" to={backLink}>
            {backText}
          </Link>
        </header>

        <section className="rules-explainer panel">
          <div className="rules-copy">
            <p className="eyebrow">Главная механика</p>
            <h2>Клетка хода задает следующее поле</h2>
            <p>
              Если игрок ставит знак в правую нижнюю клетку малого поля, соперник должен ходить в правое нижнее
              малое поле на большом поле.
            </p>
          </div>

          <div className="rules-scheme" aria-label="Схема направления следующего хода">
            <div className="rules-scheme-card">
              <span className="rules-scheme-label">Текущий ход</span>
              <MiniBoardGuide moveIndex={8} />
            </div>
            <div className="rules-arrow" aria-hidden="true">
              →
            </div>
            <div className="rules-scheme-card">
              <span className="rules-scheme-label">Следующее поле</span>
              <MacroBoardGuide targetIndex={8} />
            </div>
          </div>
        </section>

        <section className="rules-grid">
          <article className="rules-step panel">
            <span className="rules-step-number">1</span>
            <h2>Выберите доступное поле</h2>
            <p>
              В начале партии можно ходить в любое малое поле. После первого хода доступное поле определяется
              предыдущей клеткой.
            </p>
          </article>

          <article className="rules-step panel">
            <span className="rules-step-number">2</span>
            <h2>Выигрывайте малые поля</h2>
            <p>
              Малое поле закрывается, когда внутри него собраны три знака в ряд. Победитель малого поля получает
              соответствующую клетку на большом поле.
            </p>
          </article>

          <article className="rules-step panel">
            <span className="rules-step-number">3</span>
            <h2>Соберите большое поле</h2>
            <p>
              Чтобы выиграть партию, нужно занять три малых поля в ряд: горизонтально, вертикально или по диагонали.
            </p>
          </article>

          <article className="rules-step panel">
            <span className="rules-step-number">4</span>
            <h2>Используйте свободный ход</h2>
            <p>
              Если игрока отправили в уже завершенное малое поле, он может выбрать любое другое открытое поле.
            </p>
          </article>
        </section>
      </section>
    </main>
  );
}
