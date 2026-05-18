# SuSE Coworker

This context describes the domain language for the SuSE sustainability coworker and its specialist agent network.

## Language

**SuSE**:
The user-facing Sustainability Expert coworker that acts as the primary point of contact.
_Avoid_: Suzy, thin wrapper

**Specialist Coworker**:
A Sokosumi-listed sustainability coworker that SuSE can consult to complete part of a user request.
_Avoid_: sub-worker, backend bot, hidden Langdock-only agent

**Pi Coding Agent**:
The coding-agent platform that hosts SuSE's orchestration logic.
_Avoid_: Pi Agent, pie agent

**pi-sokosumi**:
The reusable Pi package that provides Sokosumi coworker tools, task-board HTTP client, and task polling for Pi agents.
_Avoid_: full chat bridge

**Vendored Sokosumi Layer**:
The SuSE-local copy or adaptation of the pi-sokosumi client and poller pieces needed for production deployment.
_Avoid_: fragile sibling-repo runtime dependency

**Sokosumi**:
The marketplace where users discover, hire, and monitor SuSE.
_Avoid_: implementation runtime

**Coworker Chat Surface**:
The Nori-style Sokosumi API surface where users chat with SuSE through Responses API conversations and Task Board tasks.
_Avoid_: MIP-003-only job surface

**Required Chat Endpoints**:
The minimal Sokosumi coworker endpoints SuSE must expose for chat, conversation continuity, response retrieval, and Task Board tasks.
_Avoid_: full Nori interface set

**Streaming Response**:
The Server-Sent Events response shape SuSE returns when Sokosumi sends `stream: true` to `/v1/responses`.
_Avoid_: JSON-only chat response

**Task Board Processing**:
SuSE's ability to poll Sokosumi coworker task events, claim ready tasks, process them through the same orchestration logic, and post completion or failure events.
_Avoid_: chat-only coworker

**Synthesis Call**:
The OpenRouter-backed LLM call where SuSE turns specialist findings and her own reasoning into the final user-facing answer.
_Avoid_: raw specialist transcript dump

**Standalone Service**:
SuSE's own Railway-hosted implementation that uses Nori only as a protocol reference.
_Avoid_: Nori fork, copied Nori codebase

**Direct Specialist Call**:
An internal Langdock API call from SuSE to a Specialist Coworker's underlying agent, without creating a separate Sokosumi hire.
_Avoid_: re-hire, marketplace delegation, nested wrapper payment call

**Selective Orchestration**:
SuSE's practice of consulting only the Specialist Coworkers needed for a user request, then adding more specialists if the work reveals missing context.
_Avoid_: always call all specialists

**Thinking Layer**:
SuSE's responsibility to decide what information is needed, choose which Specialist Coworkers to consult, sequence follow-up calls, and synthesize the final answer.
_Avoid_: pass-through router

**Lexi**:
The Specialist Coworker for supply-chain analysis and sustainability risk identification.
_Avoid_: generic sustainability agent

**Emil-Conrad**:
The Specialist Coworker for legally compliant sustainability communication under EmpCo and UWG.
_Avoid_: generic legal reviewer

**Diddy P.**:
The Specialist Coworker for Digital Product Passport requirements and implementation.
_Avoid_: product copywriter

**Food CO2 Analyst**:
The Specialist Coworker for food product carbon footprint calculations.
_Avoid_: general emissions analyst

## Relationships

- **SuSE** orchestrates one or more **Specialist Coworkers**
- A user interacts directly with **SuSE**, not with individual **Specialist Coworkers**
- **Pi Coding Agent** hosts **SuSE**
- **SuSE** uses **pi-sokosumi** for Sokosumi coworker tools and task-board polling
- **Vendored Sokosumi Layer** keeps SuSE's Railway deployment self-contained
- **SuSE** is implemented as a **Standalone Service**
- Users discover and invoke **SuSE** through **Sokosumi**
- **SuSE** exposes a **Coworker Chat Surface** to Sokosumi
- **Required Chat Endpoints** define SuSE's v1 public API boundary
- **Streaming Response** is required when Sokosumi requests streaming chat
- **Task Board Processing** is included in SuSE v1
- **SuSE** uses **Direct Specialist Calls** to consult **Specialist Coworkers**
- **Selective Orchestration** precedes SuSE's final synthesized answer
- The **Thinking Layer** owns specialist selection, coordination, and final synthesis
- The **Synthesis Call** produces SuSE's final user-facing answer
- **Lexi**, **Emil-Conrad**, **Diddy P.**, and **Food CO2 Analyst** are **Specialist Coworkers**

## Example Dialogue

> **Dev:** "When a user asks for a sustainability assessment, do they choose a specialist?"
> **Domain expert:** "No. The user talks to **SuSE**, and **SuSE** decides which **Specialist Coworkers** to consult."

## Flagged Ambiguities

- "Suzy", "SuSE", and "SUSE" referred to the same coworker; resolved: the public coworker name is **SuSE**, short for Sustainability Expert.
- "Pi agent" was ambiguous; resolved: this means **Pi Coding Agent**, the implementation platform for SuSE.
- "Coordinate with specialists" was ambiguous; resolved: SuSE v1 uses **Direct Specialist Calls** through Langdock directly, not separate Sokosumi hires or nested wrapper payment calls.
- "Use all four agents" was rejected for default behavior; resolved: SuSE uses **Selective Orchestration** and calls additional specialists only when needed.
- "Sokosumi integration" was narrowed; resolved: SuSE v1 implements the **Required Chat Endpoints**, not every Nori interface.
- "Reference Nori" was narrowed; resolved: Nori is only a protocol reference for Sokosumi coworker endpoints, not the codebase to copy.
- "Smooth chat" was clarified by the Pheme reference; resolved: SuSE v1 supports **Streaming Response** for `stream: true`.
- "Depend on pi-sokosumi" was narrowed; resolved: use pi-sokosumi as reference/source and keep SuSE's production code self-contained.
- "Chat only" was rejected; resolved: SuSE v1 includes **Task Board Processing**.
- "LLM provider" was resolved: SuSE uses OpenRouter for the **Synthesis Call**.
