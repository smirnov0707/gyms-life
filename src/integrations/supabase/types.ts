export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_personalization_consents: {
        Row: {
          granted: boolean
          id: number
          policy_version: string
          recorded_at: string
          user_id: string
        }
        Insert: {
          granted: boolean
          id?: never
          policy_version: string
          recorded_at?: string
          user_id: string
        }
        Update: {
          granted?: boolean
          id?: never
          policy_version?: string
          recorded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_daily: {
        Row: {
          request_count: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          request_count?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          request_count?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      body_metrics: {
        Row: {
          arm_cm: number | null
          body_fat: number | null
          chest_cm: number | null
          created_at: string
          hips_cm: number | null
          id: string
          measured_on: string
          neck_cm: number | null
          thigh_cm: number | null
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          arm_cm?: number | null
          body_fat?: number | null
          chest_cm?: number | null
          created_at?: string
          hips_cm?: number | null
          id?: string
          measured_on?: string
          neck_cm?: number | null
          thigh_cm?: number | null
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          arm_cm?: number | null
          body_fat?: number | null
          chest_cm?: number | null
          created_at?: string
          hips_cm?: number | null
          id?: string
          measured_on?: string
          neck_cm?: number | null
          thigh_cm?: number | null
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      coach_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          lang: string | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          lang?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          lang?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          advice: string | null
          checkin_on: string
          created_at: string
          energy: number | null
          id: string
          load_modifier: number | null
          mood: number | null
          readiness_score: number | null
          sleep_hours: number | null
          sleep_quality: number | null
          soreness: number | null
          stress: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          advice?: string | null
          checkin_on?: string
          created_at?: string
          energy?: number | null
          id?: string
          load_modifier?: number | null
          mood?: number | null
          readiness_score?: number | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          soreness?: number | null
          stress?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          advice?: string | null
          checkin_on?: string
          created_at?: string
          energy?: number | null
          id?: string
          load_modifier?: number | null
          mood?: number | null
          readiness_score?: number | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          soreness?: number | null
          stress?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          created_at: string
          difficulty: string
          equipment: string
          id: string
          instructions_en: string | null
          instructions_lt: string | null
          location: string
          mistakes_en: string | null
          mistakes_lt: string | null
          muscle_group: string
          name_en: string
          name_lt: string
          slug: string
          video_key: string | null
        }
        Insert: {
          created_at?: string
          difficulty?: string
          equipment: string
          id?: string
          instructions_en?: string | null
          instructions_lt?: string | null
          location?: string
          mistakes_en?: string | null
          mistakes_lt?: string | null
          muscle_group: string
          name_en: string
          name_lt: string
          slug: string
          video_key?: string | null
        }
        Update: {
          created_at?: string
          difficulty?: string
          equipment?: string
          id?: string
          instructions_en?: string | null
          instructions_lt?: string | null
          location?: string
          mistakes_en?: string | null
          mistakes_lt?: string | null
          muscle_group?: string
          name_en?: string
          name_lt?: string
          slug?: string
          video_key?: string | null
        }
        Relationships: []
      }
      form_analyses: {
        Row: {
          created_at: string
          drills: string | null
          exercise_name: string
          exercise_slug: string
          fixes: string | null
          good: string | null
          id: string
          score: number | null
          user_id: string
          verdict: string | null
        }
        Insert: {
          created_at?: string
          drills?: string | null
          exercise_name: string
          exercise_slug: string
          fixes?: string | null
          good?: string | null
          id?: string
          score?: number | null
          user_id: string
          verdict?: string | null
        }
        Update: {
          created_at?: string
          drills?: string | null
          exercise_name?: string
          exercise_slug?: string
          fixes?: string | null
          good?: string | null
          id?: string
          score?: number | null
          user_id?: string
          verdict?: string | null
        }
        Relationships: []
      }
      health_samples: {
        Row: {
          active_kcal: number | null
          created_at: string
          hrv_ms: number | null
          id: string
          raw: Json | null
          recovery_score: number | null
          resting_hr: number | null
          sample_on: string
          sleep_hours: number | null
          sleep_quality: number | null
          source: string
          steps: number | null
          updated_at: string
          user_id: string
          vo2max: number | null
        }
        Insert: {
          active_kcal?: number | null
          created_at?: string
          hrv_ms?: number | null
          id?: string
          raw?: Json | null
          recovery_score?: number | null
          resting_hr?: number | null
          sample_on?: string
          sleep_hours?: number | null
          sleep_quality?: number | null
          source?: string
          steps?: number | null
          updated_at?: string
          user_id: string
          vo2max?: number | null
        }
        Update: {
          active_kcal?: number | null
          created_at?: string
          hrv_ms?: number | null
          id?: string
          raw?: Json | null
          recovery_score?: number | null
          resting_hr?: number | null
          sample_on?: string
          sleep_hours?: number | null
          sleep_quality?: number | null
          source?: string
          steps?: number | null
          updated_at?: string
          user_id?: string
          vo2max?: number | null
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          allergies: string | null
          carbs_target: number | null
          created_at: string
          data: Json
          diet: string | null
          dislikes: string | null
          fat_target: number | null
          goal: string | null
          i18n: Json
          id: string
          is_active: boolean
          kcal_target: number | null
          lang: string
          protein_target: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allergies?: string | null
          carbs_target?: number | null
          created_at?: string
          data: Json
          diet?: string | null
          dislikes?: string | null
          fat_target?: number | null
          goal?: string | null
          i18n?: Json
          id?: string
          is_active?: boolean
          kcal_target?: number | null
          lang?: string
          protein_target?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allergies?: string | null
          carbs_target?: number | null
          created_at?: string
          data?: Json
          diet?: string | null
          dislikes?: string | null
          fat_target?: number | null
          goal?: string | null
          i18n?: Json
          id?: string
          is_active?: boolean
          kcal_target?: number | null
          lang?: string
          protein_target?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_logs: {
        Row: {
          calories: number
          carbs: number
          created_at: string
          description: string
          fat: number
          food_name: string
          id: string
          logged_on: string
          note: string | null
          protein: number
          user_id: string
        }
        Insert: {
          calories?: number
          carbs?: number
          created_at?: string
          description: string
          fat?: number
          food_name: string
          id?: string
          logged_on?: string
          note?: string | null
          protein?: number
          user_id: string
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string
          description?: string
          fat?: number
          food_name?: string
          id?: string
          logged_on?: string
          note?: string | null
          protein?: number
          user_id?: string
        }
        Relationships: []
      }
      paddle_webhook_events: {
        Row: {
          environment: string
          event_id: string
          event_type: string
          received_at: string
        }
        Insert: {
          environment: string
          event_id: string
          event_type: string
          received_at?: string
        }
        Update: {
          environment?: string
          event_id?: string
          event_type?: string
          received_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          data: Json
          days_per_week: number
          goal: string | null
          i18n: Json
          id: string
          is_active: boolean
          lang: string
          title: string
          updated_at: string
          user_id: string
          weeks: number
        }
        Insert: {
          created_at?: string
          data: Json
          days_per_week?: number
          goal?: string | null
          i18n?: Json
          id?: string
          is_active?: boolean
          lang?: string
          title: string
          updated_at?: string
          user_id: string
          weeks?: number
        }
        Update: {
          created_at?: string
          data?: Json
          days_per_week?: number
          goal?: string | null
          i18n?: Json
          id?: string
          is_active?: boolean
          lang?: string
          title?: string
          updated_at?: string
          user_id?: string
          weeks?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allergies: string | null
          birth_year: number | null
          created_at: string
          days_per_week: number | null
          diet: string | null
          dislikes: string | null
          display_name: string | null
          equipment: string[]
          experience: string | null
          gender: string | null
          goal: string | null
          health_token: string
          height_cm: number | null
          id: string
          limitations: string | null
          locale: string
          location: string | null
          meals_per_day: number | null
          onboarded: boolean
          session_minutes: number | null
          target_weight_kg: number | null
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          allergies?: string | null
          birth_year?: number | null
          created_at?: string
          days_per_week?: number | null
          diet?: string | null
          dislikes?: string | null
          display_name?: string | null
          equipment?: string[]
          experience?: string | null
          gender?: string | null
          goal?: string | null
          health_token?: string
          height_cm?: number | null
          id: string
          limitations?: string | null
          locale?: string
          location?: string | null
          meals_per_day?: number | null
          onboarded?: boolean
          session_minutes?: number | null
          target_weight_kg?: number | null
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          allergies?: string | null
          birth_year?: number | null
          created_at?: string
          days_per_week?: number | null
          diet?: string | null
          dislikes?: string | null
          display_name?: string | null
          equipment?: string[]
          experience?: string | null
          gender?: string | null
          goal?: string | null
          health_token?: string
          height_cm?: number | null
          id?: string
          limitations?: string | null
          locale?: string
          location?: string | null
          meals_per_day?: number | null
          onboarded?: boolean
          session_minutes?: number | null
          target_weight_kg?: number | null
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      readiness_checkins: {
        Row: {
          created_at: string
          energy: number
          id: string
          score: number
          sleep_hours: number
          soreness: string
          stress: number
          user_id: string
        }
        Insert: {
          created_at?: string
          energy: number
          id?: string
          score: number
          sleep_hours: number
          soreness: string
          stress: number
          user_id: string
        }
        Update: {
          created_at?: string
          energy?: number
          id?: string
          score?: number
          sleep_hours?: number
          soreness?: string
          stress?: number
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          evening_recovery: boolean
          pre_workout_alert: boolean
          updated_at: string
          user_id: string
          water_reminders: boolean
          workout_time: string
        }
        Insert: {
          evening_recovery?: boolean
          pre_workout_alert?: boolean
          updated_at?: string
          user_id: string
          water_reminders?: boolean
          workout_time?: string
        }
        Update: {
          evening_recovery?: boolean
          pre_workout_alert?: boolean
          updated_at?: string
          user_id?: string
          water_reminders?: boolean
          workout_time?: string
        }
        Relationships: []
      }
      set_logs: {
        Row: {
          created_at: string
          done: boolean
          exercise_name: string
          exercise_slug: string
          id: string
          reps: number | null
          rpe: number | null
          session_id: string
          set_number: number
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          done?: boolean
          exercise_name: string
          exercise_slug: string
          id?: string
          reps?: number | null
          rpe?: number | null
          session_id: string
          set_number: number
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          done?: boolean
          exercise_name?: string
          exercise_slug?: string
          id?: string
          reps?: number | null
          rpe?: number | null
          session_id?: string
          set_number?: number
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "set_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      supplements: {
        Row: {
          category: string
          created_at: string
          dose: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          preferred_time: string
          times_per_day: number
          updated_at: string
          user_id: string
          with_food: boolean
        }
        Insert: {
          category?: string
          created_at?: string
          dose?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          preferred_time?: string
          times_per_day?: number
          updated_at?: string
          user_id: string
          with_food?: boolean
        }
        Update: {
          category?: string
          created_at?: string
          dose?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          preferred_time?: string
          times_per_day?: number
          updated_at?: string
          user_id?: string
          with_food?: boolean
        }
        Relationships: []
      }
      user_insights: {
        Row: {
          body: string
          created_at: string
          fingerprint: string
          id: string
          insight_type: string
          severity: string
          source: Json
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          fingerprint: string
          id?: string
          insight_type: string
          severity: string
          source?: Json
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          fingerprint?: string
          id?: string
          insight_type?: string
          severity?: string
          source?: Json
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_memory: {
        Row: {
          confidence: number
          content: string
          created_at: string
          expires_at: string | null
          first_seen_at: string
          id: string
          importance: number
          last_confirmed_at: string
          memory_type: string
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          content: string
          created_at?: string
          expires_at?: string | null
          first_seen_at?: string
          id?: string
          importance?: number
          last_confirmed_at?: string
          memory_type: string
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          content?: string
          created_at?: string
          expires_at?: string | null
          first_seen_at?: string
          id?: string
          importance?: number
          last_confirmed_at?: string
          memory_type?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vbt_logs: {
        Row: {
          avg_velocity: number
          created_at: string
          exercise_slug: string
          id: string
          peak_velocity: number
          user_id: string
          velocity_loss_pct: number
          weight_kg: number
        }
        Insert: {
          avg_velocity: number
          created_at?: string
          exercise_slug: string
          id?: string
          peak_velocity: number
          user_id: string
          velocity_loss_pct?: number
          weight_kg: number
        }
        Update: {
          avg_velocity?: number
          created_at?: string
          exercise_slug?: string
          id?: string
          peak_velocity?: number
          user_id?: string
          velocity_loss_pct?: number
          weight_kg?: number
        }
        Relationships: []
      }
      vision_meal_scans: {
        Row: {
          calories: number
          carbs: number
          created_at: string
          dish_name: string
          fat: number
          id: string
          image_url: string | null
          items: string[]
          protein: number
          user_id: string
        }
        Insert: {
          calories: number
          carbs: number
          created_at?: string
          dish_name: string
          fat: number
          id?: string
          image_url?: string | null
          items?: string[]
          protein: number
          user_id: string
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string
          dish_name?: string
          fat?: number
          id?: string
          image_url?: string | null
          items?: string[]
          protein?: number
          user_id?: string
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          created_at: string
          day_index: number | null
          duration_seconds: number | null
          feeling: number | null
          finished_at: string | null
          id: string
          notes: string | null
          plan_id: string | null
          started_at: string
          title: string | null
          total_volume: number
          user_id: string
        }
        Insert: {
          created_at?: string
          day_index?: number | null
          duration_seconds?: number | null
          feeling?: number | null
          finished_at?: string | null
          id?: string
          notes?: string | null
          plan_id?: string | null
          started_at?: string
          title?: string | null
          total_volume?: number
          user_id: string
        }
        Update: {
          created_at?: string
          day_index?: number | null
          duration_seconds?: number | null
          feeling?: number | null
          finished_at?: string | null
          id?: string
          notes?: string | null
          plan_id?: string | null
          started_at?: string
          title?: string | null
          total_volume?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_training_plan: {
        Args: { p_plan_id: string }
        Returns: string
      }
      consume_ai_quota: {
        Args: { p_limit: number; p_user_id: string }
        Returns: boolean
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
