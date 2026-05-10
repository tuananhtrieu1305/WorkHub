import { App } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createMeeting as createMeetingApi,
  endMeeting,
  heartbeatMeeting,
  joinMeeting as joinMeetingApi,
  leaveMeeting,
  markMeetingJoined,
} from "../../services/meetingService";
import { initRealtimeKitClient } from "../../services/realtimeKitClient";
import MeetingDock from "./MeetingDock";
import { MeetingContext } from "./meetingContextValue";

const getMeetingId = (meeting) => meeting?.id || meeting?._id || null;

const addRoomLeftListener = (meetingClient, handler) => {
  const target = meetingClient?.self || meetingClient;
  if (!target?.on) return () => {};

  target.on("roomLeft", handler);
  return () => {
    if (target.off) {
      target.off("roomLeft", handler);
      return;
    }
    target.removeListener?.("roomLeft", handler);
  };
};

export const MeetingProvider = ({ children }) => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [meeting, setMeeting] = useState(null);
  const [participantToken, setParticipantToken] = useState(null);
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [meetingClient, setMeetingClient] = useState(null);
  const [meetingJoinError, setMeetingJoinError] = useState("");
  const [isJoiningMeeting, setJoiningMeeting] = useState(false);
  const [isEndingMeeting, setEndingMeeting] = useState(false);
  const activeMeetingRef = useRef(null);
  const meetingClientRef = useRef(null);
  const locationRef = useRef(location);
  const hasJoinedRoomRef = useRef(false);
  const hasReportedLeaveRef = useRef(false);
  const joinPromiseRef = useRef(null);
  const removeRoomLeftListenerRef = useRef(null);
  const isLeavingMeetingRef = useRef(false);

  useEffect(() => {
    activeMeetingRef.current = activeMeeting;
  }, [activeMeeting]);

  useEffect(() => {
    meetingClientRef.current = meetingClient;
  }, [meetingClient]);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  const reportMeetingLeave = useCallback(async (meetingOverride = null) => {
    const currentMeeting = meetingOverride || activeMeetingRef.current;
    const meetingId = getMeetingId(currentMeeting);
    if (!meetingId || hasReportedLeaveRef.current || !hasJoinedRoomRef.current) {
      return;
    }
    hasReportedLeaveRef.current = true;
    await leaveMeeting(meetingId).catch(() => {});
    hasJoinedRoomRef.current = false;
  }, []);

  const clearMeetingClient = useCallback(
    async ({ leave = false, reason = "workhub-meeting-cleanup" } = {}) => {
      const activeClient = meetingClientRef.current;
      removeRoomLeftListenerRef.current?.();
      removeRoomLeftListenerRef.current = null;
      meetingClientRef.current = null;
      setMeetingClient(null);

      if (leave && activeClient) {
        try {
          await activeClient.leaveRoom?.(reason);
        } catch {
          // SDK may already be disconnected.
        }
      }
    },
    [],
  );

  const clearActiveMeeting = useCallback(() => {
    setActiveMeeting(null);
    setMeetingJoinError("");
    hasJoinedRoomRef.current = false;
    hasReportedLeaveRef.current = false;
  }, []);

  const createMeeting = useCallback(async (payload) => {
    const data = await createMeetingApi(payload);
    setMeeting(data.meeting);
    setParticipantToken(data.participant?.token || null);
    return data;
  }, []);

  const joinMeeting = useCallback(async (meetingId) => {
    const data = await joinMeetingApi(meetingId);
    setMeeting(data.meeting);
    setParticipantToken(data.participant?.token || null);
    return data;
  }, []);

  const clearMeetingSession = useCallback(() => {
    setMeeting(null);
    setParticipantToken(null);
  }, []);

  const redirectAfterLeave = useCallback(
    (meetingOverride = null) => {
      const currentMeeting = meetingOverride || activeMeetingRef.current;
      const meetingId = getMeetingId(currentMeeting);
      if (meetingId && locationRef.current.pathname === `/meetings/${meetingId}`) {
        navigate("/meetings");
      }
    },
    [navigate],
  );

  const leaveActiveMeeting = useCallback(
    async (meetingOverride = null) => {
      const currentMeeting = meetingOverride || activeMeetingRef.current;
      if (isLeavingMeetingRef.current) return;

      isLeavingMeetingRef.current = true;
      setEndingMeeting(true);
      try {
        await clearMeetingClient({
          leave: true,
          reason: "workhub-meeting-left",
        });
        await reportMeetingLeave(currentMeeting);
        clearActiveMeeting();
        redirectAfterLeave(currentMeeting);
      } finally {
        isLeavingMeetingRef.current = false;
        setEndingMeeting(false);
      }
    },
    [clearActiveMeeting, clearMeetingClient, redirectAfterLeave, reportMeetingLeave],
  );

  const endActiveMeeting = useCallback(async () => {
    const currentMeeting = activeMeetingRef.current;
    const meetingId = getMeetingId(currentMeeting);
    if (!meetingId || isLeavingMeetingRef.current) return;

    isLeavingMeetingRef.current = true;
    setEndingMeeting(true);
    try {
      await clearMeetingClient({
        leave: true,
        reason: "workhub-meeting-ended",
      });
      const ended = await endMeeting(meetingId);
      hasJoinedRoomRef.current = false;
      clearActiveMeeting();
      redirectAfterLeave(ended.meeting || currentMeeting);
      message.success("Da ket thuc cuoc goi");
    } catch (error) {
      message.error(error.response?.data?.message || "Khong the ket thuc cuoc goi");
    } finally {
      isLeavingMeetingRef.current = false;
      setEndingMeeting(false);
    }
  }, [clearActiveMeeting, clearMeetingClient, message, redirectAfterLeave]);

  const handleSdkRoomLeft = useCallback(async () => {
    if (isLeavingMeetingRef.current) return;
    await leaveActiveMeeting(activeMeetingRef.current);
  }, [leaveActiveMeeting]);

  const joinActiveMeeting = useCallback(
    async ({
      meeting: meetingToJoin,
      participantToken: explicitParticipantToken,
      defaults = {},
    } = {}) => {
      const meetingId = getMeetingId(meetingToJoin);
      if (!meetingId) {
        throw new Error("Khong co thong tin phong hop");
      }

      const existingClient = meetingClientRef.current;
      if (existingClient && getMeetingId(activeMeetingRef.current) === meetingId) {
        return { meeting: activeMeetingRef.current || meetingToJoin, client: existingClient };
      }

      if (joinPromiseRef.current?.meetingId === meetingId) {
        return joinPromiseRef.current.promise;
      }

      const joinPromise = (async () => {
        setJoiningMeeting(true);
        setMeetingJoinError("");

        if (existingClient) {
          await leaveActiveMeeting(activeMeetingRef.current);
        }

        const token = explicitParticipantToken || participantToken;
        if (!token) {
          throw new Error("Khong nhan duoc token tham gia cuoc goi");
        }

        const nextClient = await initRealtimeKitClient({
          authToken: token,
          defaults,
        });

        meetingClientRef.current = nextClient;
        hasReportedLeaveRef.current = false;
        removeRoomLeftListenerRef.current = addRoomLeftListener(
          nextClient,
          handleSdkRoomLeft,
        );

        await nextClient.joinRoom();
        const joined = await markMeetingJoined(meetingId);
        hasJoinedRoomRef.current = true;
        const joinedMeeting = joined.meeting || meetingToJoin;
        setMeeting(joinedMeeting);
        setActiveMeeting(joinedMeeting);
        setMeetingClient(nextClient);
        return { meeting: joinedMeeting, client: nextClient };
      })();

      joinPromiseRef.current = { meetingId, promise: joinPromise };
      try {
        return await joinPromise;
      } catch (error) {
        await clearMeetingClient({
          leave: true,
          reason: "workhub-meeting-join-failed",
        });
        const errorMessage =
          error.response?.data?.message || error.message || "Khong the vao cuoc goi";
        setMeetingJoinError(errorMessage);
        throw error;
      } finally {
        if (joinPromiseRef.current?.meetingId === meetingId) {
          joinPromiseRef.current = null;
        }
        setJoiningMeeting(false);
      }
    },
    [
      clearMeetingClient,
      handleSdkRoomLeft,
      leaveActiveMeeting,
      participantToken,
    ],
  );

  const returnToActiveMeeting = useCallback(() => {
    const meetingId = getMeetingId(activeMeetingRef.current);
    if (meetingId) navigate(`/meetings/${meetingId}`);
  }, [navigate]);

  useEffect(() => {
    const meetingId = getMeetingId(activeMeeting);
    if (!meetingId || !meetingClient) return undefined;

    const intervalId = window.setInterval(() => {
      heartbeatMeeting(meetingId).catch(() => {});
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [activeMeeting, meetingClient]);

  useEffect(() => {
    const handlePageExit = () => {
      const currentMeeting = activeMeetingRef.current;
      meetingClientRef.current?.leaveRoom?.("workhub-page-exit");
      void reportMeetingLeave(currentMeeting);
    };

    window.addEventListener("pagehide", handlePageExit);
    return () => {
      window.removeEventListener("pagehide", handlePageExit);
    };
  }, [reportMeetingLeave]);

  const activeMeetingId = getMeetingId(activeMeeting);
  const shouldShowDock =
    Boolean(activeMeetingId) &&
    Boolean(meetingClient) &&
    location.pathname !== `/meetings/${activeMeetingId}`;

  const value = useMemo(
    () => ({
      meeting,
      participantToken,
      activeMeeting,
      meetingClient,
      meetingJoinError,
      isJoiningMeeting,
      isEndingMeeting,
      createMeeting,
      clearMeetingSession,
      joinMeeting,
      joinActiveMeeting,
      leaveActiveMeeting,
      endActiveMeeting,
    }),
    [
      activeMeeting,
      clearMeetingSession,
      createMeeting,
      endActiveMeeting,
      isEndingMeeting,
      isJoiningMeeting,
      joinMeeting,
      joinActiveMeeting,
      leaveActiveMeeting,
      meeting,
      meetingClient,
      meetingJoinError,
      participantToken,
    ],
  );

  return (
    <MeetingContext.Provider value={value}>
      {children}
      <MeetingDock
        meeting={activeMeeting}
        isVisible={shouldShowDock}
        isEnding={isEndingMeeting}
        onReturn={returnToActiveMeeting}
        onLeave={leaveActiveMeeting}
      />
    </MeetingContext.Provider>
  );
};