export const stopMediaStream = (stream) => {
  stream?.getTracks?.().forEach((track) => track.stop());
};

export const requestCallMedia = async (mediaType, timeoutMs = 15000) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw { name: "NotAllowedError", message: "Media devices are unavailable" };
  }

  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject({ code: "timeout" });
    }, timeoutMs);
  });

  try {
    const stream = await Promise.race([
      navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mediaType === "video",
      }),
      timeoutPromise,
    ]);
    return stream;
  } finally {
    window.clearTimeout(timeoutId);
  }
};
