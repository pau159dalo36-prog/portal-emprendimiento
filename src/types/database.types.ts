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
      organization_follows: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_follows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_follows_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
          search_text: string | null
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
          search_text?: string | null
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
          search_text?: string | null
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
      posts: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          id: string
          organization_id: string | null
          post_type: string
          project_id: string | null
          publication_status: string
          published_at: string | null
          updated_at: string
          video_id: string | null
          visibility: string
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          post_type?: string
          project_id?: string | null
          publication_status?: string
          published_at?: string | null
          updated_at?: string
          video_id?: string | null
          visibility?: string
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          post_type?: string
          project_id?: string | null
          publication_status?: string
          published_at?: string | null
          updated_at?: string
          video_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "videos"
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
          search_text: string | null
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
          search_text?: string | null
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
          search_text?: string | null
          timezone?: string | null
          updated_at?: string
          user_types?: string[]
          username?: string | null
          website_url?: string | null
          weekly_availability?: number | null
        }
        Relationships: []
      }
      project_follows: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_follows_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_follows_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          search_text: string | null
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
          search_text?: string | null
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
          search_text?: string | null
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
      video_languages: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      video_view_sessions: {
        Row: {
          anonymous_session_id: string | null
          completed: boolean
          created_at: string
          id: string
          last_seen_at: string
          max_progress: number
          plays: number
          post_id: string | null
          qualified: boolean
          started_at: string
          updated_at: string
          video_id: string
          viewer_id: string | null
          watch_seconds: number
        }
        Insert: {
          anonymous_session_id?: string | null
          completed?: boolean
          created_at?: string
          id?: string
          last_seen_at?: string
          max_progress?: number
          plays?: number
          post_id?: string | null
          qualified?: boolean
          started_at?: string
          updated_at?: string
          video_id: string
          viewer_id?: string | null
          watch_seconds?: number
        }
        Update: {
          anonymous_session_id?: string | null
          completed?: boolean
          created_at?: string
          id?: string
          last_seen_at?: string
          max_progress?: number
          plays?: number
          post_id?: string | null
          qualified?: boolean
          started_at?: string
          updated_at?: string
          video_id?: string
          viewer_id?: string | null
          watch_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "video_view_sessions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_view_sessions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_view_sessions_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          aspect_ratio: string | null
          caption: string | null
          captions_path: string | null
          created_at: string
          duration_seconds: number | null
          height: number | null
          id: string
          mime_type: string
          moderated_at: string | null
          moderated_by: string | null
          moderation_reason: string | null
          moderation_status: string
          organization_id: string | null
          original_filename: string | null
          original_language: string
          owner_id: string
          poster_bucket: string | null
          poster_path: string | null
          processing_status: string
          project_id: string | null
          published_at: string | null
          search_text: string | null
          size_bytes: number
          status: string
          storage_bucket: string
          storage_path: string
          thumbnail_bucket: string | null
          thumbnail_path: string | null
          title: string
          transcript: string | null
          updated_at: string
          visibility: string
          width: number | null
        }
        Insert: {
          aspect_ratio?: string | null
          caption?: string | null
          captions_path?: string | null
          created_at?: string
          duration_seconds?: number | null
          height?: number | null
          id?: string
          mime_type: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_status?: string
          organization_id?: string | null
          original_filename?: string | null
          original_language?: string
          owner_id: string
          poster_bucket?: string | null
          poster_path?: string | null
          processing_status?: string
          project_id?: string | null
          published_at?: string | null
          search_text?: string | null
          size_bytes: number
          status?: string
          storage_bucket: string
          storage_path: string
          thumbnail_bucket?: string | null
          thumbnail_path?: string | null
          title: string
          transcript?: string | null
          updated_at?: string
          visibility?: string
          width?: number | null
        }
        Update: {
          aspect_ratio?: string | null
          caption?: string | null
          captions_path?: string | null
          created_at?: string
          duration_seconds?: number | null
          height?: number | null
          id?: string
          mime_type?: string
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_reason?: string | null
          moderation_status?: string
          organization_id?: string | null
          original_filename?: string | null
          original_language?: string
          owner_id?: string
          poster_bucket?: string | null
          poster_path?: string | null
          processing_status?: string
          project_id?: string | null
          published_at?: string | null
          search_text?: string | null
          size_bytes?: number
          status?: string
          storage_bucket?: string
          storage_path?: string
          thumbnail_bucket?: string | null
          thumbnail_path?: string | null
          title?: string
          transcript?: string | null
          updated_at?: string
          visibility?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _video_metrics_aggregate: {
        Args: { p_video_id: string }
        Returns: {
          average_progress: number
          average_watch_seconds: number
          completion_rate: number
          last_interaction: string
          plays: number
          qualified_views: number
          total_watch_seconds: number
          unique_viewers: number
        }[]
      }
      admin_approve_video: { Args: { p_video_id: string }; Returns: boolean }
      admin_flag_video: {
        Args: { p_reason?: string; p_video_id: string }
        Returns: boolean
      }
      admin_reject_video: {
        Args: { p_reason?: string; p_video_id: string }
        Returns: boolean
      }
      can_access_video_storage: {
        Args: { p_bucket: string; p_path: string }
        Returns: boolean
      }
      count_organization_followers: {
        Args: { p_organization_id: string }
        Returns: number
      }
      count_profile_followers: {
        Args: { p_profile_id: string }
        Returns: number
      }
      count_profile_following: {
        Args: { p_profile_id: string }
        Returns: number
      }
      count_project_followers: {
        Args: { p_project_id: string }
        Returns: number
      }
      get_following_feed: {
        Args: {
          p_cursor_id?: string
          p_cursor_published_at?: string
          p_limit?: number
        }
        Returns: {
          author_avatar_url: string
          author_full_name: string
          author_id: string
          author_username: string
          average_progress: number
          average_watch_seconds: number
          completion_rate: number
          organization_id: string
          organization_name: string
          organization_slug: string
          plays: number
          post_body: string
          post_created_at: string
          post_id: string
          post_post_type: string
          post_updated_at: string
          project_id: string
          project_name: string
          project_slug: string
          published_at: string
          qualified_views: number
          video_caption: string
          video_duration_seconds: number
          video_height: number
          video_id: string
          video_poster_bucket: string
          video_poster_path: string
          video_thumbnail_bucket: string
          video_thumbnail_path: string
          video_title: string
          video_width: number
        }[]
      }
      get_for_you_feed: {
        Args: {
          p_cursor_id?: string
          p_cursor_published_at?: string
          p_cursor_score?: number
          p_limit?: number
        }
        Returns: {
          affinity_score: number
          author_avatar_url: string
          author_full_name: string
          author_id: string
          author_username: string
          average_progress: number
          average_watch_seconds: number
          completion_rate: number
          completion_score: number
          exploration_score: number
          final_score: number
          organization_id: string
          organization_name: string
          organization_slug: string
          plays: number
          post_body: string
          post_created_at: string
          post_id: string
          post_post_type: string
          post_updated_at: string
          project_id: string
          project_name: string
          project_slug: string
          published_at: string
          qualified_views: number
          recency_score: number
          video_caption: string
          video_duration_seconds: number
          video_height: number
          video_id: string
          video_poster_bucket: string
          video_poster_path: string
          video_thumbnail_bucket: string
          video_thumbnail_path: string
          video_title: string
          video_width: number
          views_score: number
          watch_score: number
        }[]
      }
      get_post_metrics: {
        Args: { p_post_id: string }
        Returns: {
          average_progress: number
          average_watch_seconds: number
          completion_rate: number
          last_interaction: string
          plays: number
          qualified_views: number
          total_watch_seconds: number
          unique_viewers: number
        }[]
      }
      get_public_video_views_count: {
        Args: { p_video_id: string }
        Returns: number
      }
      get_video_metrics: {
        Args: { p_video_id: string }
        Returns: {
          average_progress: number
          average_watch_seconds: number
          completion_rate: number
          last_interaction: string
          plays: number
          qualified_views: number
          total_watch_seconds: number
          unique_viewers: number
        }[]
      }
      is_organization_manager: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      is_organization_member: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_project_member: { Args: { p_project_id: string }; Returns: boolean }
      post_is_publicly_distributable: {
        Args: {
          p_publication_status: string
          p_video_id: string
          p_visibility: string
        }
        Returns: boolean
      }
      report_video_view: {
        Args: {
          p_anonymous_session_id?: string
          p_progress?: number
          p_video_id: string
          p_watch_delta?: number
        }
        Returns: {
          completed: boolean
          max_progress: number
          qualified: boolean
          watch_seconds: number
        }[]
      }
      search_array_to_text: { Args: { p_values: string[] }; Returns: string }
      search_normalize: { Args: { p_value: string }; Returns: string }
      search_organizations: {
        Args: {
          p_cursor_created_at?: string
          p_cursor_id?: string
          p_cursor_score?: number
          p_industry?: string
          p_limit?: number
          p_query?: string
          p_sort?: string
        }
        Returns: {
          created_at: string
          description: string
          headline: string
          industries: string[]
          location: string
          logo_url: string
          name: string
          organization_id: string
          owner_avatar_url: string
          owner_full_name: string
          owner_id: string
          owner_username: string
          search_score: number
          slug: string
        }[]
      }
      search_profiles: {
        Args: {
          p_cursor_created_at?: string
          p_cursor_id?: string
          p_cursor_score?: number
          p_language?: string
          p_limit?: number
          p_query?: string
          p_role?: string
          p_sort?: string
        }
        Returns: {
          avatar_url: string
          bio: string
          created_at: string
          full_name: string
          headline: string
          is_following: boolean
          location: string
          profile_id: string
          search_score: number
          user_types: string[]
          username: string
        }[]
      }
      search_projects: {
        Args: {
          p_cursor_created_at?: string
          p_cursor_id?: string
          p_cursor_score?: number
          p_industry?: string
          p_limit?: number
          p_query?: string
          p_sort?: string
          p_stage?: string
        }
        Returns: {
          cover_image_url: string
          created_at: string
          description: string
          industries: string[]
          name: string
          organization_id: string
          organization_name: string
          organization_slug: string
          owner_avatar_url: string
          owner_full_name: string
          owner_id: string
          owner_username: string
          project_id: string
          search_score: number
          slug: string
          stage: string
          tagline: string
        }[]
      }
      search_recency: {
        Args: { p_created_at: string; p_ref?: string }
        Returns: number
      }
      search_videos: {
        Args: {
          p_cursor_created_at?: string
          p_cursor_id?: string
          p_cursor_score?: number
          p_language?: string
          p_limit?: number
          p_query?: string
          p_sort?: string
        }
        Returns: {
          caption: string
          created_at: string
          duration_seconds: number
          height: number
          organization_id: string
          organization_name: string
          organization_slug: string
          owner_avatar_url: string
          owner_full_name: string
          owner_id: string
          owner_username: string
          poster_bucket: string
          poster_path: string
          project_id: string
          project_name: string
          project_slug: string
          search_score: number
          thumbnail_bucket: string
          thumbnail_path: string
          title: string
          video_id: string
          width: number
        }[]
      }
      video_analytics_access: { Args: { p_video_id: string }; Returns: string }
      video_is_publicly_distributable: {
        Args: { p_moderation_status: string }
        Returns: boolean
      }
      video_visibility_class: {
        Args: { p_visibility: string }
        Returns: string
      }
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
