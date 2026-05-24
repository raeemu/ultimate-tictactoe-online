const cellLabels = ["0", "1", "2", "3", "4", "5", "6", "7", "8"];

export function GameBoard({
  activeBoard,
  cells = [],
  disabled = false,
  isMatchOver = false,
  miniBoards = [],
  onCellClick,
}) {
  return (
    <div
      className={isMatchOver ? "ultimate-board ultimate-board-finished" : "ultimate-board"}
      aria-label="Игровое поле Ultimate Tic-Tac-Toe"
    >
      {cellLabels.map((_, boardIndex) => {
        const boardState = miniBoards[boardIndex] ?? "OPEN";
        const isActive = activeBoard === null || activeBoard === boardIndex;
        const isClosed = boardState !== "OPEN";
        const resultLabel = getMiniBoardResultLabel(boardState);

        return (
          <section
            className={[
              "mini-board",
              isActive && !isMatchOver ? "mini-board-active" : "mini-board-inactive",
              isClosed ? "mini-board-closed" : "",
              boardState === "DRAW" ? "mini-board-draw" : "",
            ].join(" ")}
            key={boardIndex}
            aria-label={`Локальное поле ${boardIndex + 1}`}
          >
            {isClosed ? <div className="mini-board-result">{resultLabel}</div> : null}
            {cellLabels.map((_, cellIndex) => {
              const value = cells[boardIndex * 9 + cellIndex];
              const canClick = !disabled && !isMatchOver && isActive && !isClosed && !value;

              return (
                <button
                  className={[
                    "game-cell",
                    value ? `game-cell-${value.toLowerCase()}` : "",
                    canClick ? "game-cell-playable" : "",
                  ].join(" ")}
                  disabled={!canClick}
                  key={cellIndex}
                  onClick={() => onCellClick?.(boardIndex, cellIndex)}
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

function getMiniBoardResultLabel(boardState) {
  if (boardState === "DRAW") {
    return "Ничья";
  }

  if (boardState === "X" || boardState === "O") {
    return boardState;
  }

  return "";
}