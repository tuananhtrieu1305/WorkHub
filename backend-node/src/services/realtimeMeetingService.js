import ApiError from "../utils/apiError.js";

let serviceOverride = null;

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new ApiError(503, `Realtime meeting service is missing ${name}`);
  }
  return value;
};

export class RealtimeMeetingService {
  constructor() {
    this.accountId = requiredEnv("CLOUDFLARE_REALTIME_ACCOUNT_ID");
    this.appId = requiredEnv("CLOUDFLARE_REALTIME_APP_ID");
    this.apiToken = requiredEnv("CLOUDFLARE_REALTIME_API_TOKEN");
  }

  get baseUrl() {
    return `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/realtime/kit/${this.appId}`;
  }

  get headers() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiToken}`,
    };
  }

  async createMeeting({ title }) {
    const response = await fetch(`${this.baseUrl}/meetings`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        title: title || "WorkHub meeting",
      }),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false) {
      throw new ApiError(502, "Unable to create realtime meeting");
    }

    return json.result || json.data;
  }

  async createParticipantToken({ meetingId, user, role = "participant" }) {
    const presetName =
      role === "host"
        ? process.env.CLOUDFLARE_REALTIME_HOST_PRESET || "group_call_host"
        : process.env.CLOUDFLARE_REALTIME_PARTICIPANT_PRESET ||
          "group_call_host";

    const response = await fetch(
      `${this.baseUrl}/meetings/${meetingId}/participants`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          preset_name: presetName,
          custom_participant_id: String(user._id),
          name: user.fullName || user.email || "WorkHub user",
        }),
      },
    );

    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false) {
      throw new ApiError(502, "Unable to create meeting participant token");
    }

    return json.result || json.data;
  }
}

export const setRealtimeMeetingServiceOverride = (override) => {
  serviceOverride = override;
};

export const clearRealtimeMeetingServiceOverride = () => {
  serviceOverride = null;
};

export const getRealtimeMeetingService = () =>
  serviceOverride || new RealtimeMeetingService();
