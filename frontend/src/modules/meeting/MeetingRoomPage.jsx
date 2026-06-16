import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Select, Spin, Switch, Tag, Tooltip, Typography } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftOutlined,
  AudioMutedOutlined,
  AudioOutlined,
  CopyOutlined,
  DownloadOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SettingOutlined,
  VideoCameraOutlined,
  VideoCameraAddOutlined,
} from "@ant-design/icons";
import { useMeetingContext } from "./meetingContextValue";
import MeetingUI from "./MeetingUI";
import { getMeeting } from "../../services/meetingService";
import { formatMeetingDateTime } from "../../components/layout/notificationPanelState";
import {
  buildJoinMediaDefaults,
  buildPreviewMediaConstraints,
  getPreferredDeviceId,
  normalizeMediaDevices,
} from "./meetingLobbyState";
import { useWorkHubToast } from "../../components/feedback/workHubToast";

const { Text, Title } = Typography;

const EMPTY_DEVICE_OPTIONS = {
  audioInputs: [],
  videoInputs: [],
};

const getRecordingMediaType = (url = "") => {
  const cleanUrl = String(url).split("?")[0].toLowerCase();
  return /\.(aac|flac|m4a|mp3|ogg|wav)$/i.test(cleanUrl) ? "audio" : "video";
};

const getSummaryStatusTag = (summary, meeting) => {
  if (meeting?.aiSummaryEnabled === false) {
    return <Tag>AI summary off</Tag>;
  }

  if (summary?.status === "completed") {
    return <Tag color="blue">AI summary ready</Tag>;
  }
  if (summary?.status === "processing") {
    return <Tag color="gold">AI processing</Tag>;
  }
  if (summary?.status === "failed") {
    return <Tag color="red">AI failed</Tag>;
  }
  return <Tag>No summary yet</Tag>;
};

const MeetingSummaryPanel = ({ summary, meeting }) => {
  const isAiSummaryDisabled = meeting?.aiSummaryEnabled === false;
  const hasCompletedSummary = summary?.status === "completed";
  const hasTranscript = Boolean(summary?.transcript);
  const hasRecording = Boolean(summary?.recordingUrl);
  const recordingMediaType = getRecordingMediaType(summary?.recordingUrl);

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/70 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <FileTextOutlined className="text-lg" />
          </div>
          <div>
            <h2 className="m-0 text-lg font-bold text-slate-950">
              AI Meeting Summary
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Kết quả được tạo sau khi recording của cuộc họp xử lý xong.
            </p>
          </div>
        </div>
        {getSummaryStatusTag(summary, meeting)}
      </div>

      {isAiSummaryDisabled && (
        <Alert
          type="info"
          showIcon
          message="AI summary không được bật"
          description="Cuộc họp này không ghi âm và không tạo AI summary."
        />
      )}

      {!summary && !isAiSummaryDisabled && (
        <Alert
          type="info"
          showIcon
          message="Chưa có summary"
          description="Nếu cuộc họp vừa kết thúc, WorkHub sẽ tự xử lý recording và cập nhật kết quả ở đây."
        />
      )}

      {summary?.status === "processing" && (
        <Alert
          type="warning"
          showIcon
          message="Đang xử lý AI summary"
          description="Transcript và summary sẽ xuất hiện sau khi Workers AI xử lý xong recording."
        />
      )}

      {summary?.status === "failed" && (
        <Alert
          type="error"
          showIcon
          message="Không thể tạo AI summary"
          description={summary.errorMessage || "Vui lòng thử lại sau."}
        />
      )}

      {hasRecording && (
        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-slate-500">
              Recording
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button
                size="small"
                href={summary.recordingUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open
              </Button>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                href={summary.recordingUrl}
                download
              >
                Download
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
            {recordingMediaType === "audio" ? (
              <div className="bg-slate-50 p-4">
                <audio controls className="w-full" src={summary.recordingUrl} />
              </div>
            ) : (
              <video
                controls
                className="aspect-video w-full bg-slate-950"
                src={summary.recordingUrl}
              />
            )}
          </div>
        </div>
      )}

      {hasCompletedSummary && (
        <div className="space-y-5">
          <div>
            <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-slate-500">
              Tóm tắt
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {summary.summary || "Không có nội dung summary."}
            </p>
          </div>

          {!!summary.decisions?.length && (
            <div>
              <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-slate-500">
                Decisions
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {summary.decisions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {!!summary.actionItems?.length && (
            <div>
              <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-slate-500">
                Action items
              </h3>
              <div className="mt-2 space-y-2">
                {summary.actionItems.map((item, index) => (
                  <div
                    key={`${item.title}-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                  >
                    <div className="font-semibold text-slate-950">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {[item.owner, item.dueDate, item.priority].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!summary.followUps?.length && (
            <div>
              <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-slate-500">
                Follow-ups
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {summary.followUps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-slate-500">
              Full transcript
            </h3>
            <div className="mt-2 max-h-96 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="m-0 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                {summary.transcript || "Không có transcript."}
              </p>
            </div>
          </div>
        </div>
      )}

      {!hasCompletedSummary && hasTranscript && (
        <div className="mt-5">
          <h3 className="m-0 text-sm font-bold uppercase tracking-wide text-slate-500">
            Full transcript
          </h3>
          <div className="mt-2 max-h-96 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="m-0 whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {summary.transcript}
            </p>
          </div>
        </div>
      )}
    </section>
  );
};

export default function MeetingRoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const message = useWorkHubToast();
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
  const [meetingSummary, setMeetingSummary] = useState(null);
  const [isLoadingRoom, setIsLoadingRoom] = useState(true);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [isPreviewVideoOn, setIsPreviewVideoOn] = useState(true);
  const [isPreviewAudioOn, setIsPreviewAudioOn] = useState(false);
  const [deviceOptions, setDeviceOptions] = useState(EMPTY_DEVICE_OPTIONS);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState("");
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState("");
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
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
  const displayMeetingId = displayMeeting?.id || displayMeeting?._id || id;

  const stopPreviewStream = useCallback(() => {
    previewStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    previewStreamRef.current = null;
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
  }, []);

  const loadDeviceOptions = useCallback(async () => {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) return;

    setIsLoadingDevices(true);
    try {
      const devices = normalizeMediaDevices(await mediaDevices.enumerateDevices());
      setDeviceOptions(devices);
      setSelectedAudioDeviceId((currentDeviceId) =>
        getPreferredDeviceId(currentDeviceId, devices.audioInputs),
      );
      setSelectedVideoDeviceId((currentDeviceId) =>
        getPreferredDeviceId(currentDeviceId, devices.videoInputs),
      );
    } catch {
      setPreviewError("Không thể đọc danh sách thiết bị của trình duyệt.");
    } finally {
      setIsLoadingDevices(false);
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
          setMeetingSummary(data.summary || null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.response?.data?.message || "Không thể tải thông tin cuộc họp");
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
    loadDeviceOptions();

    const mediaDevices = navigator.mediaDevices;
    mediaDevices?.addEventListener?.("devicechange", loadDeviceOptions);

    return () => {
      mediaDevices?.removeEventListener?.("devicechange", loadDeviceOptions);
    };
  }, [loadDeviceOptions]);

  useEffect(() => {
    const constraints = buildPreviewMediaConstraints({
      audioEnabled: isPreviewAudioOn,
      videoEnabled: isPreviewVideoOn,
      selectedAudioDeviceId,
      selectedVideoDeviceId,
    });

    if (isInRoom || !constraints) {
      stopPreviewStream();
      setPreviewError("");
      return undefined;
    }

    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
      stopPreviewStream();
      setPreviewError("Trình duyệt không hỗ trợ truy cập camera hoặc micro.");
      return undefined;
    }

    let cancelled = false;

    const startPreview = async () => {
      stopPreviewStream();
      setPreviewError("");

      try {
        const stream = await mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        previewStreamRef.current = stream;
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
          await previewVideoRef.current.play().catch(() => {});
        }
        await loadDeviceOptions();
      } catch {
        if (!cancelled) {
          stopPreviewStream();
          setPreviewError("Không thể mở camera hoặc micro. Hãy kiểm tra quyền trình duyệt.");
          await loadDeviceOptions();
        }
      }
    };

    startPreview();

    return () => {
      cancelled = true;
      stopPreviewStream();
    };
  }, [
    isInRoom,
    isPreviewAudioOn,
    isPreviewVideoOn,
    loadDeviceOptions,
    previewRefreshKey,
    selectedAudioDeviceId,
    selectedVideoDeviceId,
    stopPreviewStream,
  ]);

  const handleJoinNow = async () => {
    if (!id || isJoiningMeeting) return;

    setError("");

    try {
      const data = await joinMeeting(id);
      setRoomInfo(data.meeting);

      const participantToken = data.participant?.token;
      if (!participantToken) {
        throw new Error("Không nhận được token tham gia cuộc họp");
      }

      stopPreviewStream();

      await joinActiveMeeting({
        meeting: data.meeting,
        participantToken,
        defaults: buildJoinMediaDefaults({
          audioEnabled: isPreviewAudioOn,
          videoEnabled: isPreviewVideoOn,
        }),
        preferredDevices: {
          audioInputId: isPreviewAudioOn ? selectedAudioDeviceId : "",
          videoInputId: isPreviewVideoOn ? selectedVideoDeviceId : "",
        },
      });
    } catch (err) {
      setError(err.response?.data?.message || err?.message || "Không thể tham gia cuộc họp");
      setPreviewRefreshKey((currentKey) => currentKey + 1);
    }
  };

  const handleBackToList = () => {
    navigate("/meetings");
  };

  const handleCopyMeetingId = async () => {
    if (!displayMeetingId) return;

    try {
      await navigator.clipboard.writeText(String(displayMeetingId));
      message.copySuccess("Đã sao chép Meeting ID", String(displayMeetingId), {
        label: "Meeting ID",
        text: "Meeting ID của phòng hiện tại đã sẵn sàng để chia sẻ.",
      });
    } catch {
      message.info("Không thể sao chép tự động", {
        description:
          "Trình duyệt chưa cho phép truy cập clipboard. Bạn có thể sao chép Meeting ID trong phần tiêu đề phòng.",
      });
    }
  };

  const displayError = error || meetingJoinError;

  if (displayError && !displayMeeting && !isInRoom) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#f8f9fc] p-6">
        <Alert
          type="error"
          showIcon
          message="Không thể mở cuộc họp"
          description={displayError}
          action={<Button onClick={() => navigate("/meetings")}>Quay lại</Button>}
        />
      </div>
    );
  }

  if (isLoadingRoom && !displayMeeting) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-[#f8f9fc] text-slate-700">
        <Spin size="large" />
        <Text className="!text-slate-500">Đang tải thông tin phòng họp...</Text>
      </div>
    );
  }

  if (!isInRoom && displayMeeting?.status === "ended") {
    return (
      <div className="min-h-full bg-[#f8f9fc] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/meetings")}>
              Danh sách
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => window.location.reload()}
            >
              Làm mới
            </Button>
          </div>

          <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/70 sm:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  Meeting history
                </div>
                <Title level={2} className="!m-0 !text-2xl !font-bold !text-slate-950 sm:!text-3xl">
                  {displayMeeting?.title || "Cuộc họp WorkHub"}
                </Title>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span className="font-mono">ID: {displayMeetingId}</span>
                  <span>{displayMeeting?.startedAt ? formatMeetingDateTime(displayMeeting.startedAt) : ""}</span>
                  <Tooltip title="Sao chép Meeting ID">
                    <Button
                      size="small"
                      type="text"
                      icon={<CopyOutlined />}
                      onClick={handleCopyMeetingId}
                    />
                  </Tooltip>
                </div>
              </div>
              <Tag color="default">Đã kết thúc</Tag>
            </div>
          </section>

          <MeetingSummaryPanel summary={meetingSummary} meeting={displayMeeting} />
        </div>
      </div>
    );
  }

  if (!isInRoom) {
    return (
      <div className="min-h-full bg-[#f8f9fc] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/meetings")}>
              Danh sách cuộc họp
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => setPreviewRefreshKey((currentKey) => currentKey + 1)}
            >
              Làm mới preview
            </Button>
          </div>

          <section className="grid min-h-[calc(100dvh-190px)] gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
            <div className="flex min-w-0 flex-col gap-5">
              <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/70 sm:p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div className="min-w-0">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Phòng chờ
                    </div>
                    <Title level={2} className="!m-0 !text-2xl !font-bold !text-slate-950 sm:!text-3xl">
                      {displayMeeting?.title || "Cuộc họp WorkHub"}
                    </Title>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <span className="font-mono">ID: {displayMeetingId}</span>
                      <Tooltip title="Sao chép Meeting ID">
                        <Button
                          size="small"
                          type="text"
                          icon={<CopyOutlined />}
                          onClick={handleCopyMeetingId}
                        />
                      </Tooltip>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Kiểm tra thiết bị trước khi tham gia
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[28px] border border-slate-900 bg-slate-950 shadow-xl shadow-slate-300/70">
                <div className="relative aspect-video min-h-[320px] bg-slate-950">
                  {isPreviewVideoOn ? (
                    <video
                      ref={previewVideoRef}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.18),transparent_38%),#020617] text-white/70">
                      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-blue-600 text-4xl font-bold text-white shadow-lg shadow-blue-950/50">
                        {(displayMeeting?.title || "W").charAt(0).toUpperCase()}
                      </div>
                      <Text className="!text-white/70">Camera đang tắt</Text>
                    </div>
                  )}

                  <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-sm font-medium text-white backdrop-blur">
                      {isPreviewAudioOn ? <AudioOutlined /> : <AudioMutedOutlined />}
                      {isPreviewAudioOn ? "Micro bật" : "Micro tắt"}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-sm font-medium text-white backdrop-blur">
                      <VideoCameraOutlined />
                      {isPreviewVideoOn ? "Camera bật" : "Camera tắt"}
                    </span>
                  </div>
                </div>
              </div>

              {previewError && (
                <Alert type="warning" showIcon message={previewError} />
              )}
            </div>

            <aside className="flex min-w-0 flex-col gap-5">
              <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/70 sm:p-6">
                <div className="mb-5 flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                    <SettingOutlined className="text-lg" />
                  </div>
                  <div>
                    <h2 className="m-0 text-lg font-bold text-slate-950">
                      Thiết lập trước khi vào
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Trạng thái này sẽ được áp dụng khi bạn tham gia phòng họp.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          <VideoCameraOutlined />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-950">Camera</div>
                          <div className="text-xs text-slate-500">
                            {isPreviewVideoOn ? "Đang gửi hình ảnh preview" : "Sẽ tham gia không camera"}
                          </div>
                        </div>
                      </div>
                      <Switch checked={isPreviewVideoOn} onChange={setIsPreviewVideoOn} />
                    </div>
                    <Select
                      className="mt-4 w-full"
                      size="large"
                      value={selectedVideoDeviceId || undefined}
                      options={deviceOptions.videoInputs}
                      loading={isLoadingDevices}
                      placeholder="Chọn camera"
                      notFoundContent="Không tìm thấy camera"
                      onChange={setSelectedVideoDeviceId}
                    />
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          {isPreviewAudioOn ? <AudioOutlined /> : <AudioMutedOutlined />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-950">Micro</div>
                          <div className="text-xs text-slate-500">
                            {isPreviewAudioOn ? "Micro sẽ bật khi vào phòng" : "Sẽ tham gia ở trạng thái tắt tiếng"}
                          </div>
                        </div>
                      </div>
                      <Switch checked={isPreviewAudioOn} onChange={setIsPreviewAudioOn} />
                    </div>
                    <Select
                      className="mt-4 w-full"
                      size="large"
                      value={selectedAudioDeviceId || undefined}
                      options={deviceOptions.audioInputs}
                      loading={isLoadingDevices}
                      placeholder="Chọn micro"
                      notFoundContent="Không tìm thấy micro"
                      onChange={setSelectedAudioDeviceId}
                    />
                  </div>

                  <Button
                    block
                    icon={<ReloadOutlined />}
                    onClick={loadDeviceOptions}
                    loading={isLoadingDevices}
                  >
                    Tải lại danh sách thiết bị
                  </Button>
                </div>
              </section>

              {displayError && <Alert type="error" showIcon message={displayError} />}

              <section className="rounded-3xl border border-blue-100 bg-blue-50/80 p-5 sm:p-6">
                <h2 className="m-0 text-base font-bold text-slate-950">Sẵn sàng tham gia</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Bạn vẫn có thể đổi camera hoặc micro trong phòng họp sau khi tham gia.
                </p>
                <Button
                  block
                  size="large"
                  type="primary"
                  icon={<VideoCameraAddOutlined />}
                  loading={isJoiningMeeting}
                  onClick={handleJoinNow}
                  className="mt-5"
                >
                  Tham gia phòng họp
                </Button>
              </section>
            </aside>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
        <Button icon={<ArrowLeftOutlined />} onClick={handleBackToList}>
          Danh sách
        </Button>
        <div className="min-w-0 px-4 text-center">
          <div className="truncate text-sm font-semibold">
            {displayMeeting?.title || "Cuộc họp WorkHub"}
          </div>
          <div className="truncate text-xs text-white/60">ID: {displayMeetingId}</div>
        </div>
        <div className="w-[88px]" />
      </div>

      <MeetingUI meeting={meetingClient} />
    </div>
  );
}
