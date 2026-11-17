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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      api_rate_limits: {
        Row: {
          expires_at: string
          key: string
          request_count: number
          window_started_at: string
        }
        Insert: {
          expires_at: string
          key: string
          request_count: number
          window_started_at: string
        }
        Update: {
          expires_at?: string
          key?: string
          request_count?: number
          window_started_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          debug: Json | null
          id: string
          role: string
          sources: Json | null
          thread_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          debug?: Json | null
          id?: string
          role: string
          sources?: Json | null
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          debug?: Json | null
          id?: string
          role?: string
          sources?: Json | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          memory_message_count: number
          memory_summary: string
          title: string
          updated_at: string
          visitor_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          memory_message_count?: number
          memory_summary?: string
          title?: string
          updated_at?: string
          visitor_id: string
        }
        Update: {
          created_at?: string
          id?: string
          memory_message_count?: number
          memory_summary?: string
          title?: string
          updated_at?: string
          visitor_id?: string
        }
        Relationships: []
      }
      eval_runs: {
        Row: {
          created_at: string
          id: string
          model: string
          results: Json
          summary: Json
        }
        Insert: {
          created_at?: string
          id?: string
          model: string
          results: Json
          summary: Json
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          results?: Json
          summary?: Json
        }
        Relationships: []
      }
      kb_documents: {
        Row: {
          builtin_key: string | null
          content: string
          created_at: string
          id: string
          section: string
          source_type: string
          title: string
          updated_at: string
        }
        Insert: {
          builtin_key?: string | null
          content: string
          created_at?: string
          id?: string
          section?: string
          source_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          builtin_key?: string | null
          content?: string
          created_at?: string
          id?: string
          section?: string
          source_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      kb_embeddings: {
        Row: {
          chunk_id: string
          content_hash: string
          embedding: Json
          updated_at: string
        }
        Insert: {
          chunk_id: string
          content_hash: string
          embedding: Json
          updated_at?: string
        }
        Update: {
          chunk_id?: string
          content_hash?: string
          embedding?: Json
          updated_at?: string
        }
        Relationships: []
      }
      rag_query_cache: {
        Row: {
          cache_key: string
          canonical_english_query: string
          compute_saved_ms: number
          corpus_version: string
          created_at: string
          expires_at: string
          hit_count: number
          id: string
          lang_code: string
          last_accessed_at: string
          matched_chunk_ids: string[]
          response_text: string
          retrieved_context: string
          sources: Json
          tool_calls: Json
        }
        Insert: {
          cache_key: string
          canonical_english_query: string
          compute_saved_ms?: number
          corpus_version?: string
          created_at?: string
          expires_at?: string
          hit_count?: number
          id?: string
          lang_code?: string
          last_accessed_at?: string
          matched_chunk_ids?: string[]
          response_text?: string
          retrieved_context: string
          sources?: Json
          tool_calls?: Json
        }
        Update: {
          cache_key?: string
          canonical_english_query?: string
          compute_saved_ms?: number
          corpus_version?: string
          created_at?: string
          expires_at?: string
          hit_count?: number
          id?: string
          lang_code?: string
          last_accessed_at?: string
          matched_chunk_ids?: string[]
          response_text?: string
          retrieved_context?: string
          sources?: Json
          tool_calls?: Json
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
      visitors: {
        Row: {
          city: string | null
          country: string | null
          first_seen: string
          id: string
          ip: string | null
          landing_path: string | null
          language: string | null
          last_seen: string
          referrer: string | null
          user_agent: string | null
          visits: number
        }
        Insert: {
          city?: string | null
          country?: string | null
          first_seen?: string
          id: string
          ip?: string | null
          landing_path?: string | null
          language?: string | null
          last_seen?: string
          referrer?: string | null
          user_agent?: string | null
          visits?: number
        }
        Update: {
          city?: string | null
          country?: string | null
          first_seen?: string
          id?: string
          ip?: string | null
          landing_path?: string | null
          language?: string | null
          last_seen?: string
          referrer?: string | null
          user_agent?: string | null
          visits?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_rate_limit: {
        Args: { _key: string; _limit: number; _window_seconds: number }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      touch_rag_cache: { Args: { _key: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin"],
    },
  },
} as const
