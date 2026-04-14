const mongoose = require("mongoose");

const JobCampaignSchema = new mongoose.Schema({
  title: { type: String, required: true },
  job_title: { type: String, default: "" },
  department: { type: String, default: "General" },
  status: {
    type: String,
    enum: ["Draft", "Sourcing", "Evaluating", "Completed"],
    default: "Draft",
  },
  // Kanban pipeline stage (separate from AI evaluation status)
  kanban_stage: {
    type: String,
    enum: ["Sourcing", "Screening", "Interview", "Offer", "Hired"],
    default: "Sourcing",
  },
  generated_jd: { type: String },
  jd_analysis: { type: Object },
  // Suggested interview questions (generated with JD)
  interview_questions: [{ type: String }],
  // AI hiring recommendation (cached)
  ai_recommendation: { type: Object, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("JobCampaign", JobCampaignSchema);
