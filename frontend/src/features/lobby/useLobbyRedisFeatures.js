import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createMatchesSocket } from "../matches/socket/matchesSocket";
import {
  acceptInvite,
  createInvite,
  declineInvite,
  getInvites,
  getLeaderboard,
} from "./redisFeaturesApi";

export function useLobbyRedisFeatures(token) {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [invites, setInvites] = useState([]);
  const [inviteUsername, setInviteUsername] = useState("");
  const [sentInvite, setSentInvite] = useState(null);
  const [error, setError] = useState("");
  const sentInviteId = sentInvite?.id;

  const refresh = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const leaderboardData = await getLeaderboard(token);
      setLeaderboard(leaderboardData.players ?? []);
    } catch {
      setLeaderboard([]);
    }

    try {
      const invitesData = await getInvites(token);
      setInvites(invitesData.invites ?? []);
      if (invitesData.acceptedMatch?.matchId) {
        navigate(`/game/${invitesData.acceptedMatch.matchId}`);
      }
      if (
        invitesData.declinedInvite?.inviteId &&
        invitesData.declinedInvite.inviteId === sentInviteId
      ) {
        setSentInvite((current) =>
          current
            ? {
                ...current,
                status: "declined",
              }
            : current,
        );
      }
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [navigate, sentInviteId, token]);

  useEffect(() => {
    void refresh();
    const intervalId = window.setInterval(refresh, 30000);
    return () => window.clearInterval(intervalId);
  }, [refresh]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const socket = createMatchesSocket(token);

    socket.on("invite:received", (payload) => {
      if (!payload?.invite) {
        return;
      }

      setInvites((current) => {
        if (current.some((invite) => invite.id === payload.invite.id)) {
          return current;
        }

        return [payload.invite, ...current];
      });
    });

    socket.on("invite:accepted", (payload) => {
      if (!payload?.matchId) {
        return;
      }

      navigate(`/game/${payload.matchId}`);
    });

    socket.on("invite:declined", (payload) => {
      if (!payload?.inviteId || payload.inviteId !== sentInviteId) {
        return;
      }

      setSentInvite((current) =>
        current
          ? {
              ...current,
              status: "declined",
            }
          : current,
      );
    });

    socket.on("invite:canceled", (payload) => {
      if (!payload?.inviteId) {
        return;
      }

      setInvites((current) =>
        current.filter((invite) => invite.id !== payload.inviteId),
      );
    });

    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, [navigate, sentInviteId, token]);

  useEffect(() => {
    if (sentInvite?.status !== "declined") {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setSentInvite(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [sentInvite?.status]);

  const sendInvite = useCallback(async () => {
    if (!inviteUsername.trim()) {
      return;
    }

    try {
      const username = inviteUsername.trim();
      const invite = await createInvite(token, username);
      setSentInvite({
        id: invite.id,
        status: "pending",
        username,
      });
      setInviteUsername("");
      setError("");
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }, [inviteUsername, refresh, token]);

  const cancelSentInvite = useCallback(async () => {
    if (!sentInviteId) {
      return;
    }

    try {
      await declineInvite(token, sentInviteId);
      setSentInvite(null);
      setError("");
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }, [refresh, sentInviteId, token]);

  const accept = useCallback(
    async (inviteId) => {
      try {
        const data = await acceptInvite(token, inviteId);
        navigate(`/game/${data.match.id}`);
      } catch (err) {
        setError(err.message);
      }
    },
    [navigate, token],
  );

  const decline = useCallback(
    async (inviteId) => {
      try {
        await declineInvite(token, inviteId);
        await refresh();
      } catch (err) {
        setError(err.message);
      }
    },
    [refresh, token],
  );

  return {
    accept,
    cancelSentInvite,
    decline,
    error,
    inviteUsername,
    invites,
    leaderboard,
    sendInvite,
    setInviteUsername,
    setSentInvite,
    sentInvite,
  };
}
