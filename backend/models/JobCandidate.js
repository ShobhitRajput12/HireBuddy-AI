const mongoose = require("mongoose");

const JobCandidateSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "JobCampaign",
    required: true,
  },
  fileName: { type: String, required: true },
  status: {
    type: String,
    enum: ["UPLOADED", "AGENT_3_4_DONE", "AGENT_5_DONE", "AGENT_6_7_DONE", "COMPLETED"],
    default: "UPLOADED",
  },
  rawText: String,

  // Agent 3 & 4 (Combined Parse + Skill Validation)
  parsed_data: Object,
  validated_skills: Object,

  // Agent 5 (Match Engine)
  match_score: Number,
  match_results: Object,

  // Agent 6 & 7 (Counter + Debate Reconciliation)
  counter_analysis: Object,
  corrected_score: Number,
  debate_summary: String,
  final_score: Number,
  final_decision: String, // STRONG_YES | YES | MAYBE | NO

  // Agent 8 (Ranking Engine — native JS sort)
  rank: { type: Number, default: 0 },

  // Agent 9 (HR Final Review)
  hr_note: String,

  // ── NEW: Interview Pipeline ───────────────────────────────────
  interview_stage: {
    type: String,
    enum: ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"],
    default: "Applied",
  },

  // ── NEW: Recruiter Notes & Tags ──────────────────────────────
  notes: { type: String, default: "" },
  tags: [{ type: String }],
  ai_summary: { type: String, default: "" },

  // ── NEW: AI-generated Interview Questions (cached) ───────────
  interview_questions: { type: Object, default: null },

  // ── NEW: AI Rejection Insight (cached) ───────────────────────
  rejection_insight: { type: Object, default: null },

  // ── NEW: Resume Viewer URL ───────────────────────────────────
  resume_url: { type: String, default: "" },

  createdAt: { type: Date, default: Date.now },
});

// Virtual to expose campaignId as job_id for API consistency
JobCandidateSchema.virtual("job_id").get(function () {
  return this.campaignId;
});

JobCandidateSchema.set("toJSON", { virtuals: true });
JobCandidateSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("JobCandidate", JobCandidateSchema);
