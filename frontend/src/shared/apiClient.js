const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  if (res.status === 204) {
    return null;
  }

  return res.json();
}

async function parseError(res) {
  try {
    const data = await res.json();
    const msg = data?.message ?? `HTTP ${res.status}`;
    return Array.isArray(msg) ? msg.join(", ") : msg;
  } catch (_e) {
    return `HTTP ${res.status}`;
  }
}
