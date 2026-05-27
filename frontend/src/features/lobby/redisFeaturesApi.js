import { apiRequest } from "../../shared/apiClient";

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export function getLeaderboard(token) {
  return apiRequest("/leaderboard", {
    method: "GET",
    headers: authHeaders(token),
  });
}

export function getInvites(token) {
  return apiRequest("/invites", {
    method: "GET",
    headers: authHeaders(token),
  });
}

export function createInvite(token, username) {
  return apiRequest("/invites", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ username }),
  });
}

export function acceptInvite(token, inviteId) {
  return apiRequest(`/invites/${inviteId}/accept`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export function declineInvite(token, inviteId) {
  return apiRequest(`/invites/${inviteId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}
