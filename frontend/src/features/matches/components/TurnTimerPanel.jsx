import { useEffect, useState } from "react";

export function TurnTimerPanel({ deadline, isActive }) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const intervalId = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(intervalId);
  }, []);

  const remainingSeconds =
    deadline && isActive ? Math.max(Math.ceil((deadline - now) / 1000), 0) : 0;
  const progress =
    deadline && isActive ? Math.max(remainingSeconds / 60, 0) : 0;

  return (
    <aside className="panel turn-timer-panel">
      <p className="eyebrow">Таймер хода</p>
      <strong>{isActive && deadline ? `${remainingSeconds} сек` : "-"}</strong>
      <div className="turn-timer-track">
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
    </aside>
  );
}
