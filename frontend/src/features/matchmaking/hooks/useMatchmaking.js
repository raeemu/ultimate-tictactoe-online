import { useCallback, useEffect, useMemo, useState } from "react";
import {
  abandonMatch,
  getQueueStatus,
  joinQueue,
  leaveQueue,
} from "../api/matchmakingApi";

const POLL_INTERVAL_MS = 2000;

const initialState = {
  error: "",
  lastResponseStatus: "",
  match: null,
  status: "idle",
};

function mapQueueResponse(data) {
  if (data.status === "MATCH_FOUND" || data.status === "ACTIVE_MATCH") {
    return {
      error: "",
      lastResponseStatus: data.status,
      match: data.match,
      status: "matched",
    };
  }

  if (data.status === "SEARCHING") {
    return {
      error: "",
      lastResponseStatus: data.status,
      match: null,
      status: "searching",
    };
  }

  return {
    error: "",
    lastResponseStatus: data.status,
    match: null,
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
        status: "error",
      });
    }
  }, [token]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!token || state.status !== "searching") {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const data = await getQueueStatus(token);
        setState((current) => {
          if (current.status !== "searching") {
            return current;
          }

          return mapQueueResponse(data);
        });
      } catch (err) {
        setState({
          error: err.message,
          lastResponseStatus: "",
          match: null,
          status: "error",
        });
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [state.status, token]);

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

  return useMemo(
    () => ({
      ...state,
      cancelSearch,
      isBusy: state.status === "joining" || state.status === "leaving",
      isSearching: state.status === "searching" || state.status === "joining",
      leaveCurrentMatch,
      refreshStatus,
      startSearch,
    }),
    [cancelSearch, leaveCurrentMatch, refreshStatus, startSearch, state],
  );
}
