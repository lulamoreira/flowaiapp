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
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          action_type: string
          action_value: string
          board_id: string
          created_at: string
          enabled: boolean
          id: string
          label: string
          trigger_type: string
          trigger_value: string
        }
        Insert: {
          action_type: string
          action_value: string
          board_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string
          trigger_type: string
          trigger_value: string
        }
        Update: {
          action_type?: string
          action_value?: string
          board_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string
          trigger_type?: string
          trigger_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_snapshots: {
        Row: {
          counts: Json
          created_at: string
          id: string
          payload: Json
          trigger_source: string
        }
        Insert: {
          counts: Json
          created_at?: string
          id?: string
          payload: Json
          trigger_source: string
        }
        Update: {
          counts?: Json
          created_at?: string
          id?: string
          payload?: Json
          trigger_source?: string
        }
        Relationships: []
      }
      boards: {
        Row: {
          color: string
          created_at: string
          created_by: string
          description: string
          favorite: boolean
          id: string
          project_end: string | null
          project_start: string | null
          public_timeline_enabled: boolean | null
          public_token: string | null
          title: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          description?: string
          favorite?: boolean
          id?: string
          project_end?: string | null
          project_start?: string | null
          public_timeline_enabled?: boolean | null
          public_token?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          description?: string
          favorite?: boolean
          id?: string
          project_end?: string | null
          project_start?: string | null
          public_timeline_enabled?: boolean | null
          public_token?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_fields: {
        Row: {
          board_id: string
          created_at: string
          field_name: string
          field_options: Json
          field_type: string
          id: string
          position: number
        }
        Insert: {
          board_id: string
          created_at?: string
          field_name: string
          field_options?: Json
          field_type?: string
          id?: string
          position?: number
        }
        Update: {
          board_id?: string
          created_at?: string
          field_name?: string
          field_options?: Json
          field_type?: string
          id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_functions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      deletion_log: {
        Row: {
          board_id: string | null
          confirm_details: Json | null
          data: Json
          deleted_at: string
          deleted_by: string | null
          id: string
          original_id: string
          table_name: string
        }
        Insert: {
          board_id?: string | null
          confirm_details?: Json | null
          data: Json
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          original_id: string
          table_name: string
        }
        Update: {
          board_id?: string | null
          confirm_details?: Json | null
          data?: Json
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          original_id?: string
          table_name?: string
        }
        Relationships: []
      }
      function_permissions: {
        Row: {
          can_delete: boolean
          can_edit: boolean
          function_id: string
          id: string
          module: string
        }
        Insert: {
          can_delete?: boolean
          can_edit?: boolean
          function_id: string
          id?: string
          module: string
        }
        Update: {
          can_delete?: boolean
          can_edit?: boolean
          function_id?: string
          id?: string
          module?: string
        }
        Relationships: [
          {
            foreignKeyName: "function_permissions_function_id_fkey"
            columns: ["function_id"]
            isOneToOne: false
            referencedRelation: "custom_functions"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_forms: {
        Row: {
          board_id: string
          created_at: string
          description: string
          enabled: boolean
          id: string
          public_token: string
          target_group_id: string | null
          title: string
        }
        Insert: {
          board_id: string
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          public_token?: string
          target_group_id?: string | null
          title?: string
        }
        Update: {
          board_id?: string
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          public_token?: string
          target_group_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_forms_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: true
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_forms_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "task_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_secrets: {
        Row: {
          created_at: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invited_by: string
          invited_name: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by: string
          invited_name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string
          invited_name?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      placeholder_members: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string | null
          created_by: string
          email: string | null
          full_name: string
          id: string
          intended_role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          created_by: string
          email?: string | null
          full_name: string
          id?: string
          intended_role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          created_by?: string
          email?: string | null
          full_name?: string
          id?: string
          intended_role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          full_name: string
          id: string
          is_early_adopter: boolean | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_early_adopter?: boolean | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_early_adopter?: boolean | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          board_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          board_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          board_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_snapshots: {
        Row: {
          board_id: string
          created_at: string | null
          created_by: string
          id: string
          payload: Json
        }
        Insert: {
          board_id: string
          created_at?: string | null
          created_by: string
          id?: string
          payload: Json
        }
        Update: {
          board_id?: string
          created_at?: string | null
          created_by?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "schedule_snapshots_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          id: string
          processed_at: string | null
          type: string
        }
        Insert: {
          id: string
          processed_at?: string | null
          type: string
        }
        Update: {
          id?: string
          processed_at?: string | null
          type?: string
        }
        Relationships: []
      }
      stripe_plans: {
        Row: {
          amount_cents: number
          created_at: string | null
          currency: string
          id: string
          stripe_price_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          currency?: string
          id: string
          stripe_price_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          currency?: string
          id?: string
          stripe_price_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string | null
          id: string
          period_ends_at: string | null
          plan_id: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          period_ends_at?: string | null
          plan_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          period_ends_at?: string | null
          plan_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_custom_values: {
        Row: {
          created_at: string
          field_id: string
          id: string
          task_id: string
          value: string
        }
        Insert: {
          created_at?: string
          field_id: string
          id?: string
          task_id: string
          value?: string
        }
        Update: {
          created_at?: string
          field_id?: string
          id?: string
          task_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_custom_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_custom_values_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_groups: {
        Row: {
          board_id: string
          color: string
          created_at: string
          id: string
          position: number
          title: string
        }
        Insert: {
          board_id: string
          color?: string
          created_at?: string
          id?: string
          position?: number
          title: string
        }
        Update: {
          board_id?: string
          color?: string
          created_at?: string
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_groups_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          assignee: string | null
          attachments: Json
          board_id: string
          created_at: string
          created_by: string | null
          description: string
          group_id: string
          id: string
          planned_end: string | null
          planned_start: string | null
          position: number
          priority: string
          status: string
          subtasks: Json
          title: string
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          assignee?: string | null
          attachments?: Json
          board_id: string
          created_at?: string
          created_by?: string | null
          description?: string
          group_id: string
          id?: string
          planned_end?: string | null
          planned_start?: string | null
          position?: number
          priority?: string
          status?: string
          subtasks?: Json
          title: string
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          assignee?: string | null
          attachments?: Json
          board_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          group_id?: string
          id?: string
          planned_end?: string | null
          planned_start?: string | null
          position?: number
          priority?: string
          status?: string
          subtasks?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "task_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string
          description: string
          duration_seconds: number
          ended_at: string | null
          entry_type: string
          id: string
          started_at: string | null
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          duration_seconds?: number
          ended_at?: string | null
          entry_type?: string
          id?: string
          started_at?: string | null
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          duration_seconds?: number
          ended_at?: string | null
          entry_type?: string
          id?: string
          started_at?: string | null
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_custom_functions: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          function_id: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          function_id: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          function_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_functions_function_id_fkey"
            columns: ["function_id"]
            isOneToOne: false
            referencedRelation: "custom_functions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      accept_invitation_by_token: {
        Args: { _accepted_user_id?: string; _token: string }
        Returns: Json
      }
      can_access_board: {
        Args: { _board_id: string; _user_id: string }
        Returns: boolean
      }
      claim_invitation: { Args: { _token: string }; Returns: undefined }
      claim_placeholder: {
        Args: { p_placeholder_id: string; p_target_user_id: string }
        Returns: Json
      }
      cleanup_old_deletions: { Args: never; Returns: undefined }
      create_backup: { Args: { _source: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_coordinator: { Args: { _user_id: string }; Returns: boolean }
      is_project_member: {
        Args: { _board_id: string; _user_id: string }
        Returns: boolean
      }
      is_subscribed: { Args: { u_id: string }; Returns: boolean }
      process_invitation_by_user: {
        Args: { _token: string; _user_id: string }
        Returns: undefined
      }
      restore_backup: {
        Args: { _board_id?: string; _mode: string; _snapshot_id: string }
        Returns: Json
      }
      trigger_drive_backup: { Args: never; Returns: undefined }
      validate_invitation: {
        Args: { _token: string }
        Returns: {
          email: string
          invited_name: string
          is_valid: boolean
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "coordinator" | "viewer" | "user" | "owner"
      invitation_status: "pending" | "accepted" | "expired"
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
      app_role: ["admin", "coordinator", "viewer", "user", "owner"],
      invitation_status: ["pending", "accepted", "expired"],
    },
  },
} as const
