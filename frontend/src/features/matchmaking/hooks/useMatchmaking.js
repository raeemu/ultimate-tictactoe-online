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
    return { ...idleResponseState(data.status), status: "searching" };
  }

  return idleResponseState(data.status);
}

function errorState(message) {
  return {
    error: message,
    lastResponseStatus: "",
    match: null,
    acceptStatus: "idle",
    shouldAutoOpenMatch: false,
    status: "error",
  };
}

function idleResponseState(lastResponseStatus) {
  return {
    error: "",
    lastResponseStatus,
    match: null,
    acceptStatus: "idle",
    shouldAutoOpenMatch: false,
    status: "idle",
  };
}

function shouldPollQueue(state) {
  return (
    state.status === "searching" ||
    (state.status === "matched" && state.match?.status === "WAITING")
  );
}

function preserveFoundStatus(current, next) {
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
}

function useQueueStatus(token, state, setState) {
  const refreshStatus = useCallback(async () => {
    if (!token) {
      setState(initialState);
      return;
    }

    try {
      const data = await getQueueStatus(token);
      setState(mapQueueResponse(data));
    } catch (err) {
      setState(errorState(err.message));
    }
  }, [setState, token]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!token || !shouldPollQueue(state)) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const data = await getQueueStatus(token);
        setState((current) =>
          shouldPollQueue(current)
            ? preserveFoundStatus(current, mapQueueResponse(data))
            : current,
        );
      } catch (err) {
        setState(errorState(err.message));
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [setState, state, token]);

  return refreshStatus;
}

function useQueueActions(token, setState) {
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
      setState(errorState(err.message));
    }
  }, [setState, token]);

  const cancelSearch = useCallback(async () => {
    if (!token) {
      setState({ ...initialState, error: "Нет активной сессии" });
      return;
    }

    setState((current) => ({ ...current, error: "", status: "leaving" }));

    try {
      const data = await leaveQueue(token);
      setState(idleResponseState(data.status));
    } catch (err) {
      setState((current) => ({
        ...current,
        error: err.message,
        status: "error",
      }));
    }
  }, [setState, token]);

  return { cancelSearch, startSearch };
}

function useCurrentMatchActions(token, matchId, setState) {
  const leaveCurrentMatch = useCallback(async () => {
    if (!token || !matchId) {
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

    setState((current) => ({ ...current, error: "", status: "leaving" }));

    try {
      await abandonMatch(token, matchId);
      setState(idleResponseState("MATCH_ABANDONED"));
    } catch (err) {
      setState((current) => ({
        ...current,
        error: err.message,
        status: "matched",
      }));
    }
  }, [matchId, setState, token]);

  const acceptCurrentMatch = useCallback(async () => {
    if (!token || !matchId) {
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
      const match = await acceptMatch(token, matchId);
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
  }, [matchId, setState, token]);

  return { acceptCurrentMatch, leaveCurrentMatch };
}

export function useMatchmaking(token) {
  const [state, setState] = useState(initialState);
  const refreshStatus = useQueueStatus(token, state, setState);
  const { cancelSearch, startSearch } = useQueueActions(token, setState);
  const { acceptCurrentMatch, leaveCurrentMatch } = useCurrentMatchActions(
    token,
    state.match?.id,
    setState,
  );

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
