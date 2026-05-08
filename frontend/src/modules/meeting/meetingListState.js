const toComparableId = (value) => {
  if (value == null) return "";
  return String(value);
};

const getMeetingTime = (meeting) => {
  const time = new Date(
    meeting?.createdAt || meeting?.startedAt || meeting?.updatedAt || 0,
  ).getTime();
  return Number.isFinite(time) ? time : 0;
};

const sortMeetingsByCreatedAt = (meetings) => {
  return [...meetings].sort((a, b) => getMeetingTime(b) - getMeetingTime(a));
};

export const upsertActiveMeeting = (meetings, incomingMeeting) => {
  if (!incomingMeeting?.id || incomingMeeting.status !== "active") {
    return meetings;
  }

  const incomingId = toComparableId(incomingMeeting.id);
  const existingIndex = meetings.findIndex(
    (meeting) => toComparableId(meeting.id || meeting._id) === incomingId,
  );

  if (existingIndex === -1) {
    return sortMeetingsByCreatedAt([incomingMeeting, ...meetings]);
  }

  const nextMeetings = [...meetings];
  nextMeetings[existingIndex] = {
    ...nextMeetings[existingIndex],
    ...incomingMeeting,
  };

  return sortMeetingsByCreatedAt(nextMeetings);
};

export const removeMeetingById = (meetings, meetingId) => {
  const removedId = toComparableId(meetingId);
  if (!removedId) return meetings;

  return meetings.filter(
    (meeting) => toComparableId(meeting.id || meeting._id) !== removedId,
  );
};
