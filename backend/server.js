const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const uploadRoute = require("./routes/upload");
const chatRoute = require("./routes/chat");
const candidatesRoute = require("./routes/candidates");
const authRoutes = require("./routes/auth");
const userAuthRoutes = require("./routes/auth.user");
const jobRoutes = require("./routes/jobs");
const shortlistRoutes = require("./routes/shortlist");
const interviewRoutes = require("./routes/interviews");
const analyticsRoutes = require("./routes/analytics");

const processRoute = require("./routes/process");       // Legacy stateless pipeline
const campaignsRoute = require("./routes/campaigns");   // Campaign step-by-step pipeline
const apiRoute = require("./routes/api");               // Unified API (new)

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

if (!process.env.JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET is not set. Using a temporary development secret.");
  process.env.JWT_SECRET = "dev-secret-change-me";
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
app.use("/auth", authRoutes);
app.use("/auth/user", userAuthRoutes);

// ─── Core ATS routes ─────────────────────────────────────────────────────────
app.use("/upload", uploadRoute);
app.use("/chat", chatRoute);
app.use("/candidates", candidatesRoute);
app.use("/jobs", jobRoutes);
app.use("/shortlist", shortlistRoutes);
app.use("/interviews", interviewRoutes);
app.use("/analytics", analyticsRoutes);

// ─── AI Pipeline routes ───────────────────────────────────────────────────────
//
// /api/job/create          POST  → Agent 1 + 2 (create & analyze JD)
// /api/candidate/upload    POST  → Upload CVs + Agent 3+4 parse immediately
// /api/process             POST  → Agents 5-9 full pipeline for a job
// /api/results/:jobId      GET   → Ranked results
app.use("/api", apiRoute);

// /api/campaigns/*  – granular step-by-step control (create, analyze-jd, upload,
//                     evaluate per candidate, finalize)
app.use("/api/campaigns", campaignsRoute);

// /api/v1/process   – legacy stateless pipeline (takes raw files, no persistence)
app.use("/api/v1/process", processRoute);

app.get("/", (req, res) => {
  res.json({
    status: "AI Recruiter ATS API Running",
    endpoints: {
      "POST /api/job/create": "Create job campaign (Agents 1+2)",
      "POST /api/candidate/upload": "Upload CVs and parse (Agents 3+4)",
      "POST /api/process": "Run full evaluation pipeline (Agents 5-9)",
      "GET  /api/results/:jobId": "Get ranked candidate results",
      "POST /api/campaigns/create": "Campaign management API",
      "POST /api/v1/process": "Legacy stateless pipeline",
    },
  });
});

const PORT = process.env.PORT || 5001;

if (!process.env.MONGO_URI) {
  console.error("ERROR: MONGO_URI environment variable is not set. Set it in backend/.env");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API ready at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});
