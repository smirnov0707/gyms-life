# AI Coach contract

`CoachContext` is the only input contract for an AI Coach Worker. `CoachRecommendation` is the only output contract. Both are validated with Zod. The worker boundary is provider-neutral and can later host different LLM adapters without changing the orchestrator or data layer.
