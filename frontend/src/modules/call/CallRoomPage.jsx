import { useEffect, useRef, useState } from "react";
import { Alert, Button, Spin, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import MeetingUI from "../meeting/MeetingUI";
import { useCall } from "./callContextValue";
import { getCall } from "../../services/callService";

const { Text } = Typography;

export default function CallRoomPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    activeCall,
    callClient,
    callJoinError,
    isJoiningCall,
    joinActiveCall,
    setActiveCall,
  } = useCall();
  const initialCall = location.state?.call || null;
  const initialCallRef = useRef(initialCall);
  const [call, setCall] = useState(
    getCallIdOrNull(activeCall) === id ? activeCall : initialCall,
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;

    const openCall = async () => {
      setError("");
      try {
        const detail = initialCallRef.current
          ? { call: initialCallRef.current }
          : await getCall(id);
        if (cancelled) return;

        const currentCall = detail.call;
        setCall(currentCall);
        setActiveCall(currentCall);

        await joinActiveCall({
          call: currentCall,
          participantToken: location.state?.participantToken,
        });
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message || err.message || "Khong the vao cuoc goi",
          );
        }
      }
    };

    openCall();

    return () => {
      cancelled = true;
    };
  }, [
    id,
    joinActiveCall,
    location.state?.participantToken,
    setActiveCall,
  ]);

  const activeClientForRoute =
    getCallIdOrNull(activeCall) === id ? callClient : null;
  const displayCall =
    getCallIdOrNull(activeCall) === id ? activeCall : call;
  const displayError = error || callJoinError;

  if (displayError) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-950 p-6">
        <Alert
          type="error"
          showIcon
          message="Khong the mo cuoc goi"
          description={displayError}
          action={<Button onClick={() => navigate("/messages")}>Quay lai</Button>}
        />
      </div>
    );
  }

  if (isJoiningCall || !activeClientForRoute) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-slate-950 text-white">
        <Spin size="large" />
        <Text className="!text-white">Dang ket noi cuoc goi...</Text>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/messages")}>
          Tin nhan
        </Button>
        <div className="min-w-0 px-4 text-center">
          <div className="truncate text-sm font-semibold">
            {displayCall?.mediaType === "audio" ? "Cuoc goi audio" : "Cuoc goi video"}
          </div>
          <div className="truncate text-xs text-white/60">ID: {displayCall?.id || id}</div>
        </div>
        <div className="w-[88px]" />
      </div>

      <MeetingUI meeting={activeClientForRoute} />
    </div>
  );
}

const getCallIdOrNull = (call) => call?.id || call?._id || null;
