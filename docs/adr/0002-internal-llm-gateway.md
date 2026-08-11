# ADR 0002: Internal provider-neutral LLM gateway

## Status

Accepted (fork; implemented — gateway, adapters, observability API)

## Context

Evaluations today call vendor SDKs and HTTP endpoints directly from root scripts (`openai-eval.mjs`, `gemini-eval.mjs`, `ollama-eval.mjs`, `openrouter-runner.mjs`, tailoring helpers). That spreads retry policy, usage accounting, model selection, and prompt assembly across callers. Hosted evaluation jobs will need the same behavior with observability and spend-tier routing.

## Decision

1. **Introduce a deep LLM gateway Module under `lib/llm/`.** It owns completion execution, model routing, timeout/retry policy, normalized usage, pricing lookup, and structured telemetry—not individual evaluators.
2. **Provider access only through adapters inside `lib/llm/adapters/`.** Examples: OpenAI-compatible HTTP (OpenAI, OpenRouter, Ollama, local servers), Gemini native SDK, optional CLI-process adapter later. No other path imports vendor SDKs or calls `/chat/completions` for model output once migration completes.
3. **Model routing is separate from adapters.** A route resolves spend tier, overrides, capability requirements, fallback order, and budget ceilings; adapters execute a resolved route.
4. **Usage records append-only.** Extend `utils/token-tracker.mjs` concepts into versioned Usage Records (see [CONTEXT.md](../../CONTEXT.md)); rate cards are adapter-backed. Tenant summaries and budget alerts expose via `GET /api/llm-usage` and `lib/llm/observability.mjs` (no prompts or secrets in exports).
5. **Root evaluator scripts become thin facades** after migration—same argv/flags, gateway inside.
6. **Grandfather period.** Until `lib/llm/` lands, legacy root evaluators keep working; architecture tests enforce the adapter boundary only after the gateway directory exists and for new Modules outside the grandfather list.

## Consequences

- One place to add providers, cache semantics, and cost alerts.
- Golden tests on prompt bytes before moving callers (`lib/context-budget.mjs` stays the assembly seam with `modes/` as scoring truth).
- Migration order: tracer-bullet evaluator → remaining evaluators → batch/OpenRouter paths.

## References

- [CONTEXT.md](../../CONTEXT.md) — Model Route, Usage Record, Provider
- ADR 0001 — facade preservation during migration
