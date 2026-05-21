export function LoginForm({
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  loading,
}) {
  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label>
        Логин
        <input
          type="text"
          placeholder="Например: grandmaster_x"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          autoComplete="username"
        />
      </label>

      <label>
        Пароль
        <input
          type="password"
          placeholder="Введите ваш пароль"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          autoComplete="current-password"
        />
      </label>

      <div className="actions">
        <button type="submit" disabled={loading}>
          Войти
        </button>
      </div>
    </form>
  );
}
