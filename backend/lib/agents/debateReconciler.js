const { callClaudeJSON } = require("../ai");

/**
 * Combined Agent 6 & 7: Counter Agent & Debate Reconciler
 */
async function debateReconcile(matchResults, validatedSkills, jdMetrics) {
  const systemPrompt = `
You act as both the Counter Agent (Agent 6) and Debate Agent (Agent 7) in the ATS hierarchy.

Examine the Match Engine (Agent 5) score and decisions. 
As Agent 6: Challenge the original score. Did the Match Engine underrate them? Are transferable skills ignored? Is it too strict?
As Agent 7: Synthesize the debate into a final, structured reconciliation.

Return ONLY valid JSON:
{
  "counter_analysis": {
    "issues_found": ["issue 1"],
    "corrected_score": 0,
    "verdict": "UPGRADE",
    "reasoning": ""
  },
  "debate_summary": "Short simulated debate summary between Evaluator and Counter Agent",
  "final_agreed_score": 0,
  "final_decision": "YES"
}
`;

  return await callClaudeJSON(systemPrompt, `JD Metrics:\n${JSON.stringify(jdMetrics)}\n\nValidated Skills:\n${JSON.stringify(validatedSkills)}\n\nOriginal Match Engine Results:\n${JSON.stringify(matchResults)}`);
}

module.exports = debateReconcile;
