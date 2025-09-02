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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      document_access: {
        Row: {
          access_type: string
          document_id: string
          expires_at: string | null
          granted_at: string | null
          granted_by: string
          id: string
          is_active: boolean
          user_address: string
        }
        Insert: {
          access_type?: string
          document_id: string
          expires_at?: string | null
          granted_at?: string | null
          granted_by: string
          id?: string
          is_active?: boolean
          user_address: string
        }
        Update: {
          access_type?: string
          document_id?: string
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string
          id?: string
          is_active?: boolean
          user_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_access_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "pending_signatures"
            referencedColumns: ["document_id"]
          },
        ]
      }
      document_keys: {
        Row: {
          blockchain_tx_hash: string | null
          document_id: string
          encrypted_key: string
          id: string
          is_active: boolean
          key_hash: string
          signer_address: string
          synchronized_at: string | null
        }
        Insert: {
          blockchain_tx_hash?: string | null
          document_id: string
          encrypted_key: string
          id?: string
          is_active?: boolean
          key_hash: string
          signer_address: string
          synchronized_at?: string | null
        }
        Update: {
          blockchain_tx_hash?: string | null
          document_id?: string
          encrypted_key?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          signer_address?: string
          synchronized_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_keys_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_keys_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_keys_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "pending_signatures"
            referencedColumns: ["document_id"]
          },
        ]
      }
      document_signatures: {
        Row: {
          blockchain_tx_hash: string | null
          document_id: string
          id: string
          message_hash: string | null
          signature_data: string
          signature_hash: string
          signed_at: string | null
          signer_address: string
        }
        Insert: {
          blockchain_tx_hash?: string | null
          document_id: string
          id?: string
          message_hash?: string | null
          signature_data: string
          signature_hash: string
          signed_at?: string | null
          signer_address: string
        }
        Update: {
          blockchain_tx_hash?: string | null
          document_id?: string
          id?: string
          message_hash?: string | null
          signature_data?: string
          signature_hash?: string
          signed_at?: string | null
          signer_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "pending_signatures"
            referencedColumns: ["document_id"]
          },
        ]
      }
      document_signers: {
        Row: {
          added_at: string | null
          added_by: string
          document_id: string
          id: string
          is_required: boolean
          signer_address: string
        }
        Insert: {
          added_at?: string | null
          added_by: string
          document_id: string
          id?: string
          is_required?: boolean
          signer_address: string
        }
        Update: {
          added_at?: string | null
          added_by?: string
          document_id?: string
          id?: string
          is_required?: boolean
          signer_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_signers_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signers_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signers_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "pending_signatures"
            referencedColumns: ["document_id"]
          },
        ]
      }
      documents: {
        Row: {
          blockchain_tx_hash: string | null
          created_at: string | null
          current_signatures: number
          description: string | null
          document_hash: string
          document_id: number
          expires_at: string | null
          file_path: string
          file_size: number
          file_type: string
          id: string
          is_completed: boolean
          is_public: boolean
          owner_address: string
          required_signatures: number
          title: string
          updated_at: string | null
        }
        Insert: {
          blockchain_tx_hash?: string | null
          created_at?: string | null
          current_signatures?: number
          description?: string | null
          document_hash: string
          document_id: number
          expires_at?: string | null
          file_path: string
          file_size: number
          file_type: string
          id?: string
          is_completed?: boolean
          is_public?: boolean
          owner_address: string
          required_signatures?: number
          title: string
          updated_at?: string | null
        }
        Update: {
          blockchain_tx_hash?: string | null
          created_at?: string | null
          current_signatures?: number
          description?: string | null
          document_hash?: string
          document_id?: number
          expires_at?: string | null
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          is_completed?: boolean
          is_public?: boolean
          owner_address?: string
          required_signatures?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      verification_logs: {
        Row: {
          details: Json | null
          document_hash: string | null
          document_id: string | null
          id: string
          is_valid: boolean
          verification_type: string
          verified_at: string | null
          verifier_address: string | null
        }
        Insert: {
          details?: Json | null
          document_hash?: string | null
          document_id?: string | null
          id?: string
          is_valid: boolean
          verification_type: string
          verified_at?: string | null
          verifier_address?: string | null
        }
        Update: {
          details?: Json | null
          document_hash?: string | null
          document_id?: string | null
          id?: string
          is_valid?: boolean
          verification_type?: string
          verified_at?: string | null
          verifier_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "pending_signatures"
            referencedColumns: ["document_id"]
          },
        ]
      }
    }
    Views: {
      document_summary: {
        Row: {
          actual_signatures: number | null
          created_at: string | null
          current_signatures: number | null
          description: string | null
          document_hash: string | null
          document_id: number | null
          id: string | null
          is_completed: boolean | null
          is_public: boolean | null
          is_valid: boolean | null
          owner_address: string | null
          required_signatures: number | null
          title: string | null
          total_signers: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      pending_signatures: {
        Row: {
          added_at: string | null
          blockchain_document_id: number | null
          document_hash: string | null
          document_id: string | null
          has_signed: boolean | null
          signer_address: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
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
