import { apiRequest } from "../../../shared/apiClient";

export function login(username, password) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: username.trim(), password }),
  });
}

export function register(username, email, password) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      username: username.trim(),
      email: email.trim(),
      password,
    }),
  });
}

export function getCurrentUser(token) {
  return apiRequest("/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
