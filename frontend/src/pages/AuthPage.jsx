import { useEffect, useState } from "react";
import { LoginForm } from "../features/auth/components/LoginForm";
import { RegisterForm } from "../features/auth/components/RegisterForm";
import { useAuth } from "../features/auth/components/AuthProvider";
import { validateLogin, validateRegister } from "../features/auth/validation/authValidation";

export function AuthPage() {
  const { initializing, isAuthenticated, login, logout, register, user } = useAuth();
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

  const switchMode = (nextPath) => {
    window.history.pushState({}, "", nextPath);
    setPath(nextPath);
    setStatus("");
  };

  const onLogin = async (event) => {
    event.preventDefault();

    const error = validateLogin(username, password);
    if (error) {
      setStatus(error);
      return;
    }

    setLoading(true);
    setStatus("Выполняем вход...");
    try {
      await login(username, password);
      setStatus("Вход выполнен");
    } catch (err) {
      setStatus(`Ошибка входа: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (event) => {
    event.preventDefault();

    const error = validateRegister(username, email, password, confirmPassword);
    if (error) {
      setStatus(error);
      return;
    }

    setLoading(true);
    setStatus("Регистрируем пользователя...");
    try {
      await register(username, email, password);
      switchMode("/auth");
      setStatus("Регистрация успешна, теперь нажмите Войти");
    } catch (err) {
      setStatus(`Ошибка регистрации: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p>Проверяем сессию...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Ultimate Tic-Tac-Toe</h1>
        <p>{isRegister ? "Создание нового аккаунта" : "Вход в онлайн-матчи 1v1"}</p>

        {isAuthenticated ? (
          <div className="session-panel">
            <p>Вы вошли как {user?.username ?? "игрок"}.</p>
            <button type="button" className="secondary" onClick={logout}>
              Выйти
            </button>
          </div>
        ) : (
          <>
            <div className="mode-tabs">
              <button
                type="button"
                className={!isRegister ? "tab active-tab" : "tab"}
                onClick={() => switchMode("/auth")}
                disabled={loading}
              >
                Вход
              </button>
              <button
                type="button"
                className={isRegister ? "tab active-tab" : "tab"}
                onClick={() => switchMode("/register")}
                disabled={loading}
              >
                Регистрация
              </button>
            </div>

            {!isRegister ? (
              <LoginForm
                username={username}
                password={password}
                onUsernameChange={setUsername}
                onPasswordChange={setPassword}
                onSubmit={onLogin}
                loading={loading}
              />
            ) : (
              <RegisterForm
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
          </>
        )}

        {status ? <p>{status}</p> : null}
      </section>
    </main>
  );
}
