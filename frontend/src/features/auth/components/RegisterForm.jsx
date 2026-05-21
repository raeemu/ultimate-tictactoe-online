export function RegisterForm({
  username,
  email,
  password,
  confirmPassword,
  onUsernameChange,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  loading,
}) {
  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label>
        Логин
        <input
          type="text"
          placeholder="Придумайте логин"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          autoComplete="username"
        />
      </label>

      <label>
        Email
        <input
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          autoComplete="email"
        />
      </label>

      <label>
        Пароль
        <input
          type="password"
          placeholder="Минимум 8 символов, буквы и цифры"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          autoComplete="new-password"
        />
      </label>

      <label>
        Повторите пароль
        <input
          type="password"
          placeholder="Введите пароль еще раз"
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          autoComplete="new-password"
        />
      </label>

      <div className="actions">
        <button type="submit" className="secondary" disabled={loading}>
          Зарегистрироваться
        </button>
      </div>
    </form>
  );
}
