import { useEffect, useState } from "react";
import { getMyProfile } from "../api/profileApi";

const initialState = {
  data: null,
  error: "",
  loading: true,
  loadingMore: false,
};

export function useProfile(token) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!token) {
        setState({
          data: null,
          error: "Нет активной сессии",
          loading: false,
          loadingMore: false,
        });
        return;
      }

      setState(initialState);

      try {
        const data = await getMyProfile(token);
        if (!cancelled) {
          setState({ data, error: "", loading: false, loadingMore: false });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            data: null,
            error: err.message,
            loading: false,
            loadingMore: false,
          });
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function loadMore() {
    if (!token || state.loadingMore || !state.data?.history?.hasMore) {
      return;
    }

    setState((current) => ({ ...current, error: "", loadingMore: true }));

    try {
      const nextData = await getMyProfile(token, {
        offset: state.data.history.nextOffset,
      });

      setState((current) => {
        if (!current.data) {
          return { data: nextData, error: "", loading: false, loadingMore: false };
        }

        return {
          data: {
            ...nextData,
            recentMatches: [
              ...current.data.recentMatches,
              ...nextData.recentMatches,
            ],
          },
          error: "",
          loading: false,
          loadingMore: false,
        };
      });
    } catch (err) {
      setState((current) => ({
        ...current,
        error: err.message,
        loadingMore: false,
      }));
    }
  }

  return {
    ...state,
    loadMore,
  };
}
