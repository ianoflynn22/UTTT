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
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_analyses: {
        Row: {
          analysis: Json
          created_at: string
          game_id: string
          id: string
          mode: string
          user_id: string
        }
        Insert: {
          analysis: Json
          created_at?: string
          game_id: string
          id?: string
          mode: string
          user_id: string
        }
        Update: {
          analysis?: Json
          created_at?: string
          game_id?: string
          id?: string
          mode?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_analyses_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_analyses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          created_by: string | null
          elo_applied: boolean
          elo_before_o: number | null
          elo_before_x: number | null
          elo_delta_o: number | null
          elo_delta_x: number | null
          id: string
          mode: string
          move_seq: number
          moves: Json
          player_o: string | null
          player_x: string
          state: Json
          status: string
          updated_at: string
          winner: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          elo_applied?: boolean
          elo_before_o?: number | null
          elo_before_x?: number | null
          elo_delta_o?: number | null
          elo_delta_x?: number | null
          id?: string
          mode: string
          move_seq?: number
          moves?: Json
          player_o?: string | null
          player_x: string
          state: Json
          status?: string
          updated_at?: string
          winner?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          elo_applied?: boolean
          elo_before_o?: number | null
          elo_before_x?: number | null
          elo_delta_o?: number | null
          elo_delta_x?: number | null
          id?: string
          mode?: string
          move_seq?: number
          moves?: Json
          player_o?: string | null
          player_x?: string
          state?: Json
          status?: string
          updated_at?: string
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_player_o_fkey"
            columns: ["player_o"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_player_x_fkey"
            columns: ["player_x"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_queue: {
        Row: {
          created_at: string
          mode: string
          user_id: string
        }
        Insert: {
          created_at?: string
          mode: string
          user_id: string
        }
        Update: {
          created_at?: string
          mode?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_presence: {
        Row: {
          last_seen: string
          user_id: string
        }
        Insert: {
          last_seen?: string
          user_id: string
        }
        Update: {
          last_seen?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          country: string | null
          created_at: string
          id: string
          username: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id: string
          username: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      puzzle_solves: {
        Row: {
          created_at: string
          day: string
          moves: number | null
          tries: number
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          moves?: number | null
          tries?: number
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          moves?: number | null
          tries?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "puzzle_solves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          draws: number
          elo: number
          games: number
          losses: number
          mode: string
          user_id: string
          wins: number
        }
        Insert: {
          draws?: number
          elo?: number
          games?: number
          losses?: number
          mode: string
          user_id: string
          wins?: number
        }
        Update: {
          draws?: number
          elo?: number
          games?: number
          losses?: number
          mode?: string
          user_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite_link: { Args: { _username: string }; Returns: string }
      admin_stats: { Args: never; Returns: Json }
      apply_elo_result: { Args: { _game_id: string }; Returns: Json }
      block_user: { Args: { _other: string }; Returns: undefined }
      can_watch_game: { Args: { _game_id: string }; Returns: boolean }
      challenge_friend: {
        Args: { _friend_id: string; _mode: string }
        Returns: string
      }
      create_lobby: { Args: { _mode: string }; Returns: string }
      delete_friend_game: { Args: { _game_id: string }; Returns: undefined }
      find_or_create_match: { Args: { _mode: string }; Returns: string }
      friend_activity: { Args: never; Returns: Json }
      has_role: { Args: { _role: string }; Returns: boolean }
      initial_state: { Args: { _mode: string }; Returns: Json }
      is_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      join_lobby: { Args: { _game_id: string }; Returns: string }
      lobby_heartbeat: { Args: { _game_id: string }; Returns: undefined }
      open_lobby: {
        Args: { _username: string }
        Returns: {
          game_id: string
          mode: string
        }[]
      }
      presence_heartbeat: { Args: never; Returns: undefined }
      puzzle_day_scores: {
        Args: { _day: string }
        Returns: {
          country: string
          moves: number
          tries: number
          user_id: string
          username: string
        }[]
      }
      puzzle_streaks: {
        Args: never
        Returns: {
          best_streak: number
          country: string
          current_streak: number
          user_id: string
          username: string
        }[]
      }
      record_puzzle_solve: {
        Args: { _day: string; _moves: number; _tries: number; _user: string }
        Returns: undefined
      }
      rematch_opponent: { Args: { _game_id: string }; Returns: string }
      respond_challenge: {
        Args: { _accept: boolean; _game_id: string }
        Returns: string
      }
      username_is_blocked: { Args: { _name: string }; Returns: boolean }
      watch_friend_game: { Args: { _game_id: string }; Returns: Json }
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
    Enums: {},
  },
} as const
