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
      address_history: {
        Row: {
          address: string
          created_at: string
          id: string
          last_used_at: string
          lat: number
          lng: number
          place_id: string | null
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          last_used_at?: string
          lat: number
          lng: number
          place_id?: string | null
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          last_used_at?: string
          lat?: number
          lng?: number
          place_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      blocked_credentials: {
        Row: {
          block_reason: string
          blocked_at: string | null
          blocked_by: string | null
          created_at: string | null
          credential_type: string
          credential_value: string
          id: string
          notes: string | null
          original_user_id: string | null
        }
        Insert: {
          block_reason: string
          blocked_at?: string | null
          blocked_by?: string | null
          created_at?: string | null
          credential_type: string
          credential_value: string
          id?: string
          notes?: string | null
          original_user_id?: string | null
        }
        Update: {
          block_reason?: string
          blocked_at?: string | null
          blocked_by?: string | null
          created_at?: string | null
          credential_type?: string
          credential_value?: string
          id?: string
          notes?: string | null
          original_user_id?: string | null
        }
        Relationships: []
      }
      chamados: {
        Row: {
          cancellation_category: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cliente_id: string | null
          commission_amount: number | null
          commission_percentage: number | null
          created_at: string
          declined_provider_ids: string[] | null
          destino_address: string | null
          destino_lat: number | null
          destino_lng: number | null
          direct_payment_confirmed_at: string | null
          direct_payment_receipt_confirmed: boolean | null
          direct_payment_to_provider: boolean | null
          id: string
          last_proposal_by: string | null
          navigation_phase: string | null
          origem_address: string
          origem_lat: number
          origem_lng: number
          payment_completed_at: string | null
          payment_method: string | null
          payment_provider: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          prestador_id: string | null
          provider_amount: number | null
          provider_arrived_at_destination: boolean | null
          provider_arrived_at_vehicle: boolean | null
          provider_finish_requested_at: string | null
          route_distance_meters: number | null
          route_duration_seconds: number | null
          route_polyline: string | null
          status: Database["public"]["Enums"]["chamado_status"]
          stripe_application_fee_amount: number | null
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          time_to_cancel_seconds: number | null
          tipo_servico: Database["public"]["Enums"]["service_type"]
          updated_at: string
          valor: number | null
          valor_proposto: number | null
          value_accepted: boolean | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Insert: {
          cancellation_category?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cliente_id?: string | null
          commission_amount?: number | null
          commission_percentage?: number | null
          created_at?: string
          declined_provider_ids?: string[] | null
          destino_address?: string | null
          destino_lat?: number | null
          destino_lng?: number | null
          direct_payment_confirmed_at?: string | null
          direct_payment_receipt_confirmed?: boolean | null
          direct_payment_to_provider?: boolean | null
          id?: string
          last_proposal_by?: string | null
          navigation_phase?: string | null
          origem_address: string
          origem_lat: number
          origem_lng: number
          payment_completed_at?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          prestador_id?: string | null
          provider_amount?: number | null
          provider_arrived_at_destination?: boolean | null
          provider_arrived_at_vehicle?: boolean | null
          provider_finish_requested_at?: string | null
          route_distance_meters?: number | null
          route_duration_seconds?: number | null
          route_polyline?: string | null
          status?: Database["public"]["Enums"]["chamado_status"]
          stripe_application_fee_amount?: number | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          time_to_cancel_seconds?: number | null
          tipo_servico: Database["public"]["Enums"]["service_type"]
          updated_at?: string
          valor?: number | null
          valor_proposto?: number | null
          value_accepted?: boolean | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Update: {
          cancellation_category?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cliente_id?: string | null
          commission_amount?: number | null
          commission_percentage?: number | null
          created_at?: string
          declined_provider_ids?: string[] | null
          destino_address?: string | null
          destino_lat?: number | null
          destino_lng?: number | null
          direct_payment_confirmed_at?: string | null
          direct_payment_receipt_confirmed?: boolean | null
          direct_payment_to_provider?: boolean | null
          id?: string
          last_proposal_by?: string | null
          navigation_phase?: string | null
          origem_address?: string
          origem_lat?: number
          origem_lng?: number
          payment_completed_at?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          prestador_id?: string | null
          provider_amount?: number | null
          provider_arrived_at_destination?: boolean | null
          provider_arrived_at_vehicle?: boolean | null
          provider_finish_requested_at?: string | null
          route_distance_meters?: number | null
          route_duration_seconds?: number | null
          route_polyline?: string | null
          status?: Database["public"]["Enums"]["chamado_status"]
          stripe_application_fee_amount?: number | null
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          time_to_cancel_seconds?: number | null
          tipo_servico?: Database["public"]["Enums"]["service_type"]
          updated_at?: string
          valor?: number | null
          valor_proposto?: number | null
          value_accepted?: boolean | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
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
      fraud_history: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          performed_by: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      internal_notification_reads: {
        Row: {
          id: string
          lida_em: string
          notificacao_id: string
          usuario_id: string
        }
        Insert: {
          id?: string
          lida_em?: string
          notificacao_id: string
          usuario_id: string
        }
        Update: {
          id?: string
          lida_em?: string
          notificacao_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_notification_reads_notificacao_id_fkey"
            columns: ["notificacao_id"]
            isOneToOne: false
            referencedRelation: "internal_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_notifications: {
        Row: {
          agendada_para: string | null
          criada_em: string
          criada_por: string | null
          id: string
          imagem_url: string | null
          publicada: boolean
          publicada_em: string | null
          publico: string
          status: string
          texto: string
          titulo: string
        }
        Insert: {
          agendada_para?: string | null
          criada_em?: string
          criada_por?: string | null
          id?: string
          imagem_url?: string | null
          publicada?: boolean
          publicada_em?: string | null
          publico?: string
          status?: string
          texto: string
          titulo: string
        }
        Update: {
          agendada_para?: string | null
          criada_em?: string
          criada_por?: string | null
          id?: string
          imagem_url?: string | null
          publicada?: boolean
          publicada_em?: string | null
          publico?: string
          status?: string
          texto?: string
          titulo?: string
        }
        Relationships: []
      }
      notification_history: {
        Row: {
          body: string
          clicked_at: string | null
          data: Json | null
          id: string
          notification_type: string
          sent_at: string
          title: string
          user_id: string
        }
        Insert: {
          body: string
          clicked_at?: string | null
          data?: Json | null
          id?: string
          notification_type: string
          sent_at?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string
          clicked_at?: string | null
          data?: Json | null
          id?: string
          notification_type?: string
          sent_at?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          chamado_updates: boolean
          created_at: string
          enabled: boolean
          id: string
          last_engagement_sent_at: string | null
          last_promotional_sent_at: string | null
          permission_asked_at: string | null
          permission_granted: boolean | null
          promotional: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          chamado_updates?: boolean
          created_at?: string
          enabled?: boolean
          id?: string
          last_engagement_sent_at?: string | null
          last_promotional_sent_at?: string | null
          permission_asked_at?: string | null
          permission_granted?: boolean | null
          promotional?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          chamado_updates?: boolean
          created_at?: string
          enabled?: boolean
          id?: string
          last_engagement_sent_at?: string | null
          last_promotional_sent_at?: string | null
          permission_asked_at?: string | null
          permission_granted?: boolean | null
          promotional?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_profile:
            | Database["public"]["Enums"]["user_profile_type"]
            | null
          avatar_url: string | null
          block_reason: string | null
          blocked_at: string | null
          blocked_by: string | null
          client_cancellations_after_accept: number | null
          client_completed_services: number | null
          client_reliability_score: number | null
          client_total_services: number | null
          cpf: string | null
          created_at: string
          email: string | null
          first_service_coupon_used: boolean | null
          id: string
          is_blocked: boolean | null
          last_activity: string | null
          name: string
          password_recovery_count: number | null
          password_recovery_last_at: string | null
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
          block_reason?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          client_cancellations_after_accept?: number | null
          client_completed_services?: number | null
          client_reliability_score?: number | null
          client_total_services?: number | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          first_service_coupon_used?: boolean | null
          id?: string
          is_blocked?: boolean | null
          last_activity?: string | null
          name: string
          password_recovery_count?: number | null
          password_recovery_last_at?: string | null
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
          block_reason?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          client_cancellations_after_accept?: number | null
          client_completed_services?: number | null
          client_reliability_score?: number | null
          client_total_services?: number | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          first_service_coupon_used?: boolean | null
          id?: string
          is_blocked?: boolean | null
          last_activity?: string | null
          name?: string
          password_recovery_count?: number | null
          password_recovery_last_at?: string | null
          perfil_principal?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_data: {
        Row: {
          block_reason: string | null
          blocked_at: string | null
          blocked_by: string | null
          cancellations_after_accept: number | null
          created_at: string
          current_address: string | null
          current_lat: number | null
          current_lng: number | null
          device_id: string | null
          device_id_registered_at: string | null
          fee_exemption_until: string | null
          financial_block_reason: string | null
          financial_blocked: boolean | null
          financial_status:
            | Database["public"]["Enums"]["financial_status"]
            | null
          fraud_flagged: boolean | null
          fraud_flagged_at: string | null
          fraud_flagged_by: string | null
          fraud_reason: string | null
          id: string
          is_blocked: boolean | null
          is_online: boolean | null
          last_activity: string | null
          last_reliability_update: string | null
          max_debt_limit: number | null
          payout_enabled: boolean | null
          pending_fee_balance: number | null
          pending_fee_warning_sent_at: string | null
          permanently_blocked: boolean | null
          permanently_blocked_at: string | null
          permanently_blocked_by: string | null
          permanently_blocked_reason: string | null
          pix_key: string | null
          pix_key_type: string | null
          radar_range: number | null
          rating: number | null
          registration_complete: boolean | null
          reliability_score: number | null
          services_offered: Database["public"]["Enums"]["service_type"][] | null
          stripe_account_id: string | null
          stripe_charges_enabled: boolean | null
          stripe_connected: boolean | null
          stripe_details_submitted: boolean | null
          stripe_onboarding_completed: boolean | null
          stripe_payouts_enabled: boolean | null
          stripe_status: string | null
          terms_accepted: boolean | null
          terms_accepted_at: string | null
          terms_accepted_version: string | null
          terms_version_required: string | null
          total_accepted_services: number | null
          total_completed_services: number | null
          total_services: number | null
          updated_at: string
          user_id: string
          vehicle_plate: string | null
          vehicle_type: string | null
        }
        Insert: {
          block_reason?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          cancellations_after_accept?: number | null
          created_at?: string
          current_address?: string | null
          current_lat?: number | null
          current_lng?: number | null
          device_id?: string | null
          device_id_registered_at?: string | null
          fee_exemption_until?: string | null
          financial_block_reason?: string | null
          financial_blocked?: boolean | null
          financial_status?:
            | Database["public"]["Enums"]["financial_status"]
            | null
          fraud_flagged?: boolean | null
          fraud_flagged_at?: string | null
          fraud_flagged_by?: string | null
          fraud_reason?: string | null
          id?: string
          is_blocked?: boolean | null
          is_online?: boolean | null
          last_activity?: string | null
          last_reliability_update?: string | null
          max_debt_limit?: number | null
          payout_enabled?: boolean | null
          pending_fee_balance?: number | null
          pending_fee_warning_sent_at?: string | null
          permanently_blocked?: boolean | null
          permanently_blocked_at?: string | null
          permanently_blocked_by?: string | null
          permanently_blocked_reason?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          radar_range?: number | null
          rating?: number | null
          registration_complete?: boolean | null
          reliability_score?: number | null
          services_offered?:
            | Database["public"]["Enums"]["service_type"][]
            | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_connected?: boolean | null
          stripe_details_submitted?: boolean | null
          stripe_onboarding_completed?: boolean | null
          stripe_payouts_enabled?: boolean | null
          stripe_status?: string | null
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          terms_accepted_version?: string | null
          terms_version_required?: string | null
          total_accepted_services?: number | null
          total_completed_services?: number | null
          total_services?: number | null
          updated_at?: string
          user_id: string
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Update: {
          block_reason?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          cancellations_after_accept?: number | null
          created_at?: string
          current_address?: string | null
          current_lat?: number | null
          current_lng?: number | null
          device_id?: string | null
          device_id_registered_at?: string | null
          fee_exemption_until?: string | null
          financial_block_reason?: string | null
          financial_blocked?: boolean | null
          financial_status?:
            | Database["public"]["Enums"]["financial_status"]
            | null
          fraud_flagged?: boolean | null
          fraud_flagged_at?: string | null
          fraud_flagged_by?: string | null
          fraud_reason?: string | null
          id?: string
          is_blocked?: boolean | null
          is_online?: boolean | null
          last_activity?: string | null
          last_reliability_update?: string | null
          max_debt_limit?: number | null
          payout_enabled?: boolean | null
          pending_fee_balance?: number | null
          pending_fee_warning_sent_at?: string | null
          permanently_blocked?: boolean | null
          permanently_blocked_at?: string | null
          permanently_blocked_by?: string | null
          permanently_blocked_reason?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          radar_range?: number | null
          rating?: number | null
          registration_complete?: boolean | null
          reliability_score?: number | null
          services_offered?:
            | Database["public"]["Enums"]["service_type"][]
            | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_connected?: boolean | null
          stripe_details_submitted?: boolean | null
          stripe_onboarding_completed?: boolean | null
          stripe_payouts_enabled?: boolean | null
          stripe_status?: string | null
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          terms_accepted_version?: string | null
          terms_version_required?: string | null
          total_accepted_services?: number | null
          total_completed_services?: number | null
          total_services?: number | null
          updated_at?: string
          user_id?: string
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
      provider_fees: {
        Row: {
          chamado_id: string
          created_at: string
          fee_amount: number
          fee_percentage: number
          fee_type: Database["public"]["Enums"]["fee_type"]
          id: string
          payment_approved_at: string | null
          payment_approved_by: string | null
          payment_declared_at: string | null
          payment_proof_url: string | null
          payment_rejected_at: string | null
          payment_rejected_by: string | null
          provider_id: string
          service_value: number
          status: Database["public"]["Enums"]["financial_status"]
          updated_at: string
        }
        Insert: {
          chamado_id: string
          created_at?: string
          fee_amount: number
          fee_percentage: number
          fee_type: Database["public"]["Enums"]["fee_type"]
          id?: string
          payment_approved_at?: string | null
          payment_approved_by?: string | null
          payment_declared_at?: string | null
          payment_proof_url?: string | null
          payment_rejected_at?: string | null
          payment_rejected_by?: string | null
          provider_id: string
          service_value: number
          status?: Database["public"]["Enums"]["financial_status"]
          updated_at?: string
        }
        Update: {
          chamado_id?: string
          created_at?: string
          fee_amount?: number
          fee_percentage?: number
          fee_type?: Database["public"]["Enums"]["fee_type"]
          id?: string
          payment_approved_at?: string | null
          payment_approved_by?: string | null
          payment_declared_at?: string | null
          payment_proof_url?: string | null
          payment_rejected_at?: string | null
          payment_rejected_by?: string | null
          provider_id?: string
          service_value?: number
          status?: Database["public"]["Enums"]["financial_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_fees_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_payouts: {
        Row: {
          amount: number
          arrival_date: string | null
          created_at: string
          currency: string
          failure_code: string | null
          failure_message: string | null
          id: string
          paid_at: string | null
          provider_id: string
          status: string
          stripe_account_id: string
          stripe_payout_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          arrival_date?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          paid_at?: string | null
          provider_id: string
          status?: string
          stripe_account_id: string
          stripe_payout_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          arrival_date?: string | null
          created_at?: string
          currency?: string
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          paid_at?: string | null
          provider_id?: string
          status?: string
          stripe_account_id?: string
          stripe_payout_id?: string
          updated_at?: string
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
      scheduled_notifications: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          data: Json | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          recipients_count: number | null
          scheduled_at: string
          sent_at: string | null
          sent_count: number | null
          status: string
          target_type: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          data?: Json | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          recipients_count?: number | null
          scheduled_at: string
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          target_type: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          data?: Json | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          recipients_count?: number | null
          scheduled_at?: string
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          target_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_pairs: {
        Row: {
          cancelled_services: number | null
          client_id: string
          completed_services: number | null
          created_at: string | null
          flagged_for_review: boolean | null
          id: string
          last_service_at: string | null
          provider_id: string
          total_services: number | null
        }
        Insert: {
          cancelled_services?: number | null
          client_id: string
          completed_services?: number | null
          created_at?: string | null
          flagged_for_review?: boolean | null
          id?: string
          last_service_at?: string | null
          provider_id: string
          total_services?: number | null
        }
        Update: {
          cancelled_services?: number | null
          client_id?: string
          completed_services?: number | null
          created_at?: string | null
          flagged_for_review?: boolean | null
          id?: string
          last_service_at?: string | null
          provider_id?: string
          total_services?: number | null
        }
        Relationships: []
      }
      settings_history: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          new_value: Json
          old_value: Json | null
          setting_key: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          new_value: Json
          old_value?: Json | null
          setting_key: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          new_value?: Json
          old_value?: Json | null
          setting_key?: string
        }
        Relationships: []
      }
      suspicious_patterns: {
        Row: {
          action_taken: string | null
          chamado_id: string | null
          client_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          pattern_type: string
          provider_id: string | null
          review_notes: string | null
          reviewed: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string | null
        }
        Insert: {
          action_taken?: string | null
          chamado_id?: string | null
          client_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          pattern_type: string
          provider_id?: string | null
          review_notes?: string | null
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
        }
        Update: {
          action_taken?: string | null
          chamado_id?: string | null
          client_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          pattern_type?: string
          provider_id?: string | null
          review_notes?: string | null
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suspicious_patterns_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados"
            referencedColumns: ["id"]
          },
        ]
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
      accept_terms: { Args: { _user_id: string }; Returns: undefined }
      block_provider_for_fraud: {
        Args: { _admin_id: string; _provider_user_id: string; _reason: string }
        Returns: undefined
      }
      can_provider_accept_chamados: {
        Args: { _user_id: string }
        Returns: {
          block_reason: string
          can_accept: boolean
        }[]
      }
      check_provider_debt_limit: {
        Args: { _user_id: string }
        Returns: {
          current_debt: number
          is_over_limit: boolean
          max_limit: number
        }[]
      }
      get_current_terms_version: { Args: never; Returns: string }
      get_providers_needing_warning: {
        Args: never
        Returns: {
          max_limit: number
          pending_balance: number
          percent_used: number
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_credential_blocked: {
        Args: { _credential_type: string; _credential_value: string }
        Returns: boolean
      }
      is_device_blocked: { Args: { _device_id: string }; Returns: boolean }
      is_provider: { Args: { _user_id: string }; Returns: boolean }
      is_provider_active: { Args: { _user_id: string }; Returns: boolean }
      provider_needs_terms_acceptance: {
        Args: { _user_id: string }
        Returns: boolean
      }
      unblock_provider: {
        Args: { _admin_id: string; _notes?: string; _provider_user_id: string }
        Returns: undefined
      }
      validate_cpf: { Args: { cpf_input: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      block_reason_type:
        | "divida"
        | "fraude"
        | "duplicidade"
        | "dispositivo_bloqueado"
        | "manual"
      chamado_status:
        | "idle"
        | "searching"
        | "accepted"
        | "negotiating"
        | "awaiting_payment"
        | "in_service"
        | "pending_client_confirmation"
        | "finished"
        | "canceled"
      fee_type: "STRIPE" | "MANUAL_PIX"
      financial_status: "PAGO" | "DEVENDO" | "AGUARDANDO_APROVACAO"
      payment_status:
        | "pending"
        | "paid_mock"
        | "paid_stripe"
        | "failed"
        | "refunded"
      service_type: "guincho" | "borracharia" | "mecanica" | "chaveiro"
      user_profile_type: "client" | "provider"
      vehicle_type:
        | "carro_passeio"
        | "carro_utilitario"
        | "pickup"
        | "van"
        | "moto"
        | "caminhao_toco"
        | "caminhao_34"
        | "truck"
        | "carreta"
        | "cavalinho"
        | "onibus"
        | "micro_onibus"
        | "outro"
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
      app_role: ["admin", "moderator", "user"],
      block_reason_type: [
        "divida",
        "fraude",
        "duplicidade",
        "dispositivo_bloqueado",
        "manual",
      ],
      chamado_status: [
        "idle",
        "searching",
        "accepted",
        "negotiating",
        "awaiting_payment",
        "in_service",
        "pending_client_confirmation",
        "finished",
        "canceled",
      ],
      fee_type: ["STRIPE", "MANUAL_PIX"],
      financial_status: ["PAGO", "DEVENDO", "AGUARDANDO_APROVACAO"],
      payment_status: [
        "pending",
        "paid_mock",
        "paid_stripe",
        "failed",
        "refunded",
      ],
      service_type: ["guincho", "borracharia", "mecanica", "chaveiro"],
      user_profile_type: ["client", "provider"],
      vehicle_type: [
        "carro_passeio",
        "carro_utilitario",
        "pickup",
        "van",
        "moto",
        "caminhao_toco",
        "caminhao_34",
        "truck",
        "carreta",
        "cavalinho",
        "onibus",
        "micro_onibus",
        "outro",
      ],
    },
  },
} as const
