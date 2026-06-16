import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Meeting from "../models/Meeting.js";
import { processRecordingForMeetingId } from "../services/meetingAiSummaryService.js";

dotenv.config({ path: "../.env" });
dotenv.config();

await connectDB();

const meeting = await Meeting.findOne({
  cloudflareMeetingId: { $ne: "" },
  status: "ended",
})
  .sort({ updatedAt: -1 })
  .lean();

if (!meeting) {
  console.log("No ended meeting with a Cloudflare meeting ID found.");
  process.exit(0);
}

console.log("Processing latest meeting recording", {
  meetingId: String(meeting._id),
  cloudflareMeetingId: meeting.cloudflareMeetingId,
});

const result = await processRecordingForMeetingId(meeting.cloudflareMeetingId);
console.log("Recording summary result", result);

process.exit(0);
