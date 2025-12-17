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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chamados: {
        Row: {
          cliente_id: string | null
          created_at: string
          destino_address: string | null
          destino_lat: number | null
          destino_lng: number | null
          id: string
          origem_address: string
          origem_lat: number
          origem_lng: number
          payment_method: string | null
          payment_provider: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          prestador_id: string | null
          status: Database["public"]["Enums"]["chamado_status"]
          stripe_payment_intent_id: string | null
          tipo_servico: Database["public"]["Enums"]["service_type"]
          updated_at: string
          valor: number | null
          valor_proposto: number | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          destino_address?: string | null
          destino_lat?: number | null
          destino_lng?: number | null
          id?: string
          origem_address: string
          origem_lat: number
          origem_lng: number
          payment_method?: string | null
          payment_provider?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          prestador_id?: string | null
          status?: Database["public"]["Enums"]["chamado_status"]
          stripe_payment_intent_id?: string | null
          tipo_servico: Database["public"]["Enums"]["service_type"]
          updated_at?: string
          valor?: number | null
          valor_proposto?: number | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          destino_address?: string | null
          destino_lat?: number | null
          destino_lng?: number | null
          id?: string
          origem_address?: string
          origem_lat?: number
          origem_lng?: number
          payment_method?: string | null
          payment_provider?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          prestador_id?: string | null
          status?: Database["public"]["Enums"]["chamado_status"]
          stripe_payment_intent_id?: string | null
          tipo_servico?: Database["public"]["Enums"]["service_type"]
          updated_at?: string
          valor?: number | null
          valor_proposto?: number | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          chamado_id: string
          created_at: string
          id: string
          message: string
          sender_id: string | null
          sender_type: Database["public"]["Enums"]["user_profile_type"]
        }
        Insert: {
          chamado_id: string
          created_at?: string
          id?: string
          message: string
          sender_id?: string | null
          sender_type: Database["public"]["Enums"]["user_profile_type"]
        }
        Update: {
          chamado_id?: string
          created_at?: string
          id?: string
          message?: string
          sender_id?: string | null
          sender_type?: Database["public"]["Enums"]["user_profile_type"]
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_profile:
            | Database["public"]["Enums"]["user_profile_type"]
            | null
          avatar_url: string | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          perfil_principal: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_profile?:
            | Database["public"]["Enums"]["user_profile_type"]
            | null
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          perfil_principal?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_profile?:
            | Database["public"]["Enums"]["user_profile_type"]
            | null
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          perfil_principal?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_data: {
        Row: {
          created_at: string
          current_address: string | null
          current_lat: number | null
          current_lng: number | null
          id: string
          is_online: boolean | null
          radar_range: number | null
          rating: number | null
          services_offered: Database["public"]["Enums"]["service_type"][] | null
          total_services: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_address?: string | null
          current_lat?: number | null
          current_lng?: number | null
          id?: string
          is_online?: boolean | null
          radar_range?: number | null
          rating?: number | null
          services_offered?:
            | Database["public"]["Enums"]["service_type"][]
            | null
          total_services?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_address?: string | null
          current_lat?: number | null
          current_lng?: number | null
          id?: string
          is_online?: boolean | null
          radar_range?: number | null
          rating?: number | null
          services_offered?:
            | Database["public"]["Enums"]["service_type"][]
            | null
          total_services?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          chamado_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewed_id: string
          reviewer_id: string
          reviewer_type: Database["public"]["Enums"]["user_profile_type"]
          tags: string[] | null
        }
        Insert: {
          chamado_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewed_id: string
          reviewer_id: string
          reviewer_type: Database["public"]["Enums"]["user_profile_type"]
          tags?: string[] | null
        }
        Update: {
          chamado_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewed_id?: string
          reviewer_id?: string
          reviewer_type?: Database["public"]["Enums"]["user_profile_type"]
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_provider: { Args: { _user_id: string }; Returns: boolean }
      is_provider_active: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      chamado_status:
        | "idle"
        | "searching"
        | "accepted"
        | "negotiating"
        | "awaiting_payment"
        | "in_service"
        | "finished"
        | "canceled"
      payment_status:
        | "pending"
        | "paid_mock"
        | "paid_stripe"
        | "failed"
        | "refunded"
      service_type: "guincho" | "borracharia" | "mecanica" | "chaveiro"
      user_profile_type: "client" | "provider"
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
      chamado_status: [
        "idle",
        "searching",
        "accepted",
        "negotiating",
        "awaiting_payment",
        "in_service",
        "finished",
        "canceled",
      ],
      payment_status: [
        "pending",
        "paid_mock",
        "paid_stripe",
        "failed",
        "refunded",
      ],
      service_type: ["guincho", "borracharia", "mecanica", "chaveiro"],
      user_profile_type: ["client", "provider"],
    },
  },
} as const
