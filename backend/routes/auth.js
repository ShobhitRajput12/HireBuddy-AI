const express = require("express");
const jwt = require("jsonwebtoken");
const Recruiter = require("../models/Recruiter");

const router = express.Router();

const sign = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

// POST /auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, company } = req.body;
    const exists = await Recruiter.findOne({ email });
    if (exists) return res.status(409).json({ error: "Email already registered" });
    const recruiter = await Recruiter.create({ name, email, password, company });
    res.status(201).json({
      token: sign(recruiter._id),
      recruiter: { id: recruiter._id, name, email, company }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const recruiter = await Recruiter.findOne({ email });
    if (!recruiter) return res.status(401).json({ error: "Invalid credentials" });
    const match = await recruiter.comparePassword(password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });
    res.json({
      token: sign(recruiter._id),
      recruiter: {
        id: recruiter._id,
        name: recruiter.name,
        email,
        company: recruiter.company
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

