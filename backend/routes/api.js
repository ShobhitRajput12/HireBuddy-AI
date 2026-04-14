/**
 * routes/api.js
 *
 * Unified API endpoints for the 9-agent recruitment pipeline.
 *
 * POST /api/job/create           → Agent 1 (JD Creator) + Agent 2 (JD Analyzer)
 * POST /api/candidate/upload     → Upload CVs + Agent 3+4 (CV Validator) immediately
 * POST /api/process              → Agents 5-9 on all pending candidates for a job
 * GET  /api/results/:jobId       → Ranked results with all evaluation data
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

function cleanFileName(fileName) {
  if (!fileName) return "Unknown Candidate";
  // Remove extension
  let name = fileName.replace(/\.[^/.]+$/, "");
  // Remove "WhatsApp Image YYYY-MM-DD at HH.MM.SS" pattern
  name = name.replace(/WhatsApp Image \d{4}-\d{2}-\d{2} at \d{1,2}\.\d{2}\.\d{2}/g, "");
  // Remove " (1)", " (2)" etc
  name = name.replace(/ \(\d+\)/g, "");
  // Remove generic prefixes
  name = name.replace(/^(Scan|Image|Resume|CV|Document)[_\-\s]*/i, "");
  // Clean up remaining dashes/underscores and double spaces
  name = name.replace(/[_\-]+/g, " ").replace(/\s\s+/g, " ").trim();
  
  return name || "Candidate";
}
const router = express.Router();

const JobCampaign = require("../models/JobCampaign");
const JobCandidate = require("../models/JobCandidate");
const Comment = require("../models/Comment");
const extractText = require("../utils/extractText");

// Agents
const createJD = require("../lib/agents/jdCreator");
const analyzeJD = require("../lib/agents/jdAnalyzer");
const cvValidator = require("../lib/agents/cvValidator");
const extractIdentity = require("../lib/agents/identityExtractor"); // NEW
const matchEngine = require("../lib/agents/matchEngine");
const debateReconcile = require("../lib/agents/debateReconciler");
const hrReview = require("../lib/agents/hrReviewer");
const generateInterviewQuestions = require("../lib/agents/interviewQuestionsAgent");
const generateRejectionInsight = require("../lib/agents/rejectionInsightAgent");
const generateRecommendation = require("../lib/agents/recommendationAgent");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/job/create
// Body: { title, prompt, department? }
//
// Runs Agent 1 (JD Creator) and Agent 2 (JD Analyzer) in sequence,
// persists the campaign, and returns it ready for CV uploads.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/job/create", async (req, res) => {
  try {
    const { title, prompt, department } = req.body;
    if (!title || !prompt) {
      return res.status(400).json({ error: "title and prompt are required." });
    }

    console.log("[Agent 1] JD Creator: generating JD from prompt...");
    const generated = await createJD(prompt);

    console.log("[Agent 2] JD Analyzer: extracting requirements and weightage...");
    const jdAnalysis = await analyzeJD(generated.full_jd_text);

    const campaign = await JobCampaign.create({
      title,
      department: department || "General",
      job_title: generated.job_title || title,
      generated_jd: generated.full_jd_text,
      jd_analysis: jdAnalysis,
      status: "Sourcing",
    });

    res.status(201).json({
      success: true,
      job: {
        id: campaign._id,
        title: campaign.title,
        job_title: campaign.job_title,
        department: campaign.department,
        status: campaign.status,
        generated_jd: campaign.generated_jd,
        jd_analysis: campaign.jd_analysis,
      },
    });
  } catch (err) {
    console.error("[POST /api/job/create]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/campaigns
//
// Fetches all campaigns to display on the main dashboard.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/campaigns", async (req, res) => {
  try {
    const campaigns = await JobCampaign.find().sort({ createdAt: -1 });

    // Enrich each campaign with candidate count and shortlist count
    const enriched = await Promise.all(
      campaigns.map(async (c) => {
        const total = await JobCandidate.countDocuments({ campaignId: c._id });
        const shortlisted = await JobCandidate.countDocuments({
          campaignId: c._id,
          final_decision: { $in: ["STRONG_YES", "YES"] },
        });
        return { ...c.toObject(), candidateCount: total, shortlisted };
      })
    );

    res.json({ success: true, campaigns: enriched });
  } catch (err) {
    console.error("[GET /api/campaigns]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/campaign/:id
//
// Deletes a campaign and all associated candidates.
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/campaign/:id", async (req, res) => {
  try {
    const campaign = await JobCampaign.findByIdAndDelete(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found." });
    await JobCandidate.deleteMany({ campaignId: req.params.id });
    res.json({ success: true, message: "Campaign and all candidates deleted." });
  } catch (err) {
    console.error("[DELETE /api/campaign]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/candidate/upload
// Form-data: jobId (text field) + resumes (files, up to 50)
//
// Extracts text from each file, stores the candidate, then immediately runs
// Agent 3+4 (CV Validator). Saves after each file so a crash mid-batch
// doesn't lose already-processed candidates.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/candidate/upload", upload.array("resumes", 50), async (req, res) => {
  try {
    const { jobId } = req.body;
    if (!jobId) return res.status(400).json({ error: "jobId is required." });

    const campaign = await JobCampaign.findById(jobId);
    if (!campaign) return res.status(404).json({ error: "Job not found." });
    if (!campaign.jd_analysis) {
      return res.status(400).json({
        error: "JD analysis is missing. Create the job via POST /api/job/create first.",
      });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: "No resume files provided." });
    }

    const results = [];

    for (const file of files) {
      // Save with UPLOADED status first — this record persists even if Agent 3+4 fails
      let candidate;
      try {
        // Read file from disk for text extraction
        const fileBuffer = fs.readFileSync(file.path);
        const rawText = await extractText({ buffer: fileBuffer, mimetype: file.mimetype, originalname: file.originalname });
        
        candidate = await JobCandidate.create({
          campaignId: campaign._id,
          fileName: file.originalname,
          resume_url: `/uploads/${file.filename}`, // Relative URL for frontend
          rawText,
          status: "UPLOADED",
        });
      } catch (err) {
        console.error(`[upload] Text extraction failed for ${file.originalname}:`, err.message);
        results.push({ fileName: file.originalname, error: `Text extraction failed: ${err.message}` });
        continue;
      }

      // Immediately parse + validate (Agent 3+4)
      try {
        console.log(`[Agent 3+4] CV Validator: parsing ${file.originalname}...`);
        
        // Step A: Extract Identity (Name/Contact/Socials)
        const identityData = await extractIdentity(candidate.rawText).catch(e => {
          console.error("[Identity] Failed:", e.message);
          return {};
        });

        // Step B: Extract Capability (Biased-neutral skills/exp)
        const { parsed_data, validated_skills } = await cvValidator(candidate.rawText);
        
        // Merge them into parsed_data
        candidate.parsed_data = { ...parsed_data, ...identityData };
        candidate.validated_skills = validated_skills;
        candidate.status = "AGENT_3_4_DONE";
        await candidate.save();

        results.push({
          fileName: file.originalname,
          candidateId: candidate._id,
          status: candidate.status,
        });
      } catch (err) {
        // Keep the record at UPLOADED so /api/process can retry it
        console.error(`[Agent 3+4] Failed for ${file.originalname}:`, err.message);
        results.push({
          fileName: file.originalname,
          candidateId: candidate._id,
          status: "UPLOADED",
          error: `CV parsing failed: ${err.message}`,
        });
      }
    }

    res.json({ success: true, uploaded: results });
  } catch (err) {
    console.error("[POST /api/candidate/upload]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/process
// Body: { jobId }
//
// Runs the full pipeline on ALL pending candidates for a job:
//   • Re-runs Agent 3+4 on any still at UPLOADED (retry after upload failure)
//   • Agent 5  – Match Engine
//   • Agent 6+7 – Counter + Debate Reconciler
//   • Agent 8  – Native JS sort (no API cost)
//   • Agent 9  – HR Review (top 5 only)
//
// Processes ONE candidate at a time to avoid rate limits.
// Saves after each agent step — pipeline can be safely re-run after a crash.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/process", async (req, res) => {
  try {
    const { jobId } = req.body;
    if (!jobId) return res.status(400).json({ error: "jobId is required." });

    const campaign = await JobCampaign.findById(jobId);
    if (!campaign) return res.status(404).json({ error: "Job not found." });
    if (!campaign.jd_analysis) {
      return res.status(400).json({
        error: "JD analysis is missing. Create the job via POST /api/job/create.",
      });
    }

    // Only pick up candidates that haven't fully finished yet
    const pending = await JobCandidate.find({
      campaignId: campaign._id,
      status: { $in: ["UPLOADED", "AGENT_3_4_DONE", "AGENT_5_DONE", "AGENT_6_7_DONE"] },
    });

    if (pending.length === 0) {
      return res.status(400).json({
        error: "No candidates are pending evaluation. Upload CVs first via POST /api/candidate/upload.",
      });
    }

    campaign.status = "Evaluating";
    await campaign.save();

    let processed = 0;
    let failed = 0;

    // ── Per-candidate pipeline (one by one) ──────────────────────────────────
    for (const candidate of pending) {
      try {
        // Agent 3+4 retry for candidates stuck at UPLOADED
        if (candidate.status === "UPLOADED") {
          console.log(`[Agent 3+4] CV Validator: re-parsing ${candidate.fileName}...`);
          const { parsed_data, validated_skills } = await cvValidator(candidate.rawText);
          candidate.parsed_data = parsed_data;
          candidate.validated_skills = validated_skills;
          candidate.status = "AGENT_3_4_DONE";
          await candidate.save();
        }

        // Agent 5: Match Engine
        if (candidate.status === "AGENT_3_4_DONE") {
          console.log(`[Agent 5] Match Engine: scoring ${candidate.fileName}...`);
          const match_results = await matchEngine(
            candidate.validated_skills,
            campaign.jd_analysis
          );
          candidate.match_score = match_results.match_score;
          candidate.match_results = match_results;
          candidate.status = "AGENT_5_DONE";
          await candidate.save();
        }

        // Agent 6+7: Counter + Debate Reconciler
        if (candidate.status === "AGENT_5_DONE") {
          console.log(`[Agent 6+7] Debate Reconciler: cross-validating ${candidate.fileName}...`);
          const debate = await debateReconcile(
            candidate.match_results,
            candidate.validated_skills,
            campaign.jd_analysis
          );
          candidate.counter_analysis = debate.counter_analysis;
          // Safe fallback: use match_score if debate scores are missing
          candidate.corrected_score =
            debate.counter_analysis?.corrected_score ?? candidate.match_score;
          candidate.debate_summary = debate.debate_summary;
          candidate.final_score = debate.final_agreed_score ?? candidate.match_score;
          candidate.final_decision = debate.final_decision;
          candidate.status = "AGENT_6_7_DONE";
          await candidate.save();
        }

        processed++;
      } catch (err) {
        // Log and continue — one bad CV must not crash the entire batch
        failed++;
        console.error(`[/api/process] Failed on ${candidate.fileName}:`, err.message);
      }
    }

    // ── Agent 8: Ranking (native JS — no API call needed) ────────────────────
    console.log("[Agent 8] Ranking Engine: sorting all evaluated candidates...");
    const evaluated = await JobCandidate.find({
      campaignId: campaign._id,
      status: "AGENT_6_7_DONE",
    });

    const sorted = evaluated.sort((a, b) => (b.final_score || 0) - (a.final_score || 0));

    if (sorted.length === 0) {
      campaign.status = "Sourcing"; // Roll back — nothing to finalize
      await campaign.save();
      return res.status(500).json({
        error: `All ${failed} candidate(s) failed evaluation. Check server logs.`,
      });
    }

    // ── Agent 9: HR Review (top 5 only to control API usage) ─────────────────
    console.log("[Agent 9] HR Reviewer: writing hiring notes for top candidates...");
    for (let i = 0; i < sorted.length; i++) {
      const cand = sorted[i];
      try {
        if (i < 5) {
          const hrNote = await hrReview(cand, campaign.jd_analysis);
          cand.hr_note = hrNote.summary_note;
        } else {
          cand.hr_note = "Outside top 5 — lower priority. Auto-reviewed.";
        }
      } catch (err) {
        console.error(`[Agent 9] HR review failed for ${cand.fileName}:`, err.message);
        cand.hr_note = "HR review unavailable.";
      }

      cand.rank = i + 1;
      cand.status = "COMPLETED";
      await cand.save();
    }

    campaign.status = "Completed";
    await campaign.save();

    res.json({
      success: true,
      message: `Pipeline complete.`,
      jobId,
      evaluated: sorted.length,
      failed,
    });
  } catch (err) {
    console.error("[POST /api/process]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/results/:jobId
//
// Returns the job details and all candidates sorted by rank.
// rawText is excluded to keep the response size manageable.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/results/:jobId", async (req, res) => {
  try {
    const campaign = await JobCampaign.findById(req.params.jobId);
    if (!campaign) return res.status(404).json({ error: "Job not found." });

    const candidates = await JobCandidate.find({ campaignId: campaign._id })
      .sort({ rank: 1, final_score: -1 })
      .select("-rawText"); // omit raw CV text

    // Build decision-tier breakdown for the summary header
    const shortlisted = candidates.filter(
      (c) => c.final_decision === "STRONG_YES" || c.final_decision === "YES"
    );
    const maybes = candidates.filter((c) => c.final_decision === "MAYBE");
    const rejected = candidates.filter((c) => c.final_decision === "NO");

    res.json({
      success: true,
      job: {
        id: campaign._id,
        title: campaign.title,
        job_title: campaign.job_title,
        department: campaign.department,
        status: campaign.status,
        generated_jd: campaign.generated_jd,
        jd_analysis: campaign.jd_analysis,
      },
      summary: {
        total: candidates.length,
        shortlisted: shortlisted.length,
        maybes: maybes.length,
        rejected: rejected.length,
      },
      candidates,
    });
  } catch (err) {
    console.error("[GET /api/results]", err.message);
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/campaign/:id/stage
// Body: { kanban_stage }
// Moves a campaign card to a different Kanban column.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/campaign/:id/stage", async (req, res) => {
  try {
    const { kanban_stage } = req.body;
    const allowed = ["Sourcing", "Screening", "Interview", "Offer", "Hired"];
    if (!allowed.includes(kanban_stage)) {
      return res.status(400).json({ error: `Invalid stage. Allowed: ${allowed.join(", ")}` });
    }
    const campaign = await JobCampaign.findByIdAndUpdate(
      req.params.id,
      { kanban_stage },
      { new: true }
    );
    if (!campaign) return res.status(404).json({ error: "Campaign not found." });
    res.json({ success: true, campaign });
  } catch (err) {
    console.error("[PATCH /api/campaign/stage]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/candidate/:id
// Permanently removes a candidate and their associated resume file.
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/candidate/:id", async (req, res) => {
  try {
    const candidate = await JobCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    // Clean up file system if resume exists
    if (candidate.resume_url) {
      const filePath = path.join(__dirname, "..", candidate.resume_url);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.error("[DELETE /api/candidate] File unlink failed:", unlinkErr.message);
        }
      }
    }

    await JobCandidate.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Candidate and associated data deleted." });
  } catch (err) {
    console.error("[DELETE /api/candidate]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/candidate/:id
// Full candidate profile including populated campaign info.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/candidate/:id", async (req, res) => {
  try {
    const candidate = await JobCandidate.findById(req.params.id).select("-rawText");
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    const campaign = await JobCampaign.findById(candidate.campaignId).select("title department kanban_stage jd_analysis");
    res.json({ success: true, candidate, campaign });
  } catch (err) {
    console.error("[GET /api/candidate/:id]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/candidate/:id/rename
// Body: { full_name }
// Manually updates a candidate's display name.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/candidate/:id/rename", async (req, res) => {
  try {
    const { full_name } = req.body;
    if (!full_name || !full_name.trim()) return res.status(400).json({ error: "Name is required." });
    
    const candidate = await JobCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    
    candidate.parsed_data = { ...(candidate.parsed_data || {}), full_name: full_name.trim() };
    await candidate.save();
    
    res.json({ success: true, full_name: candidate.parsed_data.full_name });
  } catch (err) {
    console.error("[PATCH /api/candidate/rename]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/candidate/:id/stage
// Body: { interview_stage }
// Advances a candidate through the interview pipeline.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/candidate/:id/stage", async (req, res) => {
  try {
    const { interview_stage } = req.body;
    const allowed = ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"];
    if (!allowed.includes(interview_stage)) {
      return res.status(400).json({ error: "Invalid interview stage." });
    }
    const cand = await JobCandidate.findByIdAndUpdate(
      req.params.id,
      { interview_stage },
      { new: true }
    ).select("-rawText");
    if (!cand) return res.status(404).json({ error: "Candidate not found." });
    res.json({ success: true, candidate: cand });
  } catch (err) {
    console.error("[PATCH /api/candidate/stage]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/candidate/:id/notes
// Body: { notes, tags? }
// Saves recruiter notes and optional tags to a candidate.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/candidate/:id/notes", async (req, res) => {
  try {
    const { notes, tags } = req.body;
    const update = {};
    if (notes !== undefined) update.notes = notes;
    if (tags !== undefined) update.tags = tags;
    const cand = await JobCandidate.findByIdAndUpdate(req.params.id, update, { new: true }).select("-rawText");
    if (!cand) return res.status(404).json({ error: "Candidate not found." });
    res.json({ success: true, candidate: cand });
  } catch (err) {
    console.error("[PATCH /api/candidate/notes]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/candidates/bulk
// Body: { ids: string[], action: "reject" | "stage", interview_stage? }
// Bulk operations on multiple candidates.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/candidates/bulk", async (req, res) => {
  try {
    const { ids, action, interview_stage } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array is required." });
    }
    let update = {};
    if (action === "reject") {
      update = { final_decision: "NO", interview_stage: "Rejected" };
    } else if (action === "stage" && interview_stage) {
      update = { interview_stage };
    } else {
      return res.status(400).json({ error: "Invalid action or missing interview_stage." });
    }
    await JobCandidate.updateMany({ _id: { $in: ids } }, update);
    res.json({ success: true, updated: ids.length });
  } catch (err) {
    console.error("[POST /api/candidates/bulk]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics
// Aggregates cross-campaign metrics for the analytics dashboard.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/analytics", async (req, res) => {
  try {
    const campaigns = await JobCampaign.find().sort({ createdAt: -1 });
    const allCandidates = await JobCandidate.find().select("-rawText");

    // Funnel: count candidates per interview stage
    const stages = ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"];
    const funnel = {};
    for (const s of stages) {
      funnel[s] = allCandidates.filter(c => c.interview_stage === s).length;
    }
    // Default: anyone without explicit stage is Applied
    funnel["Applied"] += allCandidates.filter(c => !c.interview_stage).length;

    // Decision distribution
    const decisions = { STRONG_YES: 0, YES: 0, MAYBE: 0, NO: 0, PENDING: 0 };
    for (const c of allCandidates) {
      if (c.final_decision && decisions[c.final_decision] !== undefined) {
        decisions[c.final_decision]++;
      } else if (!c.final_decision) {
        decisions.PENDING++;
      }
    }

    // Avg score per campaign
    const campaignScores = await Promise.all(campaigns.map(async (camp) => {
      const campCands = allCandidates.filter(c => c.campaignId?.toString() === camp._id.toString());
      const scored = campCands.filter(c => c.final_score != null);
      const avg = scored.length ? Math.round(scored.reduce((s, c) => s + c.final_score, 0) / scored.length) : null;
      return { id: camp._id, title: camp.title, department: camp.department, candidateCount: campCands.length, avgScore: avg };
    }));

    // Top demanded skills across all JD analyses
    const skillMap = {};
    for (const camp of campaigns) {
      const skills = camp.jd_analysis?.must_have_skills || camp.jd_analysis?.required_skills || [];
      for (const skill of skills) {
        const name = typeof skill === "string" ? skill : skill.name;
        if (name) skillMap[name] = (skillMap[name] || 0) + 1;
      }
    }
    const topSkills = Object.entries(skillMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Conversion rates
    const totalCandidates = allCandidates.length;
    const shortlisted = allCandidates.filter(c => ["STRONG_YES", "YES"].includes(c.final_decision)).length;
    const interviewed = allCandidates.filter(c => c.interview_stage === "Interview").length;
    const hired = allCandidates.filter(c => c.interview_stage === "Hired").length;

    res.json({
      success: true,
      summary: {
        totalCampaigns: campaigns.length,
        totalCandidates,
        shortlisted,
        interviewed,
        hired,
        conversionRate: totalCandidates > 0 ? Math.round((shortlisted / totalCandidates) * 100) : 0,
      },
      funnel,
      decisions,
      campaignScores,
      topSkills,
    });
  } catch (err) {
    console.error("[GET /api/analytics]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/job/:id/public
// Public endpoint — returns campaign title, JD text, required skills.
// No auth required (used by public job application page).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/job/:id/public", async (req, res) => {
  try {
    const campaign = await JobCampaign.findById(req.params.id).select(
      "title job_title department generated_jd jd_analysis kanban_stage createdAt"
    );
    if (!campaign) return res.status(404).json({ error: "Job not found." });
    res.json({ success: true, campaign });
  } catch (err) {
    console.error("[GET /api/job/public]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/job/:id/apply
// Public endpoint — candidate submits application form + resume file.
// Form-data: name, email, phone, years_experience, resume (file)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/job/:id/apply", upload.single("resume"), async (req, res) => {
  try {
    const campaign = await JobCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Job not found." });

    // Check if applications are closed (stage moved past Sourcing)
    if (campaign.kanban_stage && campaign.kanban_stage !== "Sourcing") {
      return res.status(400).json({ error: "Applications for this role are now closed." });
    }

    if (!req.file) return res.status(400).json({ error: "Resume file is required." });

    const { name, email, phone, years_experience } = req.body;
    const fileBuffer = fs.readFileSync(req.file.path);
    const rawText = await extractText({ buffer: fileBuffer, mimetype: req.file.mimetype, originalname: req.file.originalname });

    // Create candidate with applicant info pre-filled in parsed_data
    const candidate = await JobCandidate.create({
      campaignId: campaign._id,
      fileName: req.file.originalname,
      resume_url: `/uploads/${req.file.filename}`,
      rawText,
      status: "UPLOADED",
      interview_stage: "Applied",
      parsed_data: {
        full_name: name || req.file.originalname,
        email: email || "",
        phone: phone || "",
        years_experience: Number(years_experience) || null,
      },
    });

    // Trigger Agent 3+4 and Identity Extraction in background
    (async () => {
      try {
        console.log(`[apply] Processing ${candidate.fileName}...`);
        
        // Step A: Extract Identity (Name/Contact/Socials) if not fully provided
        const contentIdentity = await extractIdentity(rawText).catch(() => ({}));
        
        // Step B: Extract Capability
        const { parsed_data: capabilityData, validated_skills } = await cvValidator(rawText);
        
        // Merge: User input > AI Extraction > Fallbacks
        candidate.parsed_data = {
          ...capabilityData,
          ...contentIdentity,
          full_name: name || contentIdentity.full_name || candidate.fileName.split('.')[0],
          email: email || contentIdentity.email || "",
          phone: phone || contentIdentity.phone || "",
        };
        candidate.validated_skills = validated_skills;
        candidate.status = "COMPLETED"; // Public applies skip Agent 5-9 processing for immediate visibility? 
        // Actually, keep status as is if they need Agent 5-9 processing later.
        // But the user usually wants to see them immediately.
        await candidate.save();
      } catch (err) {
        console.error("[apply] Background processing failed:", err.message);
      }
    })();

    res.status(201).json({
      success: true,
      message: "Application submitted successfully!",
      candidateId: candidate._id,
    });
  } catch (err) {
    console.error("[POST /api/job/apply]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/candidate/:id/comments
// Returns all recruiter comments for a candidate.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/candidate/:id/comments", async (req, res) => {
  try {
    const comments = await Comment.find({ candidateId: req.params.id }).sort({ createdAt: 1 });
    res.json({ success: true, comments });
  } catch (err) {
    console.error("[GET /comments]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/candidate/:id/comments
// Body: { author?, body }
// Adds a new comment to a candidate.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/candidate/:id/comments", async (req, res) => {
  try {
    const { author, body } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ error: "Comment body is required." });
    const comment = await Comment.create({
      candidateId: req.params.id,
      author: author?.trim() || "Recruiter",
      body: body.trim(),
    });
    res.status(201).json({ success: true, comment });
  } catch (err) {
    console.error("[POST /comments]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/candidate/:id/interview-questions
// Generates tailored interview questions using Claude.
// Body: {} (pulls candidate + campaign data automatically)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/candidate/:id/interview-questions", async (req, res) => {
  try {
    const candidate = await JobCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    const campaign = await JobCampaign.findById(candidate.campaignId);

    const questions = await generateInterviewQuestions({
      candidateName: candidate.parsed_data?.full_name || candidate.fileName,
      candidateSkills: (candidate.validated_skills?.top_skills || []).map((s) =>
        typeof s === "string" ? s : s.name
      ),
      jdRequirements:
        campaign?.jd_analysis?.must_have_skills ||
        campaign?.jd_analysis?.required_skills ||
        [],
      jobTitle: campaign?.title || "the role",
    });

    // Cache on candidate record
    await JobCandidate.findByIdAndUpdate(req.params.id, { interview_questions: questions });

    res.json({ success: true, questions });
  } catch (err) {
    console.error("[POST /interview-questions]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/candidate/:id/rejection-insight
// Generates a plain-English rejection explanation using Claude.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/candidate/:id/rejection-insight", async (req, res) => {
  try {
    const candidate = await JobCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    if (!candidate.final_decision) {
      return res.status(400).json({ error: "Candidate has not been evaluated yet." });
    }
    const campaign = await JobCampaign.findById(candidate.campaignId);

    const insight = await generateRejectionInsight({
      candidateName: candidate.parsed_data?.full_name || candidate.fileName,
      finalScore: candidate.final_score,
      finalDecision: candidate.final_decision,
      debateSummary: candidate.debate_summary,
      hrNote: candidate.hr_note,
      matchResults: candidate.match_results,
      validatedSkills: (candidate.validated_skills?.top_skills || []).map((s) =>
        typeof s === "string" ? s : s.name
      ),
      jdRequirements:
        campaign?.jd_analysis?.must_have_skills ||
        campaign?.jd_analysis?.required_skills ||
        [],
      jobTitle: campaign?.title || "the role",
    });

    // Cache on candidate
    await JobCandidate.findByIdAndUpdate(req.params.id, { rejection_insight: insight });

    res.json({ success: true, insight });
  } catch (err) {
    console.error("[POST /rejection-insight]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/campaign/:id/recommend
// Generates an AI hiring recommendation for the top candidates in a campaign.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/campaign/:id/recommend", async (req, res) => {
  try {
    const campaign = await JobCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found." });

    const candidates = await JobCandidate.find({ campaignId: req.params.id, status: "COMPLETED" })
      .select("-rawText")
      .sort({ final_score: -1 })
      .limit(5);

    if (candidates.length < 2) {
      return res.status(400).json({ error: "Need at least 2 evaluated candidates to generate a recommendation." });
    }

    const recommendation = await generateRecommendation({
      candidates,
      jobTitle: campaign.title,
      jdRequirements:
        campaign.jd_analysis?.must_have_skills ||
        campaign.jd_analysis?.required_skills ||
        [],
    });

    // Cache on campaign
    await JobCampaign.findByIdAndUpdate(req.params.id, { ai_recommendation: recommendation });

    res.json({ success: true, recommendation });
  } catch (err) {
    console.error("[POST /campaign/recommend]", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
