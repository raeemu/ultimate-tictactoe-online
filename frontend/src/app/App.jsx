import { AuthProvider } from "../features/auth/components/AuthProvider";
import { AuthPage } from "../pages/AuthPage";

export function App() {
  return (
    <AuthProvider>
      <AuthPage />
    </AuthProvider>
  );
}
