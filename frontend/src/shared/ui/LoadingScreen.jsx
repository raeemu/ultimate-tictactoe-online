export function LoadingScreen({ message = "Загружаем..." }) {
  return (
    <main className="center-page">
      <section className="card compact-card">
        <p>{message}</p>
      </section>
    </main>
  );
}
