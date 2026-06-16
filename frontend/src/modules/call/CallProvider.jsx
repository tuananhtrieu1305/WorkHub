import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import { useSocket } from "../../context/SocketContext";
import {
  acceptCall as acceptCallApi,
  answerIntent,
  cancelCall,
  declineCall,
  endCall,
  failCall,
  getJoinToken,
  heartbeatCall,
  markCallJoined,
  prepareCall,
  ringCall,
} from "../../services/callService";
import { initRealtimeKitClient } from "../../services/realtimeKitClient";
import {
  createCallBroadcastChannel,
  ensureDistinctTabIdentity,
  getCallIdentity,
} from "./callIdentity";
import { requestCallMedia, stopMediaStream } from "./callMedia";
import { CallContext } from "./callContextValue";
import {
  getCallId,
  isTerminalCallStatus,
  normalizeMediaFailureReason,
  shouldCloseIncomingCall,
} from "./callState";
import CallDock from "./CallDock";
import IncomingCallModal from "./IncomingCallModal";
import OutgoingCallModal from "./OutgoingCallModal";

const getPeer = (payload, role) =>
  role === "caller" ? payload?.caller : payload?.callee;

const terminalMessages = {
  busy: "May ban",
  declined: "Cuoc goi da bi tu choi",
  cancelled: "Cuoc goi da bi huy",
  missed: "Khong nghe may",
  failed: "Cuoc goi that bai",
  ended: "Cuoc goi da ket thuc",
};

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

export const CallProvider = ({ children }) => {
  const { message } = App.useApp();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [identity, setIdentity] = useState(() => getCallIdentity());
  const [incoming, setIncoming] = useState(null);
  const [outgoing, setOutgoing] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callClient, setCallClient] = useState(null);
  const [callJoinError, setCallJoinError] = useState("");
  const [isJoiningCall, setJoiningCall] = useState(false);
  const [isEndingCall, setEndingCall] = useState(false);
  const [isIncomingLoading, setIncomingLoading] = useState(false);
  const [isOutgoingLoading, setOutgoingLoading] = useState(false);
  const startCallInFlightRef = useRef(false);
  const activeCallRef = useRef(null);
  const callClientRef = useRef(null);
  const identityRef = useRef(identity);
  const locationRef = useRef(location);
  const isEndingCallRef = useRef(false);
  const joinPromiseRef = useRef(null);
  const removeRoomLeftListenerRef = useRef(null);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    callClientRef.current = callClient;
  }, [callClient]);

  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    isEndingCallRef.current = isEndingCall;
  }, [isEndingCall]);

  useEffect(() => {
    const nextIdentity = ensureDistinctTabIdentity();
    setIdentity({
      browserDeviceId: nextIdentity.browserDeviceId,
      tabInstanceId: nextIdentity.tabInstanceId,
    });
    return () => nextIdentity.close?.();
  }, []);

  const redirectAfterEnd = useCallback(
    (call) => {
      if (!call?.id) return;
      if (locationRef.current.pathname === `/calls/${call.id}`) {
        navigate(call.conversationId ? `/messages/${call.conversationId}` : "/messages");
      }
    },
    [navigate],
  );

  const clearCallClient = useCallback(async ({ leave = false, reason } = {}) => {
    const activeClient = callClientRef.current;
    removeRoomLeftListenerRef.current?.();
    removeRoomLeftListenerRef.current = null;
    callClientRef.current = null;
    setCallClient(null);

    if (leave && activeClient) {
      try {
        await activeClient.leaveRoom?.(reason || "workhub-call-cleanup");
      } catch {
        // SDK may already be disconnected.
      }
    }
  }, []);

  const endActiveCall = useCallback(
    async (callOverride = null) => {
      const call = callOverride || activeCallRef.current;
      if (!call?.id || isEndingCallRef.current) return;

      isEndingCallRef.current = true;
      setEndingCall(true);
      try {
        await clearCallClient({ leave: true, reason: "workhub-call-ended" });
        const ended = await endCall(call.id);
        setActiveCall(null);
        redirectAfterEnd(ended.call || call);
      } catch (error) {
        message.error(error.response?.data?.message || "Khong the ket thuc cuoc goi");
      } finally {
        isEndingCallRef.current = false;
        setEndingCall(false);
      }
    },
    [clearCallClient, message, redirectAfterEnd],
  );

  const handleSdkRoomLeft = useCallback(async () => {
    if (isEndingCallRef.current) return;

    const call = activeCallRef.current;
    await clearCallClient();
    if (!call?.id || isTerminalCallStatus(call.status)) {
      setActiveCall(null);
      return;
    }

    isEndingCallRef.current = true;
    setEndingCall(true);
    try {
      const ended = await endCall(call.id);
      setActiveCall(null);
      redirectAfterEnd(ended.call || call);
    } catch {
      setActiveCall(null);
      redirectAfterEnd(call);
    } finally {
      isEndingCallRef.current = false;
      setEndingCall(false);
    }
  }, [clearCallClient, redirectAfterEnd]);

  const joinActiveCall = useCallback(
    async ({ call, participantToken } = {}) => {
      const callId = getCallId(call);
      if (!callId) {
        throw new Error("Khong co thong tin cuoc goi");
      }

      const existingClient = callClientRef.current;
      if (existingClient && getCallId(activeCallRef.current) === callId) {
        return { call: activeCallRef.current || call, client: existingClient };
      }

      if (joinPromiseRef.current?.callId === callId) {
        return joinPromiseRef.current.promise;
      }

      const joinPromise = (async () => {
        setJoiningCall(true);
        setCallJoinError("");
        setActiveCall(call);

        if (existingClient) {
          await clearCallClient({
            leave: true,
            reason: "workhub-call-switch",
          });
        }

        const token =
          participantToken ||
          (await getJoinToken(callId)).participant?.token;
        if (!token) {
          throw new Error("Khong nhan duoc token tham gia cuoc goi");
        }

        const meetingClient = await initRealtimeKitClient({
          authToken: token,
          defaults: {
            audio: true,
            video: call.mediaType === "video",
          },
        });

        callClientRef.current = meetingClient;
        removeRoomLeftListenerRef.current = addRoomLeftListener(
          meetingClient,
          handleSdkRoomLeft,
        );

        await meetingClient.joinRoom();
        setCallClient(meetingClient);

        const joined = await markCallJoined(callId, identityRef.current);
        setActiveCall(joined.call);
        return { call: joined.call, client: meetingClient };
      })();

      joinPromiseRef.current = { callId, promise: joinPromise };
      try {
        return await joinPromise;
      } catch (error) {
        await clearCallClient({
          leave: true,
          reason: "workhub-call-join-failed",
        });
        const errorMessage =
          error.response?.data?.message || error.message || "Khong the vao cuoc goi";
        setCallJoinError(errorMessage);
        throw error;
      } finally {
        if (joinPromiseRef.current?.callId === callId) {
          joinPromiseRef.current = null;
        }
        setJoiningCall(false);
      }
    },
    [clearCallClient, handleSdkRoomLeft],
  );

  useEffect(() => {
    if (!activeCall?.id || !callClient || isTerminalCallStatus(activeCall.status)) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      heartbeatCall(activeCall.id).catch(() => {});
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [activeCall?.id, activeCall?.status, callClient]);

  useEffect(() => {
    const handlePageExit = () => {
      const call = activeCallRef.current;
      callClientRef.current?.leaveRoom?.("workhub-page-exit");
      if (call?.id && !isTerminalCallStatus(call.status)) {
        endCall(call.id).catch(() => {});
      }
    };

    window.addEventListener("pagehide", handlePageExit);
    return () => {
      window.removeEventListener("pagehide", handlePageExit);
    };
  }, []);

  useEffect(() => {
    const channel = createCallBroadcastChannel();
    if (!channel) return undefined;

    const handleMessage = (event) => {
      if (event.data?.type !== "call_resolved") return;
      const activeCallId = getCallId(incoming?.call);
      if (
        shouldCloseIncomingCall({
          activeCallId,
          eventCallId: event.data.callId,
          currentTabInstanceId: identity.tabInstanceId,
          answeredByTabInstanceId: event.data.answeredByTabInstanceId,
        })
      ) {
        setIncoming(null);
      }
    };

    channel.addEventListener("message", handleMessage);
    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
    };
  }, [identity.tabInstanceId, incoming]);

  const broadcastResolved = useCallback((call) => {
    const channel = createCallBroadcastChannel();
    if (!channel) return;
    channel.postMessage({
      type: "call_resolved",
      callId: getCallId(call),
      answeredByTabInstanceId: call?.answeredByTabInstanceId,
    });
    channel.close();
  }, []);

  const navigateToCall = useCallback(
    ({ call, participantToken }) => {
      if (!call?.id) return;
      setActiveCall(call);
      navigate(`/calls/${call.id}`, {
        state: { call, participantToken },
      });
    },
    [navigate],
  );

  const startCall = useCallback(
    async ({ conversationId, calleeUserId, mediaType, callee }) => {
      const hasLiveCall =
        activeCallRef.current && !isTerminalCallStatus(activeCallRef.current.status);
      if (startCallInFlightRef.current || outgoing || incoming || hasLiveCall) {
        message.warning("Ban dang co cuoc goi dang xu ly");
        return;
      }

      startCallInFlightRef.current = true;
      setOutgoingLoading(true);
      let preparedCall = null;
      try {
        const prepared = await prepareCall({
          conversationId,
          calleeUserId,
          mediaType,
          ...identity,
        });
        preparedCall = prepared.call;
        setOutgoing({ call: prepared.call, callee });

        const stream = await requestCallMedia(mediaType);
        stopMediaStream(stream);

        const ringing = await ringCall(prepared.call.id, identity);
        setOutgoing({ call: ringing.call, callee: ringing.callee || callee });
      } catch (error) {
        if (preparedCall?.id) {
          const reason = normalizeMediaFailureReason(error, "caller", mediaType);
          await failCall(preparedCall.id, {
            statusReason: reason,
            tabInstanceId: identity.tabInstanceId,
          }).catch(() => {});
        }
        if (error.response?.data?.code === "CALLEE_UNAVAILABLE") {
          message.warning("Người dùng đang ngoại tuyến");
        } else if (error.response?.data?.code === "CALL_BUSY") {
          const isCallerBusy = error.response?.data?.message === "Caller is busy";
          message.warning(
            isCallerBusy
              ? "Ban dang co cuoc goi dang xu ly"
              : "Nguoi dung dang ban",
          );
        } else if (error?.code === "timeout") {
          message.error("Khong nhan duoc quyen micro/camera");
        } else {
          message.error(error.response?.data?.message || "Khong the bat dau cuoc goi");
        }
        setOutgoing(null);
      } finally {
        startCallInFlightRef.current = false;
        setOutgoingLoading(false);
      }
    },
    [identity, incoming, message, outgoing],
  );

  const acceptIncomingCall = useCallback(async () => {
    const call = incoming?.call;
    if (!call?.id) return;

    setIncomingLoading(true);
    let reservedAnswer = false;
    try {
      const intent = await answerIntent(call.id, identity);
      reservedAnswer = true;
      setIncoming((current) =>
        current ? { ...current, call: intent.call } : current,
      );
      broadcastResolved(intent.call);

      const stream = await requestCallMedia(call.mediaType);
      stopMediaStream(stream);

      const accepted = await acceptCallApi(call.id, identity);
      setIncoming(null);
      navigateToCall({
        call: accepted.call,
        participantToken: accepted.participant?.token,
      });
    } catch (error) {
      if (reservedAnswer) {
        const reason = normalizeMediaFailureReason(error, "callee", call.mediaType);
        await failCall(call.id, {
          statusReason: reason,
          tabInstanceId: identity.tabInstanceId,
        }).catch(() => {});
        message.error("Khong the mo micro/camera de nghe may");
      } else {
        message.error(error.response?.data?.message || "Cuoc goi khong con kha dung");
      }
      setIncoming(null);
    } finally {
      setIncomingLoading(false);
    }
  }, [broadcastResolved, identity, incoming, message, navigateToCall]);

  const declineIncomingCall = useCallback(async () => {
    const call = incoming?.call;
    if (!call?.id) return;
    setIncomingLoading(true);
    try {
      await declineCall(call.id);
      setIncoming(null);
    } catch (error) {
      message.error(error.response?.data?.message || "Khong the tu choi cuoc goi");
    } finally {
      setIncomingLoading(false);
    }
  }, [incoming, message]);

  const cancelOutgoingCall = useCallback(async () => {
    const call = outgoing?.call;
    if (!call?.id) {
      setOutgoing(null);
      return;
    }
    setOutgoingLoading(true);
    try {
      await cancelCall(call.id);
      setOutgoing(null);
    } catch (error) {
      message.error(error.response?.data?.message || "Khong the huy cuoc goi");
    } finally {
      setOutgoingLoading(false);
    }
  }, [message, outgoing]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleIncoming = (payload) => {
      setIncoming(payload);
    };

    const handleRinging = (payload) => {
      setOutgoing(payload);
    };

    const handleAnswering = (payload) => {
      setOutgoing(payload);
    };

    const handleResolved = (payload) => {
      const call = payload?.call;
      broadcastResolved(call);
      setIncoming((current) => {
        if (
          shouldCloseIncomingCall({
            activeCallId: getCallId(current?.call),
            eventCallId: getCallId(call),
            currentTabInstanceId: identity.tabInstanceId,
            answeredByTabInstanceId: call?.answeredByTabInstanceId,
          })
        ) {
          return null;
        }
        return current;
      });
    };

    const handleAccepted = async (payload) => {
      const call = payload?.call;
      if (!call?.id) return;
      setOutgoing(payload);
      try {
        const joined = await getJoinToken(call.id);
        setOutgoing(null);
        navigateToCall({
          call: joined.call || call,
          participantToken: joined.participant?.token,
        });
      } catch (error) {
        message.error(error.response?.data?.message || "Khong the vao cuoc goi");
      }
    };

    const handleActive = (payload) => {
      setActiveCall(payload?.call || null);
    };

    const handleTerminal = (payload) => {
      const call = payload?.call;
      if (!call || !isTerminalCallStatus(call.status)) return;

      setIncoming((current) => (getCallId(current?.call) === call.id ? null : current));
      setOutgoing((current) => (getCallId(current?.call) === call.id ? null : current));
      if (getCallId(activeCallRef.current) === call.id) {
        void clearCallClient({ leave: true, reason: "workhub-call-terminal" });
        setActiveCall(null);
      }

      const text = terminalMessages[call.status];
      if (text && call.status !== "ended") {
        message.info(text);
      }

      redirectAfterEnd(call);
    };

    socket.on("call:incoming", handleIncoming);
    socket.on("call:ringing", handleRinging);
    socket.on("call:answering", handleAnswering);
    socket.on("call:resolved", handleResolved);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:active", handleActive);
    socket.on("call:declined", handleTerminal);
    socket.on("call:cancelled", handleTerminal);
    socket.on("call:missed", handleTerminal);
    socket.on("call:busy", handleTerminal);
    socket.on("call:failed", handleTerminal);
    socket.on("call:ended", handleTerminal);

    return () => {
      socket.off("call:incoming", handleIncoming);
      socket.off("call:ringing", handleRinging);
      socket.off("call:answering", handleAnswering);
      socket.off("call:resolved", handleResolved);
      socket.off("call:accepted", handleAccepted);
      socket.off("call:active", handleActive);
      socket.off("call:declined", handleTerminal);
      socket.off("call:cancelled", handleTerminal);
      socket.off("call:missed", handleTerminal);
      socket.off("call:busy", handleTerminal);
      socket.off("call:failed", handleTerminal);
      socket.off("call:ended", handleTerminal);
    };
  }, [
    broadcastResolved,
    clearCallClient,
    identity.tabInstanceId,
    message,
    navigateToCall,
    redirectAfterEnd,
    socket,
  ]);

  const returnToActiveCall = useCallback(() => {
    const call = activeCallRef.current;
    if (call?.id) navigate(`/calls/${call.id}`);
  }, [navigate]);

  const shouldShowDock =
    Boolean(activeCall?.id) &&
    Boolean(callClient) &&
    !isTerminalCallStatus(activeCall.status) &&
    location.pathname !== `/calls/${activeCall.id}`;

  const value = useMemo(
    () => ({
      identity,
      activeCall,
      callClient,
      callJoinError,
      isJoiningCall,
      isEndingCall,
      setActiveCall,
      joinActiveCall,
      endActiveCall,
      startCall,
    }),
    [
      activeCall,
      callClient,
      callJoinError,
      endActiveCall,
      identity,
      isEndingCall,
      isJoiningCall,
      joinActiveCall,
      startCall,
    ],
  );

  return (
    <CallContext.Provider value={value}>
      {children}
      <IncomingCallModal
        open={Boolean(incoming)}
        call={incoming?.call}
        caller={getPeer(incoming, "caller")}
        loading={isIncomingLoading}
        onAccept={acceptIncomingCall}
        onDecline={declineIncomingCall}
      />
      <OutgoingCallModal
        open={Boolean(outgoing)}
        call={outgoing?.call}
        callee={getPeer(outgoing, "callee")}
        loading={isOutgoingLoading}
        onCancel={cancelOutgoingCall}
      />
      <CallDock
        call={activeCall}
        isVisible={shouldShowDock}
        isEnding={isEndingCall}
        onReturn={returnToActiveCall}
        onEnd={() => endActiveCall()}
      />
    </CallContext.Provider>
  );
};
