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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      organization_links: {
        Row: {
          created_at: string
          id: string
          label: string
          link_type: string
          organization_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          link_type: string
          organization_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          link_type?: string
          organization_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          profile_id: string
          role: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          profile_id: string
          role?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_email: string | null
          created_at: string
          description: string | null
          headline: string | null
          id: string
          industries: string[]
          is_public: boolean
          location: string | null
          logo_url: string | null
          name: string
          owner_id: string
          slug: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          description?: string | null
          headline?: string | null
          id?: string
          industries?: string[]
          is_public?: boolean
          location?: string | null
          logo_url?: string | null
          name: string
          owner_id: string
          slug: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          description?: string | null
          headline?: string | null
          id?: string
          industries?: string[]
          is_public?: boolean
          location?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      profile_achievements: {
        Row: {
          achieved_on: string | null
          created_at: string
          description: string | null
          id: string
          profile_id: string
          sort_order: number
          title: string
        }
        Insert: {
          achieved_on?: string | null
          created_at?: string
          description?: string | null
          id?: string
          profile_id: string
          sort_order?: number
          title: string
        }
        Update: {
          achieved_on?: string | null
          created_at?: string
          description?: string | null
          id?: string
          profile_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_achievements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_blocks: {
        Row: {
          blocked_id: string
          created_at: string
          id: string
          profile_id: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          created_at?: string
          id?: string
          profile_id: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          created_at?: string
          id?: string
          profile_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_blocks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_education: {
        Row: {
          created_at: string
          degree: string | null
          description: string | null
          end_year: number | null
          field_of_study: string | null
          id: string
          institution: string
          profile_id: string
          sort_order: number
          start_year: number | null
        }
        Insert: {
          created_at?: string
          degree?: string | null
          description?: string | null
          end_year?: number | null
          field_of_study?: string | null
          id?: string
          institution: string
          profile_id: string
          sort_order?: number
          start_year?: number | null
        }
        Update: {
          created_at?: string
          degree?: string | null
          description?: string | null
          end_year?: number | null
          field_of_study?: string | null
          id?: string
          institution?: string
          profile_id?: string
          sort_order?: number
          start_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_education_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_experience: {
        Row: {
          company: string
          created_at: string
          description: string | null
          end_month: number | null
          end_year: number | null
          id: string
          is_current: boolean
          location: string | null
          profile_id: string
          role: string
          sort_order: number
          start_month: number | null
          start_year: number | null
        }
        Insert: {
          company: string
          created_at?: string
          description?: string | null
          end_month?: number | null
          end_year?: number | null
          id?: string
          is_current?: boolean
          location?: string | null
          profile_id: string
          role: string
          sort_order?: number
          start_month?: number | null
          start_year?: number | null
        }
        Update: {
          company?: string
          created_at?: string
          description?: string | null
          end_month?: number | null
          end_year?: number | null
          id?: string
          is_current?: boolean
          location?: string | null
          profile_id?: string
          role?: string
          sort_order?: number
          start_month?: number | null
          start_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_experience_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_follows: {
        Row: {
          created_at: string
          following_id: string
          id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          following_id: string
          id?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          following_id?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_follows_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_interests: {
        Row: {
          created_at: string
          id: string
          name: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_interests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_languages: {
        Row: {
          code: string
          created_at: string
          id: string
          proficiency: number | null
          profile_id: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          proficiency?: number | null
          profile_id: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          proficiency?: number | null
          profile_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_languages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_links: {
        Row: {
          created_at: string
          id: string
          label: string
          link_type: string
          profile_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          link_type: string
          profile_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          link_type?: string
          profile_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_links_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_preferences: {
        Row: {
          created_at: string
          profile_id: string
          receive_notifications: boolean
          updated_at: string
          visible_achievements: boolean
          visible_contact_email: boolean
          visible_education: boolean
          visible_experience: boolean
          visible_skills: boolean
        }
        Insert: {
          created_at?: string
          profile_id: string
          receive_notifications?: boolean
          updated_at?: string
          visible_achievements?: boolean
          visible_contact_email?: boolean
          visible_education?: boolean
          visible_experience?: boolean
          visible_skills?: boolean
        }
        Update: {
          created_at?: string
          profile_id?: string
          receive_notifications?: boolean
          updated_at?: string
          visible_achievements?: boolean
          visible_contact_email?: boolean
          visible_education?: boolean
          visible_experience?: boolean
          visible_skills?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profile_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_skills: {
        Row: {
          level: number | null
          profile_id: string
          skill_id: string
        }
        Insert: {
          level?: number | null
          profile_id: string
          skill_id: string
        }
        Update: {
          level?: number | null
          profile_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_skills_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          collaboration_preferences: string[]
          contact_email: string | null
          created_at: string
          full_name: string | null
          headline: string | null
          id: string
          is_public: boolean
          linkedin_url: string | null
          location: string | null
          onboarding_completed: boolean
          timezone: string | null
          updated_at: string
          user_types: string[]
          username: string | null
          website_url: string | null
          weekly_availability: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          collaboration_preferences?: string[]
          contact_email?: string | null
          created_at?: string
          full_name?: string | null
          headline?: string | null
          id: string
          is_public?: boolean
          linkedin_url?: string | null
          location?: string | null
          onboarding_completed?: boolean
          timezone?: string | null
          updated_at?: string
          user_types?: string[]
          username?: string | null
          website_url?: string | null
          weekly_availability?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          collaboration_preferences?: string[]
          contact_email?: string | null
          created_at?: string
          full_name?: string | null
          headline?: string | null
          id?: string
          is_public?: boolean
          linkedin_url?: string | null
          location?: string | null
          onboarding_completed?: boolean
          timezone?: string | null
          updated_at?: string
          user_types?: string[]
          username?: string | null
          website_url?: string | null
          weekly_availability?: number | null
        }
        Relationships: []
      }
      project_links: {
        Row: {
          created_at: string
          id: string
          label: string
          link_type: string
          project_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          link_type: string
          project_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          link_type?: string
          project_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          project_id: string
          role: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          project_id: string
          role?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          project_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_needs: {
        Row: {
          commitment: string | null
          created_at: string
          description: string | null
          id: string
          project_id: string
          skill_id: string | null
          sort_order: number
          status: string
          title: string
        }
        Insert: {
          commitment?: string | null
          created_at?: string
          description?: string | null
          id?: string
          project_id: string
          skill_id?: string | null
          sort_order?: number
          status?: string
          title: string
        }
        Update: {
          commitment?: string | null
          created_at?: string
          description?: string | null
          id?: string
          project_id?: string
          skill_id?: string | null
          sort_order?: number
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_needs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_needs_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          industries: string[]
          is_public: boolean
          name: string
          organization_id: string | null
          owner_id: string
          problem: string | null
          slug: string
          solution: string | null
          stage: string
          status: string
          tagline: string | null
          target_market: string | null
          traction: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          industries?: string[]
          is_public?: boolean
          name: string
          organization_id?: string | null
          owner_id: string
          problem?: string | null
          slug: string
          solution?: string | null
          stage?: string
          status?: string
          tagline?: string | null
          target_market?: string | null
          traction?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          industries?: string[]
          is_public?: boolean
          name?: string
          organization_id?: string | null
          owner_id?: string
          problem?: string | null
          slug?: string
          solution?: string | null
          stage?: string
          status?: string
          tagline?: string | null
          target_market?: string | null
          traction?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_organization_manager: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      is_organization_member: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      is_project_member: { Args: { p_project_id: string }; Returns: boolean }
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
