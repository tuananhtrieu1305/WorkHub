import { Button } from "antd";
import { AudioOutlined, PhoneOutlined, VideoCameraOutlined } from "@ant-design/icons";

export default function CallDock({
  call,
  isVisible,
  isEnding,
  onReturn,
  onEnd,
}) {
  if (!isVisible || !call?.id) return null;

  const isVideo = call.mediaType === "video";

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-xl">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white">
        {isVideo ? <VideoCameraOutlined /> : <AudioOutlined />}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900">
          {isVideo ? "Dang goi video" : "Dang goi audio"}
        </div>
        <div className="max-w-[180px] truncate text-xs text-slate-500">
          ID: {call.id}
        </div>
      </div>
      <Button size="small" type="primary" onClick={onReturn}>
        Quay lai
      </Button>
      <Button
        danger
        loading={isEnding}
        size="small"
        shape="circle"
        icon={<PhoneOutlined />}
        onClick={onEnd}
      />
    </div>
  );
}
