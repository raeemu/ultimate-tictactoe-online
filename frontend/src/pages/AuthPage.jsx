import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LoginForm } from "../features/auth/components/LoginForm";
import { RegisterForm } from "../features/auth/components/RegisterForm";
import { useAuth } from "../features/auth/components/AuthProvider";
import { validateLogin, validateRegister } from "../features/auth/validation/authValidation";

export function AuthPage({ mode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState(() =>
    location.state?.registered ? "Регистрация успешна, теперь нажмите Войти" : "",
  );
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  const switchMode = (nextPath) => {
    navigate(nextPath);
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
      navigate("/lobby", { replace: true });
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
      navigate("/auth", { replace: true, state: { registered: true } });
    } catch (err) {
      setStatus(`Ошибка регистрации: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="center-page auth-page">
      <section className="card auth-card">
        <h1>Ultimate Tic-Tac-Toe</h1>
        <p>{isRegister ? "Создание нового аккаунта" : "Вход в онлайн-матчи 1v1"}</p>

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

        {status ? <p>{status}</p> : null}
      </section>
    </main>
  );
}
