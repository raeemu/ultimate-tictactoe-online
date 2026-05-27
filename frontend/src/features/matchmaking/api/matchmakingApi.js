import { apiRequest } from "../../../shared/apiClient";

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export function getQueueStatus(token) {
  return apiRequest("/matchmaking/queue", {
    method: "GET",
    headers: authHeaders(token),
  });
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

export function abandonMatch(token, matchId) {
  return apiRequest(`/matches/${matchId}/abandon`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export function acceptMatch(token, matchId) {
  return apiRequest(`/matches/${matchId}/accept`, {
    method: "POST",
    headers: authHeaders(token),
  });
}
