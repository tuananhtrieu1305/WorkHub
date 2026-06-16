import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
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
import { useWorkHubToast } from "../../components/feedback/workHubToast";

const getPeer = (payload, role) =>
  role === "caller" ? payload?.caller : payload?.callee;

const toComparableId = (value) => {
  if (value == null) return "";
  return String(value._id || value.id || value);
};

const terminalMessages = {
  busy: "Máy bận",
  declined: "Cuộc gọi đã bị từ chối",
  cancelled: "Cuộc gọi đã bị hủy",
  missed: "Không nghe máy",
  failed: "Cuộc gọi thất bại",
  ended: "Cuộc gọi đã kết thúc",
};

const terminalDescriptions = {
  busy: "Người nhận hoặc thiết bị của bạn đang có cuộc gọi khác.",
  declined: "Người nhận đã từ chối lời mời gọi.",
  cancelled: "Cuộc gọi đã được hủy trước khi kết nối.",
  missed: "Cuộc gọi kết thúc vì không có người trả lời.",
  failed: "Phiên gọi không thể kết nối ổn định. Hãy thử gọi lại sau.",
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
  const message = useWorkHubToast();
  const { user } = useAuth();
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
  const activeOrganizationId = toComparableId(
    user?.activeOrganization?.id ||
      user?.activeOrganization?._id ||
      user?.activeOrganizationId,
  );

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

  const isActiveOrganizationCallPayload = useCallback(
    (payload) => {
      const eventOrganizationId = toComparableId(
        payload?.call?.organizationId || payload?.organizationId,
      );

      return Boolean(activeOrganizationId) && eventOrganizationId === activeOrganizationId;
    },
    [activeOrganizationId],
  );

  useEffect(() => {
    setIncoming((current) =>
      !current || isActiveOrganizationCallPayload(current) ? current : null,
    );
    setOutgoing((current) =>
      !current || isActiveOrganizationCallPayload(current) ? current : null,
    );

    const activeOrganization = toComparableId(activeCallRef.current?.organizationId);
    if (activeCallRef.current && activeOrganization !== activeOrganizationId) {
      void clearCallClient({
        leave: true,
        reason: "workhub-organization-switch",
      });
      setActiveCall(null);
    }
  }, [activeOrganizationId, clearCallClient, isActiveOrganizationCallPayload]);

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
        message.error(error.response?.data?.message || "Không thể kết thúc cuộc gọi", {
          description:
            "Cuộc gọi hiện tại chưa được đóng hoàn toàn. Hãy kiểm tra kết nối hoặc thử kết thúc lại.",
        });
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
        throw new Error("Không có thông tin cuộc gọi");
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
          throw new Error("Không nhận được token tham gia cuộc gọi");
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
          error.response?.data?.message || error.message || "Không thể vào cuộc gọi";
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
        message.warning("Bạn đang có cuộc gọi đang xử lý", {
          description:
            "Hãy kết thúc hoặc hủy cuộc gọi hiện tại trước khi bắt đầu cuộc gọi mới.",
        });
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
          message.warning("Người dùng đang ngoại tuyến", {
            description: `${
              callee?.fullName || "Người nhận"
            } hiện không sẵn sàng nhận cuộc gọi trong WorkHub.`,
          });
        } else if (error.response?.data?.code === "CALL_BUSY") {
          const isCallerBusy = error.response?.data?.message === "Caller is busy";
          message.warning(
            isCallerBusy
              ? "Bạn đang có cuộc gọi đang xử lý"
              : "Người dùng đang bận",
            {
              description: isCallerBusy
                ? "Bạn cần kết thúc phiên gọi hiện tại trước khi gọi tiếp."
                : `${
                    callee?.fullName || "Người nhận"
                  } đang ở trong một cuộc gọi khác.`,
            },
          );
        } else if (error?.code === "timeout") {
          message.error("Không nhận được quyền micro/camera", {
            description:
              "Trình duyệt chưa cấp quyền thiết bị nên WorkHub không thể bắt đầu cuộc gọi.",
          });
        } else {
          message.error(error.response?.data?.message || "Không thể bắt đầu cuộc gọi", {
            description:
              "Cuộc gọi chưa được tạo trong hội thoại này. Hãy kiểm tra kết nối hoặc thử lại sau.",
          });
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
        message.error("Không thể mở micro/camera để nghe máy", {
          description:
            "Trình duyệt chưa cấp quyền thiết bị nên WorkHub không thể kết nối vào cuộc gọi.",
        });
      } else {
        message.error(error.response?.data?.message || "Cuộc gọi không còn khả dụng", {
          description:
            "Cuộc gọi có thể đã bị hủy, hết thời gian chờ hoặc không còn thuộc phiên hiện tại.",
        });
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
      message.error(error.response?.data?.message || "Không thể từ chối cuộc gọi", {
        description:
          "Lựa chọn từ chối chưa được gửi tới hệ thống. Hãy thử lại nếu cuộc gọi vẫn còn hiển thị.",
      });
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
      message.error(error.response?.data?.message || "Không thể hủy cuộc gọi", {
        description:
          "Cuộc gọi đi vẫn có thể đang đổ chuông. Hãy thử hủy lại hoặc chờ trạng thái cập nhật.",
      });
    } finally {
      setOutgoingLoading(false);
    }
  }, [message, outgoing]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleIncoming = (payload) => {
      if (!isActiveOrganizationCallPayload(payload)) return;
      setIncoming(payload);
    };

    const handleRinging = (payload) => {
      if (!isActiveOrganizationCallPayload(payload)) return;
      setOutgoing(payload);
    };

    const handleAnswering = (payload) => {
      if (!isActiveOrganizationCallPayload(payload)) return;
      setOutgoing(payload);
    };

    const handleResolved = (payload) => {
      if (!isActiveOrganizationCallPayload(payload)) return;
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
      if (!isActiveOrganizationCallPayload(payload)) return;
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
        message.error(error.response?.data?.message || "Không thể vào cuộc gọi", {
          description:
            "WorkHub chưa lấy được phiên tham gia sau khi người nhận nghe máy.",
        });
      }
    };

    const handleActive = (payload) => {
      if (!isActiveOrganizationCallPayload(payload)) return;
      setActiveCall(payload?.call || null);
    };

    const handleTerminal = (payload) => {
      if (!isActiveOrganizationCallPayload(payload)) return;
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
        message.info(text, {
          description:
            terminalDescriptions[call.status] ||
            "Trạng thái cuộc gọi đã được cập nhật.",
        });
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
    isActiveOrganizationCallPayload,
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
