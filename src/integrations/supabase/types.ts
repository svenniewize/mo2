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
      fielfold_entries: {
        Row: {
          content: string
          created_at: string
          depth: number | null
          id: string
          manifold: string | null
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          depth?: number | null
          id?: string
          manifold?: string | null
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          depth?: number | null
          id?: string
          manifold?: string | null
          session_id?: string
        }
        Relationships: []
      }
      life_notes: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          manifold: string | null
          session_id: string
          source: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          manifold?: string | null
          session_id: string
          source?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          manifold?: string | null
          session_id?: string
          source?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      life_remembers: {
        Row: {
          content: string
          created_at: string
          id: string
          manifold: string | null
          mood: string
          session_id: string
          source: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          manifold?: string | null
          mood?: string
          session_id: string
          source?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          manifold?: string | null
          mood?: string
          session_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      life_shitposts: {
        Row: {
          body: string
          created_at: string
          form: string
          id: string
          session_id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          form?: string
          id?: string
          session_id: string
          title?: string
        }
        Update: {
          body?: string
          created_at?: string
          form?: string
          id?: string
          session_id?: string
          title?: string
        }
        Relationships: []
      }
      life_tasks: {
        Row: {
          category: string
          created_at: string
          due_at: string | null
          id: string
          manifold: string | null
          notes: string | null
          priority: number
          session_id: string
          source: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          due_at?: string | null
          id?: string
          manifold?: string | null
          notes?: string | null
          priority?: number
          session_id: string
          source?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          due_at?: string | null
          id?: string
          manifold?: string | null
          notes?: string | null
          priority?: number
          session_id?: string
          source?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      mo_hyperfold_edges: {
        Row: {
          updated_at: string
          weight: number
          word_a: string
          word_b: string
        }
        Insert: {
          updated_at?: string
          weight?: number
          word_a: string
          word_b: string
        }
        Update: {
          updated_at?: string
          weight?: number
          word_a?: string
          word_b?: string
        }
        Relationships: []
      }
      mo_traces: {
        Row: {
          content: string
          created_at: string
          id: string
          manifold: string | null
          pressure: number | null
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          manifold?: string | null
          pressure?: number | null
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          manifold?: string | null
          pressure?: number | null
          role?: string
          session_id?: string
        }
        Relationships: []
      }
      songs: {
        Row: {
          created_at: string
          held: boolean
          id: string
          lyrics: string
          session_id: string
          title: string
        }
        Insert: {
          created_at?: string
          held?: boolean
          id?: string
          lyrics: string
          session_id: string
          title: string
        }
        Update: {
          created_at?: string
          held?: boolean
          id?: string
          lyrics?: string
          session_id?: string
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      mo_hyperfold_bump: { Args: { edges: Json }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
