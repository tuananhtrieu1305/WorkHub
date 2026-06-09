import { Avatar, Button, Modal, Spin, Typography } from "antd";
import { CloseOutlined, VideoCameraOutlined, AudioOutlined } from "@ant-design/icons";
import { getCallStatusText } from "./callState";
import { useCallCountdown } from "./callCountdown";
import { getAvatarUrl } from "../../utils/avatar";

const { Text, Title } = Typography;

export default function OutgoingCallModal({
  call,
  callee,
  open,
  loading,
  onCancel,
}) {
  const isVideo = call?.mediaType === "video";
  const calleeName = callee?.fullName || "Nguoi dung";
  const avatarUrl = getAvatarUrl(callee?.avatar);
  const remainingSeconds = useCallCountdown(call?.ringingExpiresAt);

  return (
    <Modal open={open} footer={null} closable={false} centered width={360}>
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="relative">
          <Avatar size={72} src={avatarUrl || undefined}>
            {calleeName.charAt(0).toUpperCase()}
          </Avatar>
          <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow">
            {isVideo ? <VideoCameraOutlined /> : <AudioOutlined />}
          </span>
        </div>
        <div>
          <Title level={4} className="!mb-1">
            {calleeName}
          </Title>
          <Text type="secondary">{getCallStatusText(call)}</Text>
          {remainingSeconds != null && (
            <div className="mt-1 text-xs text-slate-400">
              Tu dong ket thuc sau {remainingSeconds}s
            </div>
          )}
        </div>
        <Spin spinning={Boolean(loading)} />
        <Button
          danger
          shape="circle"
          size="large"
          icon={<CloseOutlined />}
          onClick={onCancel}
        />
      </div>
    </Modal>
  );
}
