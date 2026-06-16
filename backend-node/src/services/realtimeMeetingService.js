import ApiError from "../utils/apiError.js";

let serviceOverride = null;

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new ApiError(503, `Realtime meeting service is missing ${name}`);
  }
  return value;
};

const parseBooleanEnv = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
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

  buildAiMeetingConfig({
    recordOnStart = parseBooleanEnv(
      process.env.CLOUDFLARE_REALTIME_RECORD_ON_START,
      true,
    ),
    language = process.env.CLOUDFLARE_REALTIME_TRANSCRIPTION_LANGUAGE || "vi",
    wordLimit = Number.parseInt(
      process.env.CLOUDFLARE_REALTIME_SUMMARY_WORD_LIMIT || "500",
      10,
    ),
    textFormat = process.env.CLOUDFLARE_REALTIME_SUMMARY_TEXT_FORMAT || "markdown",
    summaryType =
      process.env.CLOUDFLARE_REALTIME_SUMMARY_TYPE || "team_meeting",
  } = {}) {
    return {
      record_on_start: recordOnStart,
      transcribe_on_end: true,
      summarize_on_end: true,
      ai_config: {
        transcription: {
          language,
        },
        summarization: {
          word_limit: Number.isFinite(wordLimit) ? wordLimit : 500,
          text_format: textFormat,
          summary_type: summaryType,
        },
      },
    };
  }

  async createMeeting({ title, enableAiSummary = false, aiConfig = {} }) {
    const body = {
      title: title || "WorkHub meeting",
      ...(enableAiSummary ? this.buildAiMeetingConfig(aiConfig) : {}),
    };

    const response = await fetch(`${this.baseUrl}/meetings`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false) {
      throw new ApiError(
        502,
        json?.errors?.[0]?.message ||
          json?.error?.message ||
          "Unable to create realtime meeting",
      );
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

  async refreshParticipantToken({ meetingId, participantId }) {
    const response = await fetch(
      `${this.baseUrl}/meetings/${meetingId}/participants/${participantId}/token`,
      {
        method: "POST",
        headers: this.headers,
      },
    );

    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false) {
      throw new ApiError(502, "Unable to refresh meeting participant token");
    }

    return json.result || json.data;
  }

  async kickParticipantFromActiveSession({ meetingId, customParticipantId }) {
    const response = await fetch(
      `${this.baseUrl}/meetings/${meetingId}/active-session/kick`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          custom_participant_ids: [String(customParticipantId)],
        }),
      },
    );

    if (response.status === 404) {
      return null;
    }

    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false) {
      throw new ApiError(502, "Unable to remove stale meeting participant session");
    }

    return json.result || json.data;
  }

  async kickAllParticipants({ meetingId }) {
    const response = await fetch(
      `${this.baseUrl}/meetings/${meetingId}/active-session/kick-all`,
      {
        method: "POST",
        headers: this.headers,
      },
    );

    if (response.status === 404) {
      return null;
    }

    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false) {
      throw new ApiError(502, "Unable to end realtime meeting session");
    }

    return json.result || json.data;
  }

  async listRecordings({ meetingId, status = [], perPage = 5 } = {}) {
    const params = new URLSearchParams();
    if (meetingId) params.set("meeting_id", meetingId);
    if (perPage) params.set("per_page", String(perPage));
    status.forEach((item) => params.append("status", item));

    const response = await fetch(`${this.baseUrl}/recordings?${params.toString()}`, {
      method: "GET",
      headers: this.headers,
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false) {
      throw new ApiError(
        502,
        json?.errors?.[0]?.message || "Unable to fetch realtime meeting recordings",
      );
    }

    return json.result || json.data || [];
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
