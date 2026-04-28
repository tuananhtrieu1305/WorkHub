import { useEffect, useRef, useState } from "react";
import { Alert, Button, Spin, Typography, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftOutlined, PhoneOutlined } from "@ant-design/icons";
import RealtimeKitClient from "@cloudflare/realtimekit";
import { useMeetingContext } from "./meetingContextValue";
import MeetingUI from "./MeetingUI";
import WhiteboardController from "./components/WhiteboardController";
import { endMeeting } from "../../api/meetingApi";

const { Text } = Typography;

export default function MeetingRoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { meeting, participantToken, joinMeeting, clearMeetingSession } =
    useMeetingContext();
  const [client, setClient] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [error, setError] = useState("");
  const hasInit = useRef(false);

  useEffect(() => {
    const ensureToken = async () => {
      if (participantToken || !id) return;
      try {
        await joinMeeting(id);
      } catch (err) {
        setError(err.response?.data?.message || "Khong the lay token cuoc goi");
      }
    };

    ensureToken();
  }, [id, participantToken, joinMeeting]);

  useEffect(() => {
    if (!participantToken || hasInit.current) return;
    hasInit.current = true;

    RealtimeKitClient.init({
      authToken: participantToken,
      defaults: { audio: false, video: false },
    })
      .then(async (meetingClient) => {
        await meetingClient.joinRoom();
        setClient(meetingClient);
        setIsReady(true);
      })
      .catch((err) => {
        setError(err?.message || "Khong the khoi tao cuoc goi");
      });
  }, [participantToken]);

  const handleEndMeeting = async () => {
    setIsEnding(true);
    try {
      await endMeeting(id);
      clearMeetingSession();
      message.success("Da ket thuc cuoc goi");
      navigate("/meetings");
    } catch (err) {
      message.error(err.response?.data?.message || "Khong the ket thuc cuoc goi");
    } finally {
      setIsEnding(false);
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Alert
          type="error"
          showIcon
          message="Khong the mo cuoc goi"
          description={error}
          action={
            <Button onClick={() => navigate("/meetings")}>Quay lai</Button>
          }
        />
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-white">
        <Spin size="large" />
        <Text className="!text-white">Dang thiet lap phong hop...</Text>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/meetings")}>
          Danh sach
        </Button>
        <div className="min-w-0 px-4 text-center">
          <div className="truncate text-sm font-semibold">
            {meeting?.title || "WorkHub meeting"}
          </div>
          <div className="truncate text-xs text-white/60">ID: {id}</div>
        </div>
        <Button
          danger
          icon={<PhoneOutlined />}
          loading={isEnding}
          onClick={handleEndMeeting}
        >
          Ket thuc
        </Button>
      </div>

      <MeetingUI meeting={client} />
      <WhiteboardController meeting={client} hostId={meeting?.hostUserId} />
    </div>
  );
}
