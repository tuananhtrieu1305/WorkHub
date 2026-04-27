import { createContext, useContext } from "react";

export const MeetingContext = createContext(null);

export const useMeetingContext = () => {
  const context = useContext(MeetingContext);
  if (!context) {
    throw new Error("useMeetingContext must be used within MeetingProvider");
  }
  return context;
};
