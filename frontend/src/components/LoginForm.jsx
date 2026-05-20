window.LoginForm = function LoginForm({
  username,
  password,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  loading,
}) {
  return (
    <>
      <label>
        Логин
        <input
          type="text"
          placeholder="Например: grandmaster_x"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
        />
      </label>

      <label>
        Пароль
        <input
          type="password"
          placeholder="Введите ваш пароль"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
        />
      </label>

      <div className="actions">
        <button type="button" onClick={onSubmit} disabled={loading}>
          Войти
        </button>
      </div>
    </>
  );
};
