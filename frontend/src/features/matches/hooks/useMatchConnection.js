import { useCallback, useEffect, useRef, useState } from "react";
import { createMatchesSocket } from "../socket/matchesSocket";

const initialState = {
  abandonError: "",
  abandonStatus: "idle",
  error: "",
  match: null,
  moveError: "",
  moveStatus: "idle",
  activePlayerIds: [],
  room: "",
  status: "connecting",
  turnDeadline: null,
};

function mergePayloadMatch(currentMatch, payloadMatch) {
  return currentMatch
    ? {
        ...currentMatch,
        ...payloadMatch,
      }
    : payloadMatch;
}

function connectionError(message) {
  return {
    ...initialState,
    error: message,
    status: "error",
  };
}

function registerConnectionHandlers(socket, matchId, setState, didJoinRef) {
  socket.on("connect", () => {
    setState((current) => ({ ...current, error: "", status: "joining" }));
    socket.emit("match:join", { matchId });
  });

  socket.on("connect_error", (err) => {
    setState(
      connectionError(
        err.message || "Не удалось подключиться к серверу матчей",
      ),
    );
  });

  socket.on("error", (payload) => {
    setState(
      connectionError(
        payload?.message || "Сервер отклонил подключение",
      ),
    );
  });

  socket.on("disconnect", () => {
    setState((current) => ({
      ...current,
      status: didJoinRef.current ? "disconnected" : current.status,
    }));
  });
}

function registerErrorHandlers(socket, setState) {
  socket.on("exception", (payload) => {
    setState((current) => ({
      ...current,
      abandonError:
        current.abandonStatus === "leaving"
          ? payload?.message || "Не удалось покинуть матч"
          : current.abandonError,
      abandonStatus:
        current.abandonStatus === "leaving" ? "error" : current.abandonStatus,
      error: current.match
        ? current.error
        : payload?.message || "Не удалось присоединиться к матчу",
      moveError:
        current.moveStatus === "sending"
          ? payload?.message || "Ход отклонен сервером"
          : current.moveError,
      moveStatus: current.moveStatus === "sending" ? "error" : current.moveStatus,
      status: current.match ? current.status : "error",
    }));
  });
}

function registerMatchHandlers(socket, setState, didJoinRef) {
  socket.on("match:joined", (payload) => {
    didJoinRef.current = true;
    setState({
      ...initialState,
      error: "",
      match: payload.match,
      room: payload.room,
      status: "joined",
    });
  });

  socket.on("match:move", (payload) => {
    setState((current) => ({
      ...current,
      error: "",
      match: mergePayloadMatch(current.match, payload.match),
      moveError: "",
      moveStatus: "idle",
    }));
  });

  socket.on("match:turn-timeout", (payload) => {
    setState((current) => ({
      ...current,
      match: mergePayloadMatch(current.match, payload.match),
      moveError: "",
      moveStatus: "idle",
    }));
  });

  socket.on("match:abandoned", (payload) => {
    setState((current) => ({
      ...current,
      abandonError: "",
      abandonStatus: "idle",
      match: mergePayloadMatch(current.match, payload.match),
      moveError: "",
      moveStatus: "idle",
    }));
  });
}

function registerPresenceHandlers(socket, setState) {
  socket.on("match:presence", (payload) => {
    setState((current) => ({
      ...current,
      activePlayerIds: payload?.activePlayerIds ?? [],
    }));
  });

  socket.on("match:turn-deadline", (payload) => {
    setState((current) => ({
      ...current,
      turnDeadline: payload?.deadline ?? null,
    }));
  });
}

function useMatchSocket(matchId, token, socketRef, setState) {
  useEffect(() => {
    if (!matchId || !token) {
      setState(
        connectionError(
          "Нет данных для подключения к матчу",
        ),
      );
      return undefined;
    }

    const socket = createMatchesSocket(token);
    const didJoinRef = { current: false };
    socketRef.current = socket;
    setState(initialState);

    registerConnectionHandlers(socket, matchId, setState, didJoinRef);
    registerErrorHandlers(socket, setState);
    registerMatchHandlers(socket, setState, didJoinRef);
    registerPresenceHandlers(socket, setState);
    socket.connect();

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, [matchId, setState, socketRef, token]);
}

function useMoveSender(matchId, socketRef, setState) {
  return useCallback(
    (localBoard, localCell) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        setState((current) => ({
          ...current,
          moveError: "Нет подключения к матчу",
          moveStatus: "error",
        }));
        return;
      }

      setState((current) => ({ ...current, moveError: "", moveStatus: "sending" }));
      const clientMoveId =
        window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
      socket.emit(
        "match:move",
        { matchId, localBoard, localCell, clientMoveId },
        (ack) => {
          if (ack?.ok) {
            return;
          }

          setState((current) => ({
            ...current,
            moveError: ack?.message || "Сервер не подтвердил ход",
            moveStatus: "error",
          }));
        },
      );
    },
    [matchId, setState, socketRef],
  );
}

function useMatchAbandoner(matchId, socketRef, setState) {
  return useCallback(
    (onSuccess) => {
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
    },
    [matchId, setState, socketRef],
  );
}

export function useMatchConnection(matchId, token) {
  const socketRef = useRef(null);
  const [state, setState] = useState(initialState);
  useMatchSocket(matchId, token, socketRef, setState);

  return {
    ...state,
    abandonMatch: useMatchAbandoner(matchId, socketRef, setState),
    sendMove: useMoveSender(matchId, socketRef, setState),
  };
}
