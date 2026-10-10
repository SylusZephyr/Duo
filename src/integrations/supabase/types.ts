export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      achievements: {
        Row: {
          earned_at: string;
          earned_by: string | null;
          id: string;
          key: string;
          space_id: string;
        };
        Insert: {
          earned_at?: string;
          earned_by?: string | null;
          id?: string;
          key: string;
          space_id: string;
        };
        Update: {
          earned_at?: string;
          earned_by?: string | null;
          id?: string;
          key?: string;
          space_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "achievements_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      album_posts: {
        Row: {
          album_id: string;
          position: number;
          post_id: string;
        };
        Insert: {
          album_id: string;
          position?: number;
          post_id: string;
        };
        Update: {
          album_id?: string;
          position?: number;
          post_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "album_posts_album_id_fkey";
            columns: ["album_id"];
            isOneToOne: false;
            referencedRelation: "albums";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "album_posts_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      albums: {
        Row: {
          cover_path: string | null;
          created_at: string;
          created_by: string;
          description: string | null;
          ends_on: string | null;
          id: string;
          space_id: string;
          starts_on: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          cover_path?: string | null;
          created_at?: string;
          created_by: string;
          description?: string | null;
          ends_on?: string | null;
          id?: string;
          space_id: string;
          starts_on?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          cover_path?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          ends_on?: string | null;
          id?: string;
          space_id?: string;
          starts_on?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "albums_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      bucket_list: {
        Row: {
          created_at: string;
          created_by: string;
          done: boolean;
          done_at: string | null;
          done_by: string | null;
          id: string;
          note: string | null;
          space_id: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          done?: boolean;
          done_at?: string | null;
          done_by?: string | null;
          id?: string;
          note?: string | null;
          space_id: string;
          title: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          done?: boolean;
          done_at?: string | null;
          done_by?: string | null;
          id?: string;
          note?: string | null;
          space_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bucket_list_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      countdowns: {
        Row: {
          created_at: string;
          created_by: string;
          emoji: string;
          happens_at: string;
          id: string;
          repeats_yearly: boolean;
          space_id: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          emoji?: string;
          happens_at: string;
          id?: string;
          repeats_yearly?: boolean;
          space_id: string;
          title: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          emoji?: string;
          happens_at?: string;
          id?: string;
          repeats_yearly?: boolean;
          space_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "countdowns_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      game_answers: {
        Row: {
          answer: string;
          created_at: string;
          id: string;
          is_correct: boolean | null;
          round_id: string;
          space_id: string;
          user_id: string;
        };
        Insert: {
          answer: string;
          created_at?: string;
          id?: string;
          is_correct?: boolean | null;
          round_id: string;
          space_id: string;
          user_id: string;
        };
        Update: {
          answer?: string;
          created_at?: string;
          id?: string;
          is_correct?: boolean | null;
          round_id?: string;
          space_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_answers_round_id_fkey";
            columns: ["round_id"];
            isOneToOne: false;
            referencedRelation: "game_rounds";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_answers_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      game_rounds: {
        Row: {
          created_at: string;
          created_by: string;
          game: string;
          id: string;
          options: Json;
          question: string;
          round_date: string;
          space_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          game: string;
          id?: string;
          options?: Json;
          question: string;
          round_date?: string;
          space_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          game?: string;
          id?: string;
          options?: Json;
          question?: string;
          round_date?: string;
          space_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_rounds_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      gift_ideas: {
        Row: {
          claimed: boolean;
          created_at: string;
          created_by: string;
          for_user: string | null;
          id: string;
          note: string | null;
          price: string | null;
          space_id: string;
          title: string;
          url: string | null;
        };
        Insert: {
          claimed?: boolean;
          created_at?: string;
          created_by: string;
          for_user?: string | null;
          id?: string;
          note?: string | null;
          price?: string | null;
          space_id: string;
          title: string;
          url?: string | null;
        };
        Update: {
          claimed?: boolean;
          created_at?: string;
          created_by?: string;
          for_user?: string | null;
          id?: string;
          note?: string | null;
          price?: string | null;
          space_id?: string;
          title?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "gift_ideas_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      journal_entries: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          entry_date: string;
          id: string;
          is_sealed: boolean;
          mood: string | null;
          photo_path: string | null;
          space_id: string;
          title: string;
          unlock_announced_at: string | null;
          unlock_at: string | null;
          updated_at: string;
        };
        Insert: {
          author_id: string;
          body?: string;
          created_at?: string;
          entry_date?: string;
          id?: string;
          is_sealed?: boolean;
          mood?: string | null;
          photo_path?: string | null;
          space_id: string;
          title?: string;
          unlock_announced_at?: string | null;
          unlock_at?: string | null;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          entry_date?: string;
          id?: string;
          is_sealed?: boolean;
          mood?: string | null;
          photo_path?: string | null;
          space_id?: string;
          title?: string;
          unlock_announced_at?: string | null;
          unlock_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "journal_entries_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      message_reactions: {
        Row: {
          created_at: string;
          emoji: string;
          id: string;
          message_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          emoji: string;
          id?: string;
          message_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          emoji?: string;
          id?: string;
          message_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          kind: string;
          reply_to: string | null;
          seen_at: string | null;
          space_id: string;
          storage_path: string | null;
        };
        Insert: {
          author_id: string;
          body?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          reply_to?: string | null;
          seen_at?: string | null;
          space_id: string;
          storage_path?: string | null;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          reply_to?: string | null;
          seen_at?: string | null;
          space_id?: string;
          storage_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_fkey";
            columns: ["reply_to"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      milestones: {
        Row: {
          created_at: string;
          created_by: string;
          description: string | null;
          happened_at: string;
          id: string;
          photo_path: string | null;
          space_id: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          description?: string | null;
          happened_at?: string;
          id?: string;
          photo_path?: string | null;
          space_id: string;
          title: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          description?: string | null;
          happened_at?: string;
          id?: string;
          photo_path?: string | null;
          space_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "milestones_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_prefs: {
        Row: {
          anniversaries: boolean;
          comments: boolean;
          partner_posted: boolean;
          quiet_from: number;
          quiet_to: number;
          reactions: boolean;
          sealed_unlocked: boolean;
          streaks: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          anniversaries?: boolean;
          comments?: boolean;
          partner_posted?: boolean;
          quiet_from?: number;
          quiet_to?: number;
          reactions?: boolean;
          sealed_unlocked?: boolean;
          streaks?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          anniversaries?: boolean;
          comments?: boolean;
          partner_posted?: boolean;
          quiet_from?: number;
          quiet_to?: number;
          reactions?: boolean;
          sealed_unlocked?: boolean;
          streaks?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          kind: string;
          link: string | null;
          read_at: string | null;
          space_id: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          link?: string | null;
          read_at?: string | null;
          space_id?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          link?: string | null;
          read_at?: string | null;
          space_id?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      post_comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          post_id: string;
        };
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          post_id: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          post_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_media: {
        Row: {
          blur_data_url: string | null;
          byte_size: number | null;
          created_at: string;
          height: number | null;
          id: string;
          mime_type: string | null;
          position: number;
          post_id: string;
          storage_path: string;
          width: number | null;
        };
        Insert: {
          blur_data_url?: string | null;
          byte_size?: number | null;
          created_at?: string;
          height?: number | null;
          id?: string;
          mime_type?: string | null;
          position?: number;
          post_id: string;
          storage_path: string;
          width?: number | null;
        };
        Update: {
          blur_data_url?: string | null;
          byte_size?: number | null;
          created_at?: string;
          height?: number | null;
          id?: string;
          mime_type?: string | null;
          position?: number;
          post_id?: string;
          storage_path?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_reactions: {
        Row: {
          created_at: string;
          emoji: string;
          id: string;
          post_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          emoji: string;
          id?: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          emoji?: string;
          id?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_tags: {
        Row: {
          created_at: string;
          id: string;
          post_id: string;
          tag: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          post_id: string;
          tag: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          post_id?: string;
          tag?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_tags_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          author_id: string;
          caption: string;
          city: string | null;
          country: string | null;
          created_at: string;
          id: string;
          lat: number | null;
          lng: number | null;
          mood: string | null;
          place_name: string | null;
          space_id: string;
          taken_at: string;
          updated_at: string;
          visibility: string;
        };
        Insert: {
          author_id: string;
          caption?: string;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          mood?: string | null;
          place_name?: string | null;
          space_id: string;
          taken_at?: string;
          updated_at?: string;
          visibility?: string;
        };
        Update: {
          author_id?: string;
          caption?: string;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          mood?: string | null;
          place_name?: string | null;
          space_id?: string;
          taken_at?: string;
          updated_at?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          handle: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          handle?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          handle?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      prompt_answers: {
        Row: {
          answer_date: string;
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          prompt_id: string;
          space_id: string;
        };
        Insert: {
          answer_date?: string;
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          prompt_id: string;
          space_id: string;
        };
        Update: {
          answer_date?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          prompt_id?: string;
          space_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prompt_answers_prompt_id_fkey";
            columns: ["prompt_id"];
            isOneToOne: false;
            referencedRelation: "prompts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prompt_answers_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      prompts: {
        Row: {
          body: string;
          category: string;
          created_at: string;
          day_index: number;
          id: string;
        };
        Insert: {
          body: string;
          category?: string;
          created_at?: string;
          day_index: number;
          id?: string;
        };
        Update: {
          body?: string;
          category?: string;
          created_at?: string;
          day_index?: number;
          id?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          post_id: string;
          reason: string;
          reporter_id: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          post_id: string;
          reason: string;
          reporter_id: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          post_id?: string;
          reason?: string;
          reporter_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      space_members: {
        Row: {
          joined_at: string;
          space_id: string;
          user_id: string;
        };
        Insert: {
          joined_at?: string;
          space_id: string;
          user_id: string;
        };
        Update: {
          joined_at?: string;
          space_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "space_members_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      spaces: {
        Row: {
          anniversary_date: string | null;
          cover_path: string | null;
          created_at: string;
          created_by: string;
          handle: string | null;
          id: string;
          invite_code: string;
          invite_code_expires_at: string | null;
          invite_code_rotated_at: string;
          is_public: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          anniversary_date?: string | null;
          cover_path?: string | null;
          created_at?: string;
          created_by: string;
          handle?: string | null;
          id?: string;
          invite_code: string;
          invite_code_expires_at?: string | null;
          invite_code_rotated_at?: string;
          is_public?: boolean;
          name?: string;
          updated_at?: string;
        };
        Update: {
          anniversary_date?: string | null;
          cover_path?: string | null;
          created_at?: string;
          created_by?: string;
          handle?: string | null;
          id?: string;
          invite_code?: string;
          invite_code_expires_at?: string | null;
          invite_code_rotated_at?: string;
          is_public?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stories: {
        Row: {
          author_id: string;
          blur_data_url: string | null;
          caption: string;
          created_at: string;
          expires_at: string;
          id: string;
          space_id: string;
          storage_path: string;
        };
        Insert: {
          author_id: string;
          blur_data_url?: string | null;
          caption?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          space_id: string;
          storage_path: string;
        };
        Update: {
          author_id?: string;
          blur_data_url?: string | null;
          caption?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          space_id?: string;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stories_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      story_views: {
        Row: {
          id: string;
          story_id: string;
          user_id: string;
          viewed_at: string;
        };
        Insert: {
          id?: string;
          story_id: string;
          user_id: string;
          viewed_at?: string;
        };
        Update: {
          id?: string;
          story_id?: string;
          user_id?: string;
          viewed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey";
            columns: ["story_id"];
            isOneToOne: false;
            referencedRelation: "stories";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      wishlist_places: {
        Row: {
          city: string | null;
          country: string | null;
          created_at: string;
          created_by: string;
          id: string;
          lat: number | null;
          lng: number | null;
          name: string;
          note: string | null;
          space_id: string;
          visited: boolean;
        };
        Insert: {
          city?: string | null;
          country?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          name: string;
          note?: string | null;
          space_id: string;
          visited?: boolean;
        };
        Update: {
          city?: string | null;
          country?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          name?: string;
          note?: string | null;
          space_id?: string;
          visited?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "wishlist_places_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_access_storage_path: {
        Args: { _name: string; _user_id: string };
        Returns: boolean;
      };
      can_read_post: {
        Args: { _post_id: string; _user_id: string };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_post_public: { Args: { _post_id: string }; Returns: boolean };
      is_space_member: {
        Args: { _space_id: string; _user_id: string };
        Returns: boolean;
      };
      announce_unlocked_letters: { Args: Record<string, never>; Returns: number };
      create_space: {
        Args: { _anniversary?: string | null; _name: string };
        Returns: Database["public"]["Tables"]["spaces"]["Row"];
      };
      join_space_by_code: { Args: { _code: string }; Returns: string };
      rotate_invite_code: { Args: { _space_id: string }; Returns: string };
      space_member_count: { Args: { _space_id: string }; Returns: number };
    };
    Enums: {
      app_role: "admin" | "moderator" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const;
