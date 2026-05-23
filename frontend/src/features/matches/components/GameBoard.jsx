const cellLabels = ["0", "1", "2", "3", "4", "5", "6", "7", "8"];

export function GameBoard({ activeBoard, cells = [], miniBoards = [] }) {
  return (
    <div className="ultimate-board" aria-label="Игровое поле Ultimate Tic-Tac-Toe">
      {cellLabels.map((_, boardIndex) => {
        const boardState = miniBoards[boardIndex] ?? "OPEN";
        const isActive = activeBoard === null || activeBoard === boardIndex;
        const isClosed = boardState !== "OPEN";

        return (
          <section
            className={[
              "mini-board",
              isActive ? "mini-board-active" : "mini-board-inactive",
              isClosed ? "mini-board-closed" : "",
            ].join(" ")}
            key={boardIndex}
            aria-label={`Локальное поле ${boardIndex + 1}`}
          >
            {isClosed ? <div className="mini-board-result">{boardState}</div> : null}
            {cellLabels.map((_, cellIndex) => {
              const value = cells[boardIndex * 9 + cellIndex];
              return (
                <button
                  className={`game-cell ${value ? `game-cell-${value.toLowerCase()}` : ""}`}
                  disabled
                  key={cellIndex}
                  type="button"
                >
                  {value ?? ""}
                </button>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}