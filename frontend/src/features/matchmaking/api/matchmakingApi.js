import { apiRequest } from "../../../shared/apiClient";

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export function joinQueue(token) {
  return apiRequest("/matchmaking/queue", {
    method: "POST",
    headers: authHeaders(token),
  });
}

export function leaveQueue(token) {
  return apiRequest("/matchmaking/queue", {
    method: "DELETE",
    headers: authHeaders(token),
  });
}
