const { callClaudeJSON } = require("../ai");

/**
 * Agent 5: Match Engine
 */
async function matchEngine(validatedSkills, jdMetrics) {
  const systemPrompt = `
You are the Match Engine (Agent 5) in a corporate ATS.
Compare the candidate's VALIDATED skills against the strict JD Metrics provided by Agent 2.

Calculate numeric match scores based purely on intersection.
Return ONLY valid JSON:
{
  "match_score": 0,
  "skill_match_score": 0,
  "experience_match_score": 0,
  "missing_critical_skills": [],
  "strengths": [],
  "weaknesses": []
}
`;

  return await callClaudeJSON(systemPrompt, `JD Metrics:\n${JSON.stringify(jdMetrics)}\n\nValidated Candidate Skills:\n${JSON.stringify(validatedSkills)}`);
}

module.exports = matchEngine;
