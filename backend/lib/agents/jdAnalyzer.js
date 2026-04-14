const { callClaudeJSON } = require("../ai");

/**
 * Agent 2: JD Analyzer
 */
async function analyzeJD(jdText) {
  const systemPrompt = `
You are the JD Analyzer (Agent 2) in the ATS pipeline.
Extract the strict evaluation metrics and weightages.

Return ONLY valid JSON:
{
  "must_have_skills": [],
  "optional_skills": [],
  "min_experience": "e.g. 5",
  "weightage": {
    "skills": 50,
    "experience": 30,
    "projects": 20
  }
}
`;

  return await callClaudeJSON(systemPrompt, `Job Description:\n${jdText}`);
}

module.exports = analyzeJD;
