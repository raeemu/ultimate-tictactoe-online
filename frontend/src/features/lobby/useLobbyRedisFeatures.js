import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createMatchesSocket } from "../matches/socket/matchesSocket";
import {
  acceptInvite,
  createInvite,
  declineInvite,
  getInvites,
  getLeaderboard,
} from "./redisFeaturesApi";

function markSentInviteDeclined(setSentInvite) {
  setSentInvite((current) =>
    current
      ? {
          ...current,
          status: "declined",
        }
      : current,
  );
}

function useLobbyRefresh(token, sentInviteId, setState) {
  const navigate = useNavigate();

  return useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const leaderboardData = await getLeaderboard(token);
      setState.setLeaderboard(leaderboardData.players ?? []);
    } catch {
      setState.setLeaderboard([]);
    }

    try {
      const invitesData = await getInvites(token);
      setState.setInvites(invitesData.invites ?? []);
      if (invitesData.acceptedMatch?.matchId) {
        navigate(`/game/${invitesData.acceptedMatch.matchId}`);
      }
      if (invitesData.declinedInvite?.inviteId === sentInviteId) {
        markSentInviteDeclined(setState.setSentInvite);
      }
      setState.setError("");
    } catch (err) {
      setState.setError(err.message);
    }
  }, [navigate, sentInviteId, setState, token]);
}

function useLobbyPolling(refresh) {
  useEffect(() => {
    void refresh();
    const intervalId = window.setInterval(refresh, 30000);
    return () => window.clearInterval(intervalId);
  }, [refresh]);
}

function useInviteSocket(token, sentInviteId, setState) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const socket = createMatchesSocket(token);
    socket.on("invite:received", (payload) => {
      if (!payload?.invite) {
        return;
      }

      setState.setInvites((current) =>
        current.some((invite) => invite.id === payload.invite.id)
          ? current
          : [payload.invite, ...current],
      );
    });

    socket.on("invite:accepted", (payload) => {
      if (payload?.matchId) {
        navigate(`/game/${payload.matchId}`);
      }
    });

    socket.on("invite:declined", (payload) => {
      if (payload?.inviteId === sentInviteId) {
        markSentInviteDeclined(setState.setSentInvite);
      }
    });

    socket.on("invite:canceled", (payload) => {
      if (payload?.inviteId) {
        setState.setInvites((current) =>
          current.filter((invite) => invite.id !== payload.inviteId),
        );
      }
    });

    socket.connect();
    return () => socket.disconnect();
  }, [navigate, sentInviteId, setState, token]);
}

function useDeclinedInviteCleanup(sentInvite, setSentInvite) {
  useEffect(() => {
    if (sentInvite?.status !== "declined") {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setSentInvite(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [sentInvite?.status, setSentInvite]);
}

function useInviteActions(token, inviteUsername, refresh, setters, sentInviteId) {
  const navigate = useNavigate();

  const sendInvite = useCallback(async () => {
    if (!inviteUsername.trim()) {
      return;
    }

    try {
      const username = inviteUsername.trim();
      const invite = await createInvite(token, username);
      setters.setSentInvite({ id: invite.id, status: "pending", username });
      setters.setInviteUsername("");
      setters.setError("");
      await refresh();
    } catch (err) {
      setters.setError(err.message);
    }
  }, [inviteUsername, refresh, setters, token]);

  const cancelSentInvite = useCallback(async () => {
    if (!sentInviteId) {
      return;
    }

    try {
      await declineInvite(token, sentInviteId);
      setters.setSentInvite(null);
      setters.setError("");
      await refresh();
    } catch (err) {
      setters.setError(err.message);
    }
  }, [refresh, sentInviteId, setters, token]);

  const accept = useCallback(
    async (inviteId) => {
      try {
        const data = await acceptInvite(token, inviteId);
        navigate(`/game/${data.match.id}`);
      } catch (err) {
        setters.setError(err.message);
      }
    },
    [navigate, setters, token],
  );

  const decline = useCallback(
    async (inviteId) => {
      try {
        await declineInvite(token, inviteId);
        await refresh();
      } catch (err) {
        setters.setError(err.message);
      }
    },
    [refresh, setters, token],
  );

  return { accept, cancelSentInvite, decline, sendInvite };
}

export function useLobbyRedisFeatures(token) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [invites, setInvites] = useState([]);
  const [inviteUsername, setInviteUsername] = useState("");
  const [sentInvite, setSentInvite] = useState(null);
  const [error, setError] = useState("");
  const sentInviteId = sentInvite?.id;
  const setters = useMemo(
    () => ({
      setError,
      setInvites,
      setInviteUsername,
      setLeaderboard,
      setSentInvite,
    }),
    [],
  );

  const refresh = useLobbyRefresh(token, sentInviteId, setters);
  useLobbyPolling(refresh);
  useInviteSocket(token, sentInviteId, setters);
  useDeclinedInviteCleanup(sentInvite, setSentInvite);
  const actions = useInviteActions(
    token,
    inviteUsername,
    refresh,
    setters,
    sentInviteId,
  );

  return {
    ...actions,
    error,
    inviteUsername,
    invites,
    leaderboard,
    setInviteUsername,
    setSentInvite,
    sentInvite,
  };
}
