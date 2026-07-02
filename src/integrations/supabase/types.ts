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
      admin_actions: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          payload: Json
          store_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          payload?: Json
          store_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          payload?: Json
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string
        }
        Relationships: []
      }
      admin_notes: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          note: string
          store_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          note: string
          store_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          note?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      churn_reasons: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string | null
          reason: Database["public"]["Enums"]["churn_reason"]
          store_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note?: string | null
          reason: Database["public"]["Enums"]["churn_reason"]
          store_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          reason?: Database["public"]["Enums"]["churn_reason"]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "churn_reasons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "churn_reasons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          message_template: string
          recipient_count: number
          segment: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          message_template: string
          recipient_count?: number
          segment: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          message_template?: string
          recipient_count?: number
          segment?: string
        }
        Relationships: []
      }
      communications_recipients: {
        Row: {
          communication_id: string
          id: string
          opened_at: string | null
          rendered_message: string
          store_id: string
        }
        Insert: {
          communication_id: string
          id?: string
          opened_at?: string | null
          rendered_message: string
          store_id: string
        }
        Update: {
          communication_id?: string
          id?: string
          opened_at?: string | null
          rendered_message?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communications_recipients_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_recipients_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_recipients_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          last_order_at: string | null
          name: string
          store_id: string
          total_orders: number
          whatsapp: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_order_at?: string | null
          name: string
          store_id: string
          total_orders?: number
          whatsapp: string
        }
        Update: {
          created_at?: string
          id?: string
          last_order_at?: string | null
          name?: string
          store_id?: string
          total_orders?: number
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_name: string
          customer_user_id: string | null
          customer_whatsapp: string | null
          id: string
          notes: string | null
          order_number: number | null
          payment: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          total: number
          type: Database["public"]["Enums"]["order_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          customer_user_id?: string | null
          customer_whatsapp?: string | null
          id?: string
          notes?: string | null
          order_number?: number | null
          payment?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          total?: number
          type?: Database["public"]["Enums"]["order_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_user_id?: string | null
          customer_whatsapp?: string | null
          id?: string
          notes?: string | null
          order_number?: number | null
          payment?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          total?: number
          type?: Database["public"]["Enums"]["order_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          paid_at: string | null
          status: string
          store_id: string
          stripe_invoice_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          paid_at?: string | null
          status: string
          store_id: string
          stripe_invoice_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          status?: string
          store_id?: string
          stripe_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          photo_url: string | null
          price: number
          stock: number
          store_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          photo_url?: string | null
          price: number
          stock?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          price?: number
          stock?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      stores: {
        Row: {
          address: string | null
          city: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          hours: Json
          id: string
          is_open: boolean
          last_login_at: string | null
          logo_url: string | null
          name: string
          owner_id: string
          slug: string
          state: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          hours?: Json
          id?: string
          is_open?: boolean
          last_login_at?: string | null
          logo_url?: string | null
          name: string
          owner_id: string
          slug: string
          state?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string
          updated_at?: string
          whatsapp: string
        }
        Update: {
          address?: string | null
          city?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          hours?: Json
          id?: string
          is_open?: boolean
          last_login_at?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          slug?: string
          state?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string
          updated_at?: string
          whatsapp?: string
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
    }
    Views: {
      stores_public: {
        Row: {
          address: string | null
          city: string | null
          cover_url: string | null
          description: string | null
          hours: Json | null
          id: string | null
          is_open: boolean | null
          logo_url: string | null
          name: string | null
          slug: string | null
          state: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          cover_url?: string | null
          description?: string | null
          hours?: Json | null
          id?: string | null
          is_open?: boolean | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
          state?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          cover_url?: string | null
          description?: string | null
          hours?: Json | null
          id?: string | null
          is_open?: boolean | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
          state?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_add_note: {
        Args: { _note: string; _store_id: string }
        Returns: undefined
      }
      admin_create_campaign: {
        Args: { _message_template: string; _recipients: Json; _segment: string }
        Returns: string
      }
      admin_extend_trial: {
        Args: { _days: number; _store_id: string }
        Returns: undefined
      }
      admin_invite: { Args: { _email: string }; Returns: Json }
      admin_list_campaigns: {
        Args: never
        Returns: {
          created_at: string
          id: string
          message_template: string
          opened_count: number
          recipient_count: number
          segment: string
        }[]
      }
      admin_list_stores: {
        Args: {
          _health?: string
          _limit?: number
          _offset?: number
          _search?: string
          _status?: string
        }
        Returns: {
          created_at: string
          health: string
          id: string
          last_login_at: string
          last_order_at: string
          name: string
          owner_email: string
          slug: string
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          trial_days_left: number
          whatsapp: string
        }[]
      }
      admin_list_team: {
        Args: never
        Returns: {
          email: string
          full_name: string
          invited: boolean
          user_id: string
        }[]
      }
      admin_mark_recipient_opened: {
        Args: { _recipient_id: string }
        Returns: undefined
      }
      admin_overview: { Args: never; Returns: Json }
      admin_recovery_list: {
        Args: never
        Returns: {
          days_since_trial: number
          name: string
          owner_email: string
          reason: Database["public"]["Enums"]["churn_reason"]
          store_id: string
          whatsapp: string
        }[]
      }
      admin_register_churn: {
        Args: {
          _note?: string
          _reason: Database["public"]["Enums"]["churn_reason"]
          _store_id: string
        }
        Returns: undefined
      }
      admin_segment_stores: {
        Args: { _segment: string }
        Returns: {
          name: string
          store_id: string
          trial_days_left: number
          whatsapp: string
        }[]
      }
      admin_set_subscription_status: {
        Args: {
          _reason?: string
          _status: Database["public"]["Enums"]["subscription_status"]
          _store_id: string
        }
        Returns: undefined
      }
      admin_store_detail: { Args: { _store_id: string }; Returns: Json }
      admin_trial_metrics: { Args: { _window_days?: number }; Returns: Json }
      create_public_order:
        | {
            Args: {
              _customer_name: string
              _customer_whatsapp: string
              _items: Json
              _notes: string
              _store_id: string
            }
            Returns: {
              id: string
              order_number: number
            }[]
          }
        | {
            Args: {
              _customer_name: string
              _customer_user_id?: string
              _customer_whatsapp: string
              _items: Json
              _notes: string
              _store_id: string
            }
            Returns: {
              id: string
              order_number: number
            }[]
          }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      my_orders: {
        Args: never
        Returns: {
          created_at: string
          id: string
          order_number: number
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          store_name: string
          store_slug: string
          total: number
        }[]
      }
      next_order_number: { Args: { _store: string }; Returns: number }
      store_health: { Args: { _store_id: string }; Returns: string }
    }
    Enums: {
      app_role: "owner" | "admin" | "user"
      churn_reason:
        | "preco"
        | "complexidade"
        | "mudou_ramo"
        | "nao_deu_certo"
        | "sem_tempo"
        | "outro"
      order_status: "recebido" | "preparo" | "pronto" | "entregue" | "cancelado"
      order_type: "reserva" | "presencial"
      payment_method: "pix" | "cartao" | "dinheiro" | "nao_definido"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "blocked"
        | "canceled"
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
      app_role: ["owner", "admin", "user"],
      churn_reason: [
        "preco",
        "complexidade",
        "mudou_ramo",
        "nao_deu_certo",
        "sem_tempo",
        "outro",
      ],
      order_status: ["recebido", "preparo", "pronto", "entregue", "cancelado"],
      order_type: ["reserva", "presencial"],
      payment_method: ["pix", "cartao", "dinheiro", "nao_definido"],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "blocked",
        "canceled",
      ],
    },
  },
} as const
