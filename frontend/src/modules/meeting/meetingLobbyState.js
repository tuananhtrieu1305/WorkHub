const mapDeviceOptions = (devices, kind, fallbackLabel) =>
  devices
    .filter((device) => device.kind === kind && device.deviceId)
    .map((device, index) => ({
      value: device.deviceId,
      label: device.label || `${fallbackLabel} ${index + 1}`,
    }));

const buildDeviceConstraint = (deviceId) => {
  if (!deviceId) return true;
  return { deviceId: { exact: deviceId } };
};

export const normalizeMediaDevices = (devices = []) => ({
  audioInputs: mapDeviceOptions(devices, "audioinput", "Micro"),
  videoInputs: mapDeviceOptions(devices, "videoinput", "Camera"),
});

export const getPreferredDeviceId = (currentDeviceId, options = []) => {
  if (!options.length) return "";
  if (currentDeviceId && options.some((option) => option.value === currentDeviceId)) {
    return currentDeviceId;
  }
  return options[0].value;
};

export const buildPreviewMediaConstraints = ({
  audioEnabled,
  videoEnabled,
  selectedAudioDeviceId = "",
  selectedVideoDeviceId = "",
} = {}) => {
  if (!audioEnabled && !videoEnabled) return null;

  return {
    audio: audioEnabled ? buildDeviceConstraint(selectedAudioDeviceId) : false,
    video: videoEnabled ? buildDeviceConstraint(selectedVideoDeviceId) : false,
  };
};

export const buildJoinMediaDefaults = ({ audioEnabled, videoEnabled } = {}) => ({
  audio: Boolean(audioEnabled),
  video: Boolean(videoEnabled),
});
