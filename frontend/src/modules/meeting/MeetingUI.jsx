import { useEffect, useRef } from "react";

export default function MeetingUI({ meeting }) {
  const meetingElementRef = useRef(null);

  useEffect(() => {
    if (!meetingElementRef.current || !meeting) return;

    meetingElementRef.current.meeting = meeting;
    meetingElementRef.current.mode = "fill";
    meetingElementRef.current.showSetupScreen = false;
  }, [meeting]);

  return (
    <div className="min-h-0 flex-1">
      <rtk-meeting ref={meetingElementRef} />
    </div>
  );
}
