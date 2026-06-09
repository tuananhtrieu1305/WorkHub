import { Avatar, Button, Modal, Space, Typography } from "antd";
import {
  AudioOutlined,
  CloseOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { useCallCountdown } from "./callCountdown";
import { getAvatarUrl } from "../../utils/avatar";

const { Text, Title } = Typography;

export default function IncomingCallModal({
  call,
  caller,
  open,
  loading,
  onAccept,
  onDecline,
}) {
  const isVideo = call?.mediaType === "video";
  const avatarUrl = getAvatarUrl(caller?.avatar);
  const callerName = caller?.fullName || "Nguoi dung";
  const remainingSeconds = useCallCountdown(call?.ringingExpiresAt);

  return (
    <Modal open={open} footer={null} closable={false} centered width={360}>
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <Avatar size={72} src={avatarUrl || undefined}>
          {callerName.charAt(0).toUpperCase()}
        </Avatar>
        <div>
          <Title level={4} className="!mb-1">
            {callerName}
          </Title>
          <Text type="secondary">
            {isVideo ? "Dang goi video cho ban" : "Dang goi audio cho ban"}
          </Text>
          {remainingSeconds != null && (
            <div className="mt-1 text-xs text-slate-400">
              Con {remainingSeconds}s de tra loi
            </div>
          )}
        </div>
        <Space size="large">
          <Button
            danger
            shape="circle"
            size="large"
            icon={<CloseOutlined />}
            disabled={loading}
            onClick={onDecline}
          />
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={isVideo ? <VideoCameraOutlined /> : <AudioOutlined />}
            loading={loading}
            onClick={onAccept}
          />
        </Space>
        <Text className="!text-xs !text-slate-400">
          {loading ? "Dang kiem tra thiet bi..." : "Chon nghe hoac tu choi"}
        </Text>
      </div>
    </Modal>
  );
}
