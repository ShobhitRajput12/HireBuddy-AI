const { callClaudeJSON } = require("../ai");

/**
 * Combined Agent 3 & 4: CV Parser & Skill Validator
 *
 * FIX: Removed the JS-style comment ("// out of 100") from inside the JSON
 * schema example in the system prompt. Claude occasionally echoes the schema
 * literally, and a JS comment inside JSON causes a parse error.
 */
async function parseAndValidateCV(cvText) {
  const systemPrompt = `
You are an unbiased Enterprise ATS CV Parser (Agent 3) and Skill Validator (Agent 4).
Extract the candidate's capabilities while completely ignoring name, gender, age, and location.

As Skill Validator (Agent 4): actively evaluate whether the candidate ACTUALLY has depth in
each skill based on project context and bullet points. Distinguish real experience from mere buzzwords.

Return ONLY valid JSON:
{
  "parsed_data": {
    "candidate_id": "Initials or C1",
    "experience_years": 0.0,
    "is_fresher": true,
    "domain_expertise": ["domain1"],
    "confidence_score": 0
  },
  "validated_skills": {
    "real_skills": ["skill1", "skill2"],
    "fake_or_weak_skills": ["buzzword1"],
    "skill_depth_score": 0
  }
}

skill_depth_score is a number from 0 to 100.
confidence_score is a number from 0 to 100.

IMPORTANT: "experience_years" MUST be a decimal (float). 
- If a candidate has 3 months of internship, set it to 0.25 (months/12). 
- Do NOT round up internships to 1 year. 
- "is_fresher" MUST be true if the candidate only has internship experience and no full-time professional roles. 
- Internship duration counts as 0.0 towards "professional experience" if you strictly interpret "professional" as full-time employment, but for this system, please return the fractional year for all experience while setting "is_fresher" to true if internships are the only source.
`;

  return await callClaudeJSON(systemPrompt, `Raw CV Text:\n${cvText}`);
}

module.exports = parseAndValidateCV;
