import { io } from "socket.io-client";

const SOCKET_BASE_URL = import.meta.env.VITE_SOCKET_URL ?? (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);

export function createMatchesSocket(token) {
  return io(`${SOCKET_BASE_URL}/matches`, {
    auth: { token },
    autoConnect: false,
    transports: ["websocket", "polling"],
  });
}