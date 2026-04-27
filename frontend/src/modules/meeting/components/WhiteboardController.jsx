import { useEffect } from "react";

export default function WhiteboardController({ meeting, hostId }) {
  useEffect(() => {
    if (!meeting || !hostId) return;

    let whiteboard = null;

    const lockWhiteboardToHost = () => {
      if (!whiteboard) return;

      whiteboard.sendData({
        eventName: "config",
        data: {
          eventName: "config",
          follow: hostId,
          role: "viewer",
          autoScale: true,
        },
      });
    };

    const findWhiteboardPlugin = () => {
      const activePlugins = meeting.plugins?.active;
      if (!activePlugins?.toArray) return null;
      return activePlugins.toArray().find((plugin) => plugin.name === "Whiteboard");
    };

    const configureIfAvailable = () => {
      whiteboard = findWhiteboardPlugin();
      if (!whiteboard) return false;

      const joinedParticipants = meeting.participants?.joined;
      const isHostAlreadyInRoom = joinedParticipants?.toArray
        ? joinedParticipants.toArray().some((participant) => participant.id === hostId)
        : false;

      if (isHostAlreadyInRoom) {
        lockWhiteboardToHost();
      }
      return true;
    };

    const handleParticipantJoined = (participant) => {
      if (participant.id === hostId) {
        lockWhiteboardToHost();
      }
    };

    meeting.participants.on("participantJoined", handleParticipantJoined);
    const intervalId = window.setInterval(() => {
      if (configureIfAvailable()) {
        window.clearInterval(intervalId);
      }
    }, 1000);

    configureIfAvailable();

    return () => {
      window.clearInterval(intervalId);
      meeting.participants.removeListener(
        "participantJoined",
        handleParticipantJoined,
      );
    };
  }, [meeting, hostId]);

  return null;
}
