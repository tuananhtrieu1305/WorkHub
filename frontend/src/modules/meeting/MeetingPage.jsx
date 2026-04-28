import { useEffect, useState } from "react";
import { Button, Card, Form, Input, List, Space, Tag, Typography, message } from "antd";
import { Link, useNavigate } from "react-router-dom";
import {
  LoginOutlined,
  ReloadOutlined,
  VideoCameraAddOutlined,
} from "@ant-design/icons";
import { getMeetings as listMeetings } from "../../api/meetingApi";
import { useMeetingContext } from "./meetingContextValue";

const { Title, Text } = Typography;

export default function MeetingPage() {
  const navigate = useNavigate();
  const { createMeeting, joinMeeting } = useMeetingContext();
  const [form] = Form.useForm();
  const [joinForm] = Form.useForm();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const loadMeetings = async () => {
    setLoading(true);
    try {
      const data = await listMeetings({ page: 1, limit: 10, status: "active" });
      setMeetings(data.content || []);
    } catch (error) {
      message.error(error.response?.data?.message || "Khong the tai danh sach cuoc goi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const handleCreate = async (values) => {
    setCreating(true);
    try {
      const data = await createMeeting({ title: values.title });
      message.success("Da tao cuoc goi");
      navigate(`/meetings/${data.meeting.id}`);
    } catch (error) {
      message.error(error.response?.data?.message || "Khong the tao cuoc goi");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (values) => {
    setJoining(true);
    try {
      await joinMeeting(values.meetingId.trim());
      navigate(`/meetings/${values.meetingId.trim()}`);
    } catch (error) {
      message.error(error.response?.data?.message || "Khong the tham gia cuoc goi");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Title level={2} className="!mb-1">
              Cuoc goi video
            </Title>
            <Text type="secondary">
              Tao phong RealtimeKit va dung bang trang trong cuoc goi.
            </Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={loadMeetings} loading={loading}>
            Lam moi
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <Card title="Tao cuoc goi" className="shadow-sm">
            <Form form={form} layout="vertical" onFinish={handleCreate}>
              <Form.Item
                label="Tieu de"
                name="title"
                rules={[{ required: true, message: "Nhap tieu de cuoc goi" }]}
              >
                <Input maxLength={160} placeholder="Vi du: Daily sync team Backend" />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                icon={<VideoCameraAddOutlined />}
                loading={creating}
              >
                Tao va tham gia
              </Button>
            </Form>
          </Card>

          <Card title="Tham gia bang ma phong" className="shadow-sm">
            <Form form={joinForm} layout="vertical" onFinish={handleJoin}>
              <Form.Item
                label="Meeting ID"
                name="meetingId"
                rules={[{ required: true, message: "Nhap meeting id" }]}
              >
                <Input placeholder="Mongo meeting id trong WorkHub" />
              </Form.Item>
              <Button htmlType="submit" icon={<LoginOutlined />} loading={joining}>
                Tham gia
              </Button>
            </Form>
          </Card>
        </div>

        <Card title="Cuoc goi dang hoat dong" className="mt-5 shadow-sm">
          <List
            loading={loading}
            dataSource={meetings}
            locale={{ emptyText: "Chua co cuoc goi dang hoat dong" }}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Link key="join" to={`/meetings/${item.id}`}>
                    Tham gia
                  </Link>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span>{item.title}</span>
                      <Tag color="green">{item.status}</Tag>
                    </Space>
                  }
                  description={`Meeting ID: ${item.id}`}
                />
              </List.Item>
            )}
          />
        </Card>
      </div>
    </div>
  );
}
