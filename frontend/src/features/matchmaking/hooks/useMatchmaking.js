import { useCallback, useMemo, useState } from "react";
import { joinQueue, leaveQueue } from "../api/matchmakingApi";

const initialState = {
  error: "",
  lastResponseStatus: "",
  match: null,
  status: "idle",
};

export function useMatchmaking(token) {
  const [state, setState] = useState(initialState);

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

      if (data.status === "MATCH_FOUND") {
        setState({
          error: "",
          lastResponseStatus: data.status,
          match: data.match,
          status: "matched",
        });
        return;
      }

      setState({
        error: "",
        lastResponseStatus: data.status,
        match: null,
        status: "searching",
      });
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
