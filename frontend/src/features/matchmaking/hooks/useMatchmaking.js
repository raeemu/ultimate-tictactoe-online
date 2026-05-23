import { useCallback, useEffect, useMemo, useState } from "react";
import { getQueueStatus, joinQueue, leaveQueue } from "../api/matchmakingApi";

const POLL_INTERVAL_MS = 2000;

const initialState = {
  error: "",
  lastResponseStatus: "",
  match: null,
  status: "idle",
};

function mapQueueResponse(data) {
  if (data.status === "MATCH_FOUND") {
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

  return useMemo(
    () => ({
      ...state,
      cancelSearch,
      isBusy: state.status === "joining" || state.status === "leaving",
      isSearching: state.status === "searching" || state.status === "joining",
      startSearch,
    }),
    [cancelSearch, startSearch, state],
  );
}
