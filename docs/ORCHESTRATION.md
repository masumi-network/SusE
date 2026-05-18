# Orchestration

## Principle

SuSE is not a router. SuSE is the thinking layer.

SuSE is also the only user-facing coworker. Agent-to-agent work happens in the background. The user receives SuSE's answer, not a report about which internal agents, tools, vendors, or routing steps were used.

She decides:

- what user is asking
- what information is missing
- which specialists to consult
- whether a second specialist round is needed
- what answer user should receive

## Specialists

| Slug | Name | Use When |
| --- | --- | --- |
| `lexi` | Lexi | supply chain, suppliers, sourcing, sustainability risks |
| `emil-conrad` | Emil-Conrad | green claims, legal/compliance wording, EmpCo, UWG |
| `diddy-p` | Diddy P. | Digital Product Passport, EU DPP readiness |
| `food-co2-analyst` | Food CO2 Analyst | food product CO2 footprint calculations |

## Call Policy

Default: call only needed specialists.

Broad assessment examples may call multiple specialists:

- product sustainability review
- EU market compliance readiness
- food product lifecycle/risk analysis
- supplier due diligence with claims review

Narrow examples usually call one:

- "Estimate CO2 for this food item" -> Food CO2 Analyst
- "Is this green claim risky in Germany?" -> Emil-Conrad
- "What DPP fields do I need?" -> Diddy P.
- "Assess supplier risks" -> Lexi

## Specialist Brief Shape

SuSE sends focused briefs, not raw user prompt dumps.

Brief should include:

- task for specialist
- relevant user context
- requested output shape
- assumptions to flag
- answer length target

Example:

```txt
You are Lexi. Assess supply-chain sustainability risks for:
<context>
...
</context>

Return:
1. risk list
2. evidence needed
3. mitigation options
4. confidence level
```

## Iteration

After first specialist result, SuSE checks:

- enough evidence?
- contradiction?
- compliance risk?
- calculation needed?
- user-facing answer possible?

If gap exists, call another specialist with context from previous findings.

## Final Answer

SuSE final answer must:

- answer user request directly
- merge specialist findings
- state assumptions
- flag uncertainty
- give next action
- avoid exposing raw internal transcripts
- never mention internal agent names, routing, tools, vendors, or background coordination
- optionally say SuSE has expert support, but only at a high level and only when useful

## OpenRouter Synthesis Prompt Inputs

- SuSE identity and tone
- user request
- conversation/task metadata
- specialist call plan
- specialist findings
- unresolved assumptions
- desired output format

## Failure Behavior

If one specialist fails:

- continue if useful answer remains possible
- mention only the user-facing limitation if it matters
- do not expose internal stack traces

If all specialist calls fail:

- return concise user-safe failure or preliminary guidance
- for Task Board, post `FAILED`
- for chat, return user-safe error with retry suggestion
