import { useEffect, useState } from "react";

export const useCallCountdown = (expiresAt) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) {
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [expiresAt]);

  if (!expiresAt) return null;
  const expiresTime = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresTime)) return null;
  return Math.max(0, Math.ceil((expiresTime - now) / 1000));
};
