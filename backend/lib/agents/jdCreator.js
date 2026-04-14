const { callClaudeJSON } = require("../ai");

/**
 * Agent 1: JD Creator
 */
async function createJD(shortPrompt) {
  const systemPrompt = `
You are an expert HR Manager and Technical Recruiter (Agent 1). 
Generate a professional Job Description from the user's short input.

Return ONLY valid JSON:
{
  "job_title": "...",
  "full_jd_text": "A continuous string containing the entire written job description, strongly formatted with markdown bullets and sections."
}
`;

  return await callClaudeJSON(systemPrompt, `Job Request: ${shortPrompt}`);
}

module.exports = createJD;
