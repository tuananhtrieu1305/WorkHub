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
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-xl">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 text-white">
        <VideoCameraOutlined />
      </div>
      <div className="min-w-0">
        <div className="max-w-[220px] truncate text-sm font-semibold text-slate-900">
          {meeting.title || "WorkHub meeting"}
        </div>
        <div className="max-w-[220px] truncate text-xs text-slate-500">
          Meeting ID: {meeting.id}
        </div>
      </div>
      <Button size="small" type="primary" icon={<LoginOutlined />} onClick={onReturn}>
        Quay lai
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
