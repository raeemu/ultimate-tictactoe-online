import { apiRequest } from "../../../shared/apiClient";

export function getMyProfile(token, { offset } = {}) {
  const params = new URLSearchParams();
  if (Number.isInteger(offset) && offset > 0) {
    params.set("offset", String(offset));
  }

  const query = params.toString();

  return apiRequest(`/profile/me${query ? `?${query}` : ""}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
