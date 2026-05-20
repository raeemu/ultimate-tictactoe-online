const { useEffect, useState } = React;

function AuthPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [path, setPath] = useState(window.location.pathname);

  const isRegister = path === "/register";

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const onLogin = async () => {
    const error = window.authValidation.validateLogin(username, password);
    if (error) {
      setStatus(error);
      return;
    }

    setLoading(true);
    setStatus("Выполняем вход...");
    try {
      const data = await window.authApi.login(username, password);
      if (data?.access_token) {
        localStorage.setItem("utt_token", data.access_token);
      }
      setStatus("Вход выполнен");
    } catch (err) {
      setStatus(`Ошибка входа: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async () => {
    const error = window.authValidation.validateRegister(
      username,
      email,
      password,
      confirmPassword,
    );
    if (error) {
      setStatus(error);
      return;
    }

    setLoading(true);
    setStatus("Регистрируем пользователя...");
    try {
      await window.authApi.register(username, email, password);
      setStatus("Регистрация успешна, теперь нажмите Войти");
    } catch (err) {
      setStatus(`Ошибка регистрации: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Ultimate Tic-Tac-Toe</h1>
        <p>{isRegister ? "Создание нового аккаунта" : "Вход в онлайн-матчи 1v1"}</p>

        <div className="mode-tabs">
          <button
            type="button"
            className={!isRegister ? "tab active-tab" : "tab"}
            onClick={() => {
              window.history.pushState({}, "", "/auth");
              setPath("/auth");
              setStatus("");
            }}
            disabled={loading}
          >
            Вход
          </button>
          <button
            type="button"
            className={isRegister ? "tab active-tab" : "tab"}
            onClick={() => {
              window.history.pushState({}, "", "/register");
              setPath("/register");
              setStatus("");
            }}
            disabled={loading}
          >
            Регистрация
          </button>
        </div>

        {!isRegister ? (
          <window.LoginForm
            username={username}
            password={password}
            onUsernameChange={setUsername}
            onPasswordChange={setPassword}
            onSubmit={onLogin}
            loading={loading}
          />
        ) : (
          <window.RegisterForm
            username={username}
            email={email}
            password={password}
            confirmPassword={confirmPassword}
            onUsernameChange={setUsername}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onConfirmPasswordChange={setConfirmPassword}
            onSubmit={onRegister}
            loading={loading}
          />
        )}

        <p>{status}</p>
      </section>
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<AuthPage />);