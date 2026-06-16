import { useCallback, useEffect, useState } from "react";
import { Button, Checkbox, Empty, Form, Input, Skeleton, Tabs, Tag, Tooltip, Typography } from "antd";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarOutlined,
  CopyOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LoginOutlined,
  ReloadOutlined,
  TeamOutlined,
  VideoCameraAddOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { listMeetings } from "../../services/meetingService";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import {
  buildMeetingPath,
  formatMeetingDateTime,
} from "../../components/layout/notificationPanelState";
import { useMeetingContext } from "./meetingContextValue";
import {
  removeMeetingById,
  upsertActiveMeeting,
} from "./meetingListState";
import { useWorkHubToast } from "../../components/feedback/workHubToast";

const { Text, Title } = Typography;

const getMeetingId = (meeting) => meeting?.id || meeting?._id || "";

const getMeetingTime = (meeting) =>
  meeting?.startTime || meeting?.startedAt || meeting?.scheduledAt || meeting?.createdAt;

const toComparableId = (value) => {
  if (value == null) return "";
  return String(value._id || value.id || value);
};

const getSummaryTag = (meeting) => {
  if (meeting?.aiSummaryEnabled === false) {
    return (
      <Tag className="!m-0 !rounded-md !border-slate-200 !bg-slate-50 !px-2 !py-0.5 !text-slate-500">
        AI summary off
      </Tag>
    );
  }

  if (meeting?.summaryStatus === "completed") {
    return (
      <Tag className="!m-0 !rounded-md !border-blue-200 !bg-blue-50 !px-2 !py-0.5 !text-blue-700">
        AI summary ready
      </Tag>
    );
  }

  if (meeting?.summaryStatus === "processing") {
    return (
      <Tag className="!m-0 !rounded-md !border-amber-200 !bg-amber-50 !px-2 !py-0.5 !text-amber-700">
        AI processing
      </Tag>
    );
  }

  if (meeting?.summaryStatus === "failed") {
    return (
      <Tag className="!m-0 !rounded-md !border-red-200 !bg-red-50 !px-2 !py-0.5 !text-red-700">
        AI failed
      </Tag>
    );
  }

  return (
    <Tag className="!m-0 !rounded-md !border-slate-200 !bg-slate-50 !px-2 !py-0.5 !text-slate-600">
      No summary yet
    </Tag>
  );
};

export default function MeetingPage() {
  const navigate = useNavigate();
  const { createMeeting, joinMeeting } = useMeetingContext();
  const message = useWorkHubToast();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [form] = Form.useForm();
  const [joinForm] = Form.useForm();
  const [meetings, setMeetings] = useState([]);
  const [activeTab, setActiveTab] = useState("active");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const activeOrganizationId = toComparableId(
    user?.activeOrganization?.id ||
      user?.activeOrganization?._id ||
      user?.activeOrganizationId,
  );

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMeetings({
        page: 1,
        size: 12,
        status: activeTab === "history" ? "ended" : "active",
      });
      setMeetings(Array.isArray(data) ? data : data.content || []);
    } catch (error) {
      message.error(error.response?.data?.message || "Không thể tải danh sách cuộc họp", {
        description:
          "Danh sách phòng họp đang hoạt động chưa được đồng bộ. Hãy bấm Làm mới hoặc thử lại sau.",
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, message]);

  useEffect(() => {
    loadMeetings();
  }, [activeOrganizationId, loadMeetings]);

  useEffect(() => {
    if (!socket) return undefined;

    const isActiveOrganizationMeetingEvent = (meeting) =>
      toComparableId(meeting?.organizationId) === activeOrganizationId;

    const handleMeetingCreated = ({ meeting } = {}) => {
      if (!isActiveOrganizationMeetingEvent(meeting)) return;
      if (activeTab !== "active") return;
      setMeetings((currentMeetings) =>
        upsertActiveMeeting(currentMeetings, meeting),
      );
    };
    const handleMeetingEnded = ({ meeting } = {}) => {
      if (!isActiveOrganizationMeetingEvent(meeting)) return;
      if (activeTab === "active") {
        setMeetings((currentMeetings) =>
          removeMeetingById(currentMeetings, meeting?.id || meeting?._id),
        );
      } else {
        loadMeetings();
      }
    };
    const handleSummaryUpdated = ({ meeting } = {}) => {
      if (!isActiveOrganizationMeetingEvent(meeting)) return;
      if (activeTab === "history") loadMeetings();
    };

    socket.on("meeting_created", handleMeetingCreated);
    socket.on("meeting_ended", handleMeetingEnded);
    socket.on("meeting_ai_summary_updated", handleSummaryUpdated);

    return () => {
      socket.off("meeting_created", handleMeetingCreated);
      socket.off("meeting_ended", handleMeetingEnded);
      socket.off("meeting_ai_summary_updated", handleSummaryUpdated);
    };
  }, [activeOrganizationId, activeTab, loadMeetings, socket]);

  const handleCreate = async (values) => {
    setCreating(true);
    try {
      const createRequest = createMeeting({
        title: values.title.trim(),
        enableAiSummary: Boolean(values.enableAiSummary),
      });
      message.promise(createRequest, {
        loading: "Đang tạo cuộc họp",
        success: "Đã tạo cuộc họp",
        error: (error) =>
          error.response?.data?.message || "Không thể tạo cuộc họp",
        description: {
          loading: "WorkHub đang chuẩn bị phòng họp mới.",
          success: (data) =>
            message.details([
              { label: "Meeting ID", value: data?.meeting?.id },
            ]),
          error: "Vui lòng kiểm tra kết nối hoặc thử lại sau.",
        },
      });
      const data = await createRequest;
      navigate(`/meetings/${data.meeting.id}`);
    } catch (error) {
      console.error("Failed to create meeting:", error);
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (values) => {
    const meetingId = values.meetingId.trim();
    setJoining(true);
    try {
      const joinRequest = joinMeeting(meetingId);
      message.promise(joinRequest, {
        loading: "Đang tham gia cuộc họp",
        success: "Đã vào phòng họp",
        error: (error) =>
          error.response?.data?.message || "Không thể tham gia cuộc họp",
        description: {
          loading: message.details([{ label: "Meeting ID", value: meetingId }]),
          success: (data) =>
            message.details([
              { label: "Meeting ID", value: data?.meeting?.id || meetingId },
            ]),
          error: "Meeting ID có thể đã hết hạn hoặc bạn chưa có quyền truy cập.",
        },
      });
      const data = await joinRequest;
      navigate(`/meetings/${data.meeting?.id || meetingId}`);
    } catch (error) {
      console.error("Failed to join meeting:", error);
    } finally {
      setJoining(false);
    }
  };

  const handleCopyMeetingId = async (meetingId) => {
    if (!meetingId) return;

    try {
      await navigator.clipboard.writeText(meetingId);
      message.copySuccess("Đã sao chép Meeting ID", meetingId, {
        label: "Meeting ID",
        text: "Meeting ID đã nằm trong clipboard để bạn gửi cho người tham gia.",
      });
    } catch {
      message.info("Không thể sao chép tự động", {
        description:
          "Trình duyệt chưa cấp quyền clipboard. Bạn có thể sao chép Meeting ID trực tiếp trên thẻ cuộc họp.",
      });
    }
  };

  const renderMeetingList = () => {
    if (loading) {
      return (
        <div className="divide-y divide-slate-100">
          {[0, 1, 2].map((item) => (
            <div key={item} className="px-5 py-5">
              <Skeleton active avatar paragraph={{ rows: 2 }} title />
            </div>
          ))}
        </div>
      );
    }

    if (!meetings.length) {
      return (
        <div className="flex min-h-[260px] items-center justify-center px-5 py-10">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span className="text-slate-500">
                Chưa có cuộc họp đang hoạt động
              </span>
            }
          />
        </div>
      );
    }

    return (
      <div className="divide-y divide-slate-100">
        {meetings.map((meeting) => {
          const meetingId = getMeetingId(meeting);
          const meetingPath = buildMeetingPath(meeting);

          return (
            <article
              key={meetingId}
              className="group flex flex-col gap-4 px-5 py-5 transition hover:bg-slate-50/80 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex min-w-0 gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                  <VideoCameraOutlined className="text-xl" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={meetingPath}
                      className="truncate text-base font-semibold text-slate-950 transition hover:text-blue-600"
                    >
                      {meeting.title || "Cuộc họp WorkHub"}
                    </Link>
                    {activeTab === "active" ? (
                      <Tag className="!m-0 !rounded-md !border-emerald-200 !bg-emerald-50 !px-2 !py-0.5 !text-emerald-700">
                        Đang hoạt động
                      </Tag>
                    ) : (
                      getSummaryTag(meeting)
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarOutlined />
                      {formatMeetingDateTime(getMeetingTime(meeting))}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyMeetingId(meetingId)}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-md text-left font-mono text-xs text-slate-500 transition hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <span className="truncate">ID: {meetingId}</span>
                      <CopyOutlined />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 md:opacity-90 md:transition md:group-hover:opacity-100">
                <Tooltip title="Sao chép Meeting ID">
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => handleCopyMeetingId(meetingId)}
                  />
                </Tooltip>
                <Button
                  type={activeTab === "active" ? "primary" : "default"}
                  icon={activeTab === "active" ? <LoginOutlined /> : <FileTextOutlined />}
                  onClick={() => navigate(meetingPath)}
                >
                  {activeTab === "active" ? "Vào phòng chờ" : "Xem summary"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-full bg-[#f8f9fc] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] border border-white bg-white shadow-sm shadow-slate-200/70">
          <div className="flex flex-col gap-6 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_35%),linear-gradient(135deg,#ffffff_0%,#f3f7ff_100%)] p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Meetings
              </div>
              <Title level={1} className="!m-0 !text-3xl !font-bold !text-slate-950 sm:!text-4xl">
                Cuộc họp video
              </Title>
              <Text className="mt-3 block max-w-2xl !text-base !leading-7 !text-slate-600">
                Tạo phòng họp ngay tức thì
              </Text>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <TeamOutlined className="text-blue-600" />
                  {meetings.length}
                </div>
                <div className="text-xs text-slate-500">
                  {activeTab === "active" ? "phòng đang mở" : "cuộc họp đã xong"}
                </div>
              </div>
              <Button
                size="large"
                icon={<ReloadOutlined />}
                onClick={loadMeetings}
                loading={loading}
              >
                Làm mới
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="flex min-w-0 flex-col gap-5">
            <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/70 sm:p-6">
              <div className="mb-5 flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                  <VideoCameraAddOutlined className="text-xl" />
                </div>
                <div>
                  <h2 className="m-0 text-lg font-bold text-slate-950">Tạo cuộc họp mới</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Phòng chờ sẽ mở ngay sau khi tạo để bạn kiểm tra camera và micro.
                  </p>
                </div>
              </div>

              <Form
                form={form}
                layout="vertical"
                initialValues={{ enableAiSummary: false }}
                onFinish={handleCreate}
              >
                <Form.Item
                  label="Tiêu đề cuộc họp"
                  name="title"
                  rules={[{ required: true, message: "Nhập tiêu đề cuộc họp" }]}
                >
                  <Input
                    size="large"
                    maxLength={160}
                    placeholder="Ví dụ: Daily sync team Backend"
                  />
                </Form.Item>
                <Form.Item
                  name="enableAiSummary"
                  valuePropName="checked"
                  className="!mb-5"
                >
                  <Checkbox>Ghi âm và tạo AI summary sau cuộc họp</Checkbox>
                </Form.Item>
                <Button
                  type="primary"
                  size="large"
                  htmlType="submit"
                  icon={<VideoCameraAddOutlined />}
                  loading={creating}
                >
                  Tạo phòng họp
                </Button>
              </Form>
            </section>

            <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="m-0 text-lg font-bold text-slate-950">
                    {activeTab === "active" ? "Cuộc họp đang hoạt động" : "Lịch sử cuộc họp"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {activeTab === "active"
                      ? "Chọn một phòng để vào phòng chờ trước khi tham gia."
                      : "Xem lại cuộc họp đã kết thúc và kết quả AI summary."}
                  </p>
                </div>
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  items={[
                    {
                      key: "active",
                      label: (
                        <span className="inline-flex items-center gap-2">
                          <VideoCameraOutlined />
                          Đang diễn ra
                        </span>
                      ),
                    },
                    {
                      key: "history",
                      label: (
                        <span className="inline-flex items-center gap-2">
                          <HistoryOutlined />
                          Lịch sử
                        </span>
                      ),
                    },
                  ]}
                />
              </div>
              {renderMeetingList()}
            </section>
          </div>

          <aside className="flex min-w-0 flex-col gap-5">
            <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/70 sm:p-6">
              <div className="mb-5 flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <LoginOutlined className="text-lg" />
                </div>
                <div>
                  <h2 className="m-0 text-lg font-bold text-slate-950">Tham gia nhanh</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Nhập Meeting ID để mở phòng chờ và kiểm tra thiết bị.
                  </p>
                </div>
              </div>

              <Form form={joinForm} layout="vertical" onFinish={handleJoin}>
                <Form.Item
                  label="Meeting ID"
                  name="meetingId"
                  rules={[{ required: true, message: "Nhập Meeting ID" }]}
                >
                  <Input size="large" placeholder="Dán ID cuộc họp" />
                </Form.Item>
                <Button
                  block
                  size="large"
                  htmlType="submit"
                  icon={<LoginOutlined />}
                  loading={joining}
                >
                  Mở phòng chờ
                </Button>
              </Form>
            </section>

            <section className="rounded-3xl border border-blue-100 bg-blue-50/70 p-5 sm:p-6">
              <h2 className="m-0 text-base font-bold text-slate-950">
                Luồng tham gia đã được chuẩn hóa
              </h2>
              <div className="mt-5 space-y-4">
                {[
                  ["1", "Mở phòng chờ và tải thông tin cuộc họp"],
                  ["2", "Chọn camera, micro và bật/tắt thiết bị"],
                  ["3", "Tham gia phòng họp với thiết lập đã chọn"],
                ].map(([step, label]) => (
                  <div key={step} className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-blue-700 ring-1 ring-blue-100">
                      {step}
                    </div>
                    <p className="m-0 text-sm leading-7 text-slate-600">{label}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
