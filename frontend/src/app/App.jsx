import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "../features/auth/components/AuthProvider";
import { AuthPage } from "../pages/AuthPage";
import { LobbyPage } from "../pages/LobbyPage";
import { GamePage } from "../pages/GamePage";
import { ProfilePage } from "../pages/ProfilePage";
import { RulesPage } from "../pages/RulesPage";
import { LoadingScreen } from "../shared/ui/LoadingScreen";

function AppRoutes() {
  const { initializing, isAuthenticated } = useAuth();

  if (initializing) {
    return <LoadingScreen message="Проверяем сессию..." />;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAuthenticated ? "/lobby" : "/auth"} replace />} />
      <Route path="/auth" element={isAuthenticated ? <Navigate to="/lobby" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/lobby" replace /> : <AuthPage mode="register" />} />
      <Route path="/lobby" element={isAuthenticated ? <LobbyPage /> : <Navigate to="/auth" replace />} />
      <Route path="/profile" element={isAuthenticated ? <ProfilePage /> : <Navigate to="/auth" replace />} />
      <Route path="/rules" element={<RulesPage />} />
      <Route path="/game/:matchId" element={isAuthenticated ? <GamePage /> : <Navigate to="/auth" replace />} />
      <Route path="*" element={<Navigate to={isAuthenticated ? "/lobby" : "/auth"} replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
