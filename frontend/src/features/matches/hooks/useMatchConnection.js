import { useCallback, useEffect, useRef, useState } from "react";
import { createMatchesSocket } from "../socket/matchesSocket";

const initialState = {
  abandonError: "",
  abandonStatus: "idle",
  error: "",
  match: null,
  moveError: "",
  moveStatus: "idle",
  room: "",
  status: "connecting",
};

export function useMatchConnection(matchId, token) {
  const socketRef = useRef(null);
  const [state, setState] = useState(initialState);

  useEffect(() => {
    if (!matchId || !token) {
      setState({
        ...initialState,
        error: "Нет данных для подключения к матчу",
        status: "error",
      });
      return undefined;
    }

    const socket = createMatchesSocket(token);
    socketRef.current = socket;
    let didJoin = false;

    setState(initialState);

    socket.on("connect", () => {
      setState((current) => ({ ...current, error: "", status: "joining" }));
      socket.emit("match:join", { matchId });
    });

    socket.on("connect_error", (err) => {
      setState({
        ...initialState,
        error: err.message || "Не удалось подключиться к серверу матчей",
        status: "error",
      });
    });

    socket.on("error", (payload) => {
      setState({
        ...initialState,
        error: payload?.message || "Сервер отклонил подключение",
        status: "error",
      });
    });

    socket.on("exception", (payload) => {
      setState((current) => ({
        ...current,
        abandonError: current.abandonStatus === "leaving" ? payload?.message || "Не удалось покинуть матч" : current.abandonError,
        abandonStatus: current.abandonStatus === "leaving" ? "error" : current.abandonStatus,
        error: current.match ? current.error : payload?.message || "Не удалось присоединиться к матчу",
        moveError: current.moveStatus === "sending" ? payload?.message || "Ход отклонен сервером" : current.moveError,
        moveStatus: current.moveStatus === "sending" ? "error" : current.moveStatus,
        status: current.match ? current.status : "error",
      }));
    });

    socket.on("match:joined", (payload) => {
      didJoin = true;
      setState({
        abandonError: "",
        abandonStatus: "idle",
        error: "",
        match: payload.match,
        moveError: "",
        moveStatus: "idle",
        room: payload.room,
        status: "joined",
      });
    });

    socket.on("match:move", (payload) => {
      setState((current) => ({
        ...current,
        error: "",
        match: current.match
          ? {
              ...current.match,
              ...payload.match,
            }
          : payload.match,
        moveError: "",
        moveStatus: "idle",
      }));
    });

    socket.on("match:abandoned", (payload) => {
      setState((current) => ({
        ...current,
        abandonError: "",
        abandonStatus: "idle",
        match: current.match
          ? {
              ...current.match,
              ...payload.match,
            }
          : payload.match,
        moveError: "",
        moveStatus: "idle",
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
      socketRef.current = null;
      socket.disconnect();
    };
  }, [matchId, token]);

  const sendMove = useCallback((localBoard, localCell) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      setState((current) => ({
        ...current,
        moveError: "Нет подключения к матчу",
        moveStatus: "error",
      }));
      return;
    }

    setState((current) => ({
      ...current,
      moveError: "",
      moveStatus: "sending",
    }));

    socket.emit("match:move", { matchId, localBoard, localCell }, (ack) => {
      if (ack?.ok) {
        return;
      }

      setState((current) => ({
        ...current,
        moveError: ack?.message || "Сервер не подтвердил ход",
        moveStatus: "error",
      }));
    });
  }, [matchId]);

  const abandonMatch = useCallback((onSuccess) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      setState((current) => ({
        ...current,
        abandonError: "Нет подключения к матчу",
        abandonStatus: "error",
      }));
      return;
    }

    setState((current) => ({
      ...current,
      abandonError: "",
      abandonStatus: "leaving",
    }));

    socket.emit("match:abandon", { matchId }, (ack) => {
      if (ack?.ok) {
        onSuccess?.();
        return;
      }

      setState((current) => ({
        ...current,
        abandonError: ack?.message || "Не удалось покинуть матч",
        abandonStatus: "error",
      }));
    });
  }, [matchId]);

  return {
    ...state,
    abandonMatch,
    sendMove,
  };
}
