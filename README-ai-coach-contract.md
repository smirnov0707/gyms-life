# AI Coach boundary

The orchestrator builds a validated `CoachContext` from internal, user-authorized server data. AI workers receive only that structured context and return a validated `CoachRecommendation`. Provider SDKs must not be imported by the context builder or contract layer.

`createServerFn` remains an API/transport boundary; internal server-side loaders own data access.