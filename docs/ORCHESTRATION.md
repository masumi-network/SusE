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

| Slug | Use When | Do Not Use When |
| --- | --- | --- |
| `lexi` | supplier, vendor, sourcing, procurement, traceability, Scope 3, due diligence, supply-chain risk | request is only food CO2 calculation, claim wording/compliance, or DPP fields |
| `emil-conrad` | green claims, greenwashing, advertising, labels, consumer-facing wording, EmpCo/UWG, substantiation | request is only numeric CO2 calculation, supplier risk, or DPP planning |
| `diddy-p` | Digital Product Passport, DPP, ESPR, battery passport, data carrier, passport field mapping | request is only CO2 calculation, claim wording, or supplier risk |
| `food-co2-analyst` | CO2/CO2e/carbon-footprint/LCA/emission-factor calculations for food, recipes, meals, beverages, or ingredients; explicit "CO2 analyst/agent" requests | request is only supplier/procurement risk, legal claim review, or DPP planning |

## Call Policy

Default: call only needed specialists. Narrow intent should map to one specialist.

Broad assessment examples may call multiple specialists:

- product sustainability review
- EU market compliance readiness
- food product lifecycle/risk analysis
- supplier due diligence with claims review

Narrow examples usually call one:

- "Estimate CO2 for this food item" -> Food CO2 Analyst
- "Use the CO2 analyst for this ingredient footprint estimate" -> Food CO2 Analyst
- "Is this green claim risky in Germany?" -> Emil-Conrad
- "What DPP fields do I need?" -> Diddy P.
- "Assess supplier risks" -> Lexi

Routing guardrails:

- Do not send a food CO2 calculation to procurement/supply-chain support unless supplier, sourcing, vendor, traceability, or Scope 3 context is explicitly part of the ask.
- Do not send a green-claim review to the CO2 calculator unless the user asks for a footprint number, emission factor, LCA, CO2e estimate, or recipe/product footprint.
- Do not send a DPP field/schema request to legal or procurement support unless the user asks for claim compliance or supplier evidence gaps.
- If the ask has multiple explicit intents, use multiple specialists; otherwise keep the call set minimal.

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
