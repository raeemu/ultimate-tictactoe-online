import { useEffect, useState } from "react";
import { createMatchesSocket } from "../socket/matchesSocket";

const initialState = {
  error: "",
  match: null,
  room: "",
  status: "connecting",
};

export function useMatchConnection(matchId, token) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    if (!matchId || !token) {
      setState({
        error: "Нет данных для подключения к матчу",
        match: null,
        room: "",
        status: "error",
      });
      return;
    }

    const socket = createMatchesSocket(token);
    let didJoin = false;

    setState(initialState);

    socket.on("connect", () => {
      setState((current) => ({ ...current, error: "", status: "joining" }));
      socket.emit("match:join", { matchId });
    });

    socket.on("connect_error", (err) => {
      setState({
        error: err.message || "Не удалось подключиться к серверу матчей",
        match: null,
        room: "",
        status: "error",
      });
    });

    socket.on("error", (payload) => {
      setState({
        error: payload?.message || "Сервер отклонил подключение",
        match: null,
        room: "",
        status: "error",
      });
    });

    socket.on("exception", (payload) => {
      setState({
        error: payload?.message || "Не удалось присоединиться к матчу",
        match: null,
        room: "",
        status: "error",
      });
    });

    socket.on("match:joined", (payload) => {
      didJoin = true;
      setState({
        error: "",
        match: payload.match,
        room: payload.room,
        status: "joined",
      });
    });

    socket.on("match:move", (payload) => {
      setState((current) => ({
        ...current,
        match: current.match
          ? {
              ...current.match,
              ...payload.match,
            }
          : current.match,
      }));
    });

    socket.on("disconnect", () => {
      setState((current) => ({
        ...current,
        status: didJoin ? "disconnected" : current.status,
      }));
    });

    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, [matchId, token]);

  return state;
}
