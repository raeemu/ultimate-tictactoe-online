window.authApi = {
  async parseError(res) {
    try {
      const data = await res.json();
      const msg = data?.message ?? `HTTP ${res.status}`;
      return Array.isArray(msg) ? msg.join(", ") : msg;
    } catch (_e) {
      return `HTTP ${res.status}`;
    }
  },

  async login(username, password) {
    const res = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), password }),
    });

    if (!res.ok) {
      throw new Error(await this.parseError(res));
    }

    return res.json();
  },

  async register(username, email, password) {
    const res = await fetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.trim(),
        email: email.trim(),
        password,
      }),
    });

    if (!res.ok) {
      throw new Error(await this.parseError(res));
    }

    return res.json();
  },
};
