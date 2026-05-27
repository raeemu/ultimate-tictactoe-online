import { useCallback, useEffect, useMemo, useState } from "react";
import {
  abandonMatch,
  acceptMatch,
  getQueueStatus,
  joinQueue,
  leaveQueue,
} from "../api/matchmakingApi";

const POLL_INTERVAL_MS = 2000;

const initialState = {
  error: "",
  lastResponseStatus: "",
  match: null,
  acceptStatus: "idle",
  shouldAutoOpenMatch: false,
  status: "idle",
};

function mapQueueResponse(data) {
  if (data.status === "MATCH_FOUND" || data.status === "ACTIVE_MATCH") {
    return {
      error: "",
      lastResponseStatus: data.status,
      match: data.match,
      acceptStatus: "idle",
      shouldAutoOpenMatch: false,
      status: "matched",
    };
  }

  if (data.status === "SEARCHING") {
    return {
      error: "",
      lastResponseStatus: data.status,
      match: null,
      acceptStatus: "idle",
      shouldAutoOpenMatch: false,
      status: "searching",
    };
  }

  return {
    error: "",
    lastResponseStatus: data.status,
    match: null,
    acceptStatus: "idle",
    shouldAutoOpenMatch: false,
    status: "idle",
  };
}

export function useMatchmaking(token) {
  const [state, setState] = useState(initialState);

  const refreshStatus = useCallback(async () => {
    if (!token) {
      setState(initialState);
      return;
    }

    try {
      const data = await getQueueStatus(token);
      setState(mapQueueResponse(data));
    } catch (err) {
      setState({
        error: err.message,
        lastResponseStatus: "",
        match: null,
        acceptStatus: "idle",
        shouldAutoOpenMatch: false,
        status: "error",
      });
    }
  }, [token]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const shouldPoll =
      state.status === "searching" ||
      (state.status === "matched" && state.match?.status === "WAITING");

    if (!token || !shouldPoll) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const data = await getQueueStatus(token);
        setState((current) => {
          const shouldUpdate =
            current.status === "searching" ||
            (current.status === "matched" && current.match?.status === "WAITING");

          if (!shouldUpdate) {
            return current;
          }

          const next = mapQueueResponse(data);
          if (
            current.match?.id === next.match?.id &&
            current.lastResponseStatus === "MATCH_FOUND" &&
            next.lastResponseStatus === "ACTIVE_MATCH"
          ) {
            return {
              ...next,
              lastResponseStatus: "MATCH_FOUND",
              shouldAutoOpenMatch: current.acceptStatus === "waiting",
            };
          }

          return next;
        });
      } catch (err) {
        setState({
          error: err.message,
          lastResponseStatus: "",
          match: null,
          acceptStatus: "idle",
          shouldAutoOpenMatch: false,
          status: "error",
        });
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [state.match?.status, state.status, token]);

  const startSearch = useCallback(async () => {
    if (!token) {
      setState({ ...initialState, error: "Нет активной сессии" });
      return;
    }

    setState((current) => ({
      ...current,
      error: "",
      lastResponseStatus: "",
      status: "joining",
    }));

    try {
      const data = await joinQueue(token);
      setState(mapQueueResponse(data));
    } catch (err) {
      setState({
        error: err.message,
        lastResponseStatus: "",
        match: null,
        acceptStatus: "idle",
        shouldAutoOpenMatch: false,
        status: "error",
      });
    }
  }, [token]);

  const cancelSearch = useCallback(async () => {
    if (!token) {
      setState({ ...initialState, error: "Нет активной сессии" });
      return;
    }

    setState((current) => ({
      ...current,
      error: "",
      status: "leaving",
    }));

    try {
      const data = await leaveQueue(token);
      setState({
        error: "",
        lastResponseStatus: data.status,
        match: null,
        acceptStatus: "idle",
        shouldAutoOpenMatch: false,
        status: "idle",
      });
    } catch (err) {
      setState((current) => ({
        ...current,
        error: err.message,
        status: "error",
      }));
    }
  }, [token]);

  const leaveCurrentMatch = useCallback(async () => {
    if (!token || !state.match?.id) {
      setState((current) => ({
        ...current,
        error: "Нет активного матча",
      }));
      return;
    }

    const confirmed = window.confirm(
      "Покинуть текущий матч? Это будет засчитано как поражение.",
    );
    if (!confirmed) {
      return;
    }

    setState((current) => ({
      ...current,
      error: "",
      status: "leaving",
    }));

    try {
      await abandonMatch(token, state.match.id);
      setState({
        error: "",
        lastResponseStatus: "MATCH_ABANDONED",
        match: null,
        acceptStatus: "idle",
        shouldAutoOpenMatch: false,
        status: "idle",
      });
    } catch (err) {
      setState((current) => ({
        ...current,
        error: err.message,
        status: "matched",
      }));
    }
  }, [state.match?.id, token]);

  const acceptCurrentMatch = useCallback(async () => {
    if (!token || !state.match?.id) {
      setState((current) => ({
        ...current,
        error: "Нет найденного матча",
      }));
      return;
    }

    setState((current) => ({
      ...current,
      acceptStatus: "accepting",
      error: "",
    }));

    try {
      const match = await acceptMatch(token, state.match.id);
      setState((current) => ({
        ...current,
        acceptStatus: match.status === "ACTIVE" ? "accepted" : "waiting",
        error: "",
        lastResponseStatus:
          current.lastResponseStatus === "ACTIVE_MATCH"
            ? "MATCH_FOUND"
            : current.lastResponseStatus,
        match,
        shouldAutoOpenMatch: match.status === "ACTIVE",
        status: "matched",
      }));
    } catch (err) {
      setState((current) => ({
        ...current,
        acceptStatus: "error",
        error: err.message,
      }));
    }
  }, [state.match?.id, token]);

  return useMemo(
    () => ({
      ...state,
      acceptCurrentMatch,
      cancelSearch,
      isBusy:
        state.status === "joining" ||
        state.status === "leaving" ||
        state.acceptStatus === "accepting",
      isSearching: state.status === "searching" || state.status === "joining",
      leaveCurrentMatch,
      refreshStatus,
      clearAutoOpenMatch: () => {
        setState((current) => ({
          ...current,
          shouldAutoOpenMatch: false,
        }));
      },
      startSearch,
    }),
    [
      acceptCurrentMatch,
      cancelSearch,
      leaveCurrentMatch,
      refreshStatus,
      startSearch,
      state,
    ],
  );
}
