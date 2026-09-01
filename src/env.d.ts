declare namespace NodeJS {
  interface ProcessEnv {
    GEMINI_API_KEY?: string;
    GROQ_API_KEY?: string;
    OPENAI_API_KEY?: string;
    OPENAI_COACH_MODEL?: string;
    SUPABASE_URL?: string;
    SUPABASE_PUBLISHABLE_KEY?: string;
  }
}
