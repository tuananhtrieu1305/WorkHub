import { Button } from "antd";
import { LoginOutlined, PhoneOutlined, VideoCameraOutlined } from "@ant-design/icons";

export default function MeetingDock({
  meeting,
  isVisible,
  isEnding,
  onReturn,
  onLeave,
}) {
  if (!isVisible || !meeting?.id) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-xl shadow-slate-300/60">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
        <VideoCameraOutlined />
      </div>
      <div className="min-w-0">
        <div className="max-w-[220px] truncate text-sm font-semibold text-slate-900">
          {meeting.title || "Cuộc họp WorkHub"}
        </div>
        <div className="max-w-[220px] truncate text-xs text-slate-500">
          Meeting ID: {meeting.id}
        </div>
      </div>
      <Button size="small" type="primary" icon={<LoginOutlined />} onClick={onReturn}>
        Quay lại
      </Button>
      <Button
        danger
        loading={isEnding}
        size="small"
        shape="circle"
        icon={<PhoneOutlined />}
        onClick={onLeave}
      />
    </div>
  );
}
