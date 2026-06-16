import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Spin, Switch, Typography } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftOutlined,
  AudioMutedOutlined,
  AudioOutlined,
  VideoCameraOutlined,
  VideoCameraAddOutlined,
} from "@ant-design/icons";
import { useMeetingContext } from "./meetingContextValue";
import MeetingUI from "./MeetingUI";
import { getMeeting } from "../../services/meetingService";

const { Text, Title } = Typography;

export default function MeetingRoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    meeting,
    activeMeeting: sessionMeeting,
    meetingClient,
    meetingJoinError,
    isJoiningMeeting,
    joinMeeting,
    joinActiveMeeting,
  } = useMeetingContext();
  const [roomInfo, setRoomInfo] = useState(null);
  const [isLoadingRoom, setIsLoadingRoom] = useState(true);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [isPreviewVideoOn, setIsPreviewVideoOn] = useState(true);
  const [isPreviewAudioOn, setIsPreviewAudioOn] = useState(false);
  const previewVideoRef = useRef(null);
  const previewStreamRef = useRef(null);

  const routeMeetingId = String(id || "");
  const contextMeetingId = meeting?.id || meeting?._id;
  const activeMeetingId = sessionMeeting?.id || sessionMeeting?._id;
  const isInRoom =
    Boolean(meetingClient) &&
    Boolean(activeMeetingId) &&
    String(activeMeetingId) === routeMeetingId;
  const displayMeeting =
    (isInRoom ? sessionMeeting : null) ||
    roomInfo ||
    (contextMeetingId && String(contextMeetingId) === routeMeetingId ? meeting : null);

  const stopPreviewStream = useCallback(() => {
    previewStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    previewStreamRef.current = null;
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadRoom = async () => {
      if (!id) return;
      setIsLoadingRoom(true);
      setError("");

      try {
        const data = await getMeeting(id);
        if (isMounted) {
          setRoomInfo(data.meeting);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.message || "Khong the tai thong tin cuoc goi");
        }
      } finally {
        if (isMounted) {
          setIsLoadingRoom(false);
        }
      }
    };

    loadRoom();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (isInRoom || (!isPreviewVideoOn && !isPreviewAudioOn)) {
      stopPreviewStream();
      return undefined;
    }

    let cancelled = false;

    const startPreview = async () => {
      stopPreviewStream();
      setPreviewError("");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: isPreviewVideoOn,
          audio: isPreviewAudioOn,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        previewStreamRef.current = stream;
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
          await previewVideoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) {
          setPreviewError("Khong the mo camera hoac micro. Hay kiem tra quyen trinh duyet.");
        }
      }
    };

    startPreview();

    return () => {
      cancelled = true;
    };
  }, [isInRoom, isPreviewAudioOn, isPreviewVideoOn, previewRefreshKey, stopPreviewStream]);

  const handleJoinNow = async () => {
    if (!id || isJoiningMeeting) return;

    setError("");

    try {
      const data = await joinMeeting(id);
      setRoomInfo(data.meeting);

      const participantToken = data.participant?.token;
      if (!participantToken) {
        throw new Error("Khong nhan duoc token tham gia cuoc goi");
      }

      stopPreviewStream();

      await joinActiveMeeting({
        meeting: data.meeting,
        participantToken,
        defaults: {
          audio: isPreviewAudioOn,
          video: isPreviewVideoOn,
        },
      });
    } catch (err) {
      setError(err.response?.data?.message || err?.message || "Khong the tham gia cuoc goi");
      setPreviewRefreshKey((currentKey) => currentKey + 1);
    }
  };

  const handleBackToList = () => {
    navigate("/meetings");
  };

  const displayError = error || meetingJoinError;

  if (displayError && !displayMeeting && !isInRoom) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Alert
          type="error"
          showIcon
          message="Khong the mo cuoc goi"
          description={displayError}
          action={<Button onClick={() => navigate("/meetings")}>Quay lai</Button>}
        />
      </div>
    );
  }

  if (isLoadingRoom && !displayMeeting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-white">
        <Spin size="large" />
        <Text className="!text-white">Dang tai thong tin phong hop...</Text>
      </div>
    );
  }

  if (!isInRoom) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-8 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-6xl flex-col">
          <Button
            className="mb-6 w-fit"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/meetings")}
          >
            Danh sach
          </Button>

          <div className="grid flex-1 items-center gap-8 lg:grid-cols-[1.4fr_0.8fr]">
            <div>
              <Title className="!mb-2 !text-white" level={2}>
                {displayMeeting?.title || "WorkHub meeting"}
              </Title>
              <Text className="!text-white/60">
                Kiem tra thiet bi truoc khi vao phong.
              </Text>

              <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
                <div className="relative aspect-video bg-slate-900">
                  {isPreviewVideoOn ? (
                    <video
                      ref={previewVideoRef}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-white/70">
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-600 text-3xl font-semibold">
                        {(displayMeeting?.title || "W").charAt(0).toUpperCase()}
                      </div>
                      <Text className="!text-white/60">Camera dang tat</Text>
                    </div>
                  )}

                  <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-sm backdrop-blur">
                    {isPreviewAudioOn ? <AudioOutlined /> : <AudioMutedOutlined />}
                    <span>{isPreviewAudioOn ? "Mic dang bat" : "Mic dang tat"}</span>
                  </div>
                </div>
              </div>

              {previewError && (
                <Alert className="mt-4" type="warning" showIcon message={previewError} />
              )}
            </div>

            <Card className="border-0 shadow-2xl" title="San sang tham gia">
              <div className="space-y-5">
                <div className="rounded-xl bg-slate-50 p-4">
                  <Text type="secondary">Meeting ID</Text>
                  <div className="mt-1 break-all font-mono text-sm text-slate-900">
                    {displayMeeting?.id || id}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    <VideoCameraOutlined className="text-lg text-blue-600" />
                    <span className="font-medium">Camera</span>
                  </div>
                  <Switch checked={isPreviewVideoOn} onChange={setIsPreviewVideoOn} />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    {isPreviewAudioOn ? (
                      <AudioOutlined className="text-lg text-blue-600" />
                    ) : (
                      <AudioMutedOutlined className="text-lg text-slate-500" />
                    )}
                    <span className="font-medium">Micro</span>
                  </div>
                  <Switch checked={isPreviewAudioOn} onChange={setIsPreviewAudioOn} />
                </div>

                {displayError && <Alert type="error" showIcon message={displayError} />}

                <Button
                  block
                  size="large"
                  type="primary"
                  icon={<VideoCameraAddOutlined />}
                  loading={isJoiningMeeting}
                  onClick={handleJoinNow}
                >
                  Join now
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
        <Button icon={<ArrowLeftOutlined />} onClick={handleBackToList}>
          Danh sach
        </Button>
        <div className="min-w-0 px-4 text-center">
          <div className="truncate text-sm font-semibold">
            {displayMeeting?.title || "WorkHub meeting"}
          </div>
          <div className="truncate text-xs text-white/60">ID: {displayMeeting?.id || id}</div>
        </div>
        <div className="w-[88px]" />
      </div>

      <MeetingUI meeting={meetingClient} />
    </div>
  );
}
