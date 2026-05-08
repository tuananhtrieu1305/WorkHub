import { useState } from "react";
import {
  createMeeting as createMeetingApi,
  joinMeeting as joinMeetingApi,
} from "../../services/meetingService";
import { MeetingContext } from "./meetingContextValue";

export const MeetingProvider = ({ children }) => {
  const [meeting, setMeeting] = useState(null);
  const [participantToken, setParticipantToken] = useState(null);

  const createMeeting = async (payload) => {
    const data = await createMeetingApi(payload);
    setMeeting(data.meeting);
    setParticipantToken(data.participant?.token || null);
    return data;
  };

  const joinMeeting = async (meetingId) => {
    const data = await joinMeetingApi(meetingId);
    setMeeting(data.meeting);
    setParticipantToken(data.participant?.token || null);
    return data;
  };

  const clearMeetingSession = () => {
    setMeeting(null);
    setParticipantToken(null);
  };

  return (
    <MeetingContext.Provider
      value={{
        meeting,
        participantToken,
        createMeeting,
        joinMeeting,
        clearMeetingSession,
      }}
    >
      {children}
    </MeetingContext.Provider>
  );
};
