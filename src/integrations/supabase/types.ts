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
      alerts: {
        Row: {
          camera_id: string | null
          camera_name: string | null
          created_at: string
          description: string | null
          external_id: string | null
          id: string
          latitude: number | null
          location: string | null
          longitude: number | null
          match_confidence: number | null
          metadata: Json | null
          priority: string
          raised_by: string | null
          source: string | null
          status: string
          subject_category: string | null
          subject_id: string | null
          subject_name: string | null
          thumbnail: string | null
          title: string
          updated_at: string
        }
        Insert: {
          camera_id?: string | null
          camera_name?: string | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          match_confidence?: number | null
          metadata?: Json | null
          priority?: string
          raised_by?: string | null
          source?: string | null
          status?: string
          subject_category?: string | null
          subject_id?: string | null
          subject_name?: string | null
          thumbnail?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          camera_id?: string | null
          camera_name?: string | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          id?: string
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          match_confidence?: number | null
          metadata?: Json | null
          priority?: string
          raised_by?: string | null
          source?: string | null
          status?: string
          subject_category?: string | null
          subject_id?: string | null
          subject_name?: string | null
          thumbnail?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          asset_id: string
          assigned_user: string | null
          barcode: string
          category: string
          created_at: string
          department: string
          id: string
          image_url: string | null
          manufacturer: string
          model: string
          name: string
          purchase_date: string | null
          serial_number: string
          status: string
          updated_at: string
          warranty_until: string | null
        }
        Insert: {
          asset_id: string
          assigned_user?: string | null
          barcode?: string
          category?: string
          created_at?: string
          department?: string
          id?: string
          image_url?: string | null
          manufacturer?: string
          model?: string
          name: string
          purchase_date?: string | null
          serial_number?: string
          status?: string
          updated_at?: string
          warranty_until?: string | null
        }
        Update: {
          asset_id?: string
          assigned_user?: string | null
          barcode?: string
          category?: string
          created_at?: string
          department?: string
          id?: string
          image_url?: string | null
          manufacturer?: string
          model?: string
          name?: string
          purchase_date?: string | null
          serial_number?: string
          status?: string
          updated_at?: string
          warranty_until?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string
          actor_id: string | null
          created_at: string
          id: string
          ip_address: string
          metadata: Json
          module: string
          record_id: string
        }
        Insert: {
          action: string
          actor_email?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string
          metadata?: Json
          module: string
          record_id?: string
        }
        Update: {
          action?: string
          actor_email?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string
          metadata?: Json
          module?: string
          record_id?: string
        }
        Relationships: []
      }
      cameras: {
        Row: {
          building: string
          created_at: string
          floor: string
          id: string
          last_heartbeat: string
          latitude: number | null
          location: string
          longitude: number | null
          name: string
          notes: string | null
          resolution: string
          rtsp_url: string
          status: string
          updated_at: string
        }
        Insert: {
          building?: string
          created_at?: string
          floor?: string
          id?: string
          last_heartbeat?: string
          latitude?: number | null
          location?: string
          longitude?: number | null
          name: string
          notes?: string | null
          resolution?: string
          rtsp_url?: string
          status?: string
          updated_at?: string
        }
        Update: {
          building?: string
          created_at?: string
          floor?: string
          id?: string
          last_heartbeat?: string
          latitude?: number | null
          location?: string
          longitude?: number | null
          name?: string
          notes?: string | null
          resolution?: string
          rtsp_url?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string
          created_at: string
          head: string
          headcount: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          head?: string
          headcount?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          head?: string
          headcount?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      escalations: {
        Row: {
          alert_id: string | null
          channel: string
          created_at: string
          http_status: number | null
          id: string
          payload: Json | null
          response_excerpt: string | null
          status: string
          subject_id: string | null
          target: string
        }
        Insert: {
          alert_id?: string | null
          channel: string
          created_at?: string
          http_status?: number | null
          id?: string
          payload?: Json | null
          response_excerpt?: string | null
          status: string
          subject_id?: string | null
          target: string
        }
        Update: {
          alert_id?: string | null
          channel?: string
          created_at?: string
          http_status?: number | null
          id?: string
          payload?: Json | null
          response_excerpt?: string | null
          status?: string
          subject_id?: string | null
          target?: string
        }
        Relationships: []
      }
      face_enrollments: {
        Row: {
          created_at: string
          descriptor: Json
          enrolled_by: string | null
          id: string
          personnel_id: string
          personnel_name: string
          thumbnail: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          descriptor: Json
          enrolled_by?: string | null
          id?: string
          personnel_id: string
          personnel_name: string
          thumbnail?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          descriptor?: Json
          enrolled_by?: string | null
          id?: string
          personnel_id?: string
          personnel_name?: string
          thumbnail?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string
          full_name: string | null
          id: string
          issued_at: string | null
          issued_by: string | null
          operator_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          full_name?: string | null
          id: string
          issued_at?: string | null
          issued_by?: string | null
          operator_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          operator_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          user_agent: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          user_agent?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          user_agent?: string
          user_id?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          aliases: string | null
          category: string | null
          created_at: string
          created_by: string | null
          danger_level: string | null
          date_of_birth: string | null
          department: string
          email: string
          employee_number: string
          first_name: string
          gender: string | null
          id: string
          last_name: string
          last_seen_at: string | null
          last_seen_location: string | null
          national_id: string
          notes: string | null
          phone: string
          photo_url: string | null
          position: string
          status: string
          updated_at: string
        }
        Insert: {
          aliases?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          danger_level?: string | null
          date_of_birth?: string | null
          department?: string
          email?: string
          employee_number: string
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          last_seen_at?: string | null
          last_seen_location?: string | null
          national_id?: string
          notes?: string | null
          phone?: string
          photo_url?: string | null
          position?: string
          status?: string
          updated_at?: string
        }
        Update: {
          aliases?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          danger_level?: string | null
          date_of_birth?: string | null
          department?: string
          email?: string
          employee_number?: string
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          last_seen_at?: string | null
          last_seen_location?: string | null
          national_id?: string
          notes?: string | null
          phone?: string
          photo_url?: string | null
          position?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_readonly_query: {
        Args: { _actor: string; _sql: string }
        Returns: Json
      }
      get_user_primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lookup_email_by_operator_id: {
        Args: { _operator_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "Administrator"
        | "Supervisor"
        | "Security Officer"
        | "Operator"
        | "Auditor"
        | "Viewer"
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
      app_role: [
        "Administrator",
        "Supervisor",
        "Security Officer",
        "Operator",
        "Auditor",
        "Viewer",
      ],
    },
  },
} as const
