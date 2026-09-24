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
      categoria: {
        Row: {
          ativa: boolean
          data_atualizacao: string
          data_inclusao: string
          id: string
          tipo: Database["public"]["Enums"]["tipo_categoria"]
          titulo: string
        }
        Insert: {
          ativa?: boolean
          data_atualizacao?: string
          data_inclusao?: string
          id?: string
          tipo: Database["public"]["Enums"]["tipo_categoria"]
          titulo: string
        }
        Update: {
          ativa?: boolean
          data_atualizacao?: string
          data_inclusao?: string
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_categoria"]
          titulo?: string
        }
        Relationships: []
      }
      divida: {
        Row: {
          categoria_id: string
          data_atualizacao: string
          data_inclusao: string
          data_vencimento_primeira: string
          descricao: string
          id: string
          quantidade_parcelas: number
          valor_parcela: number
        }
        Insert: {
          categoria_id: string
          data_atualizacao?: string
          data_inclusao?: string
          data_vencimento_primeira: string
          descricao: string
          id?: string
          quantidade_parcelas: number
          valor_parcela: number
        }
        Update: {
          categoria_id?: string
          data_atualizacao?: string
          data_inclusao?: string
          data_vencimento_primeira?: string
          descricao?: string
          id?: string
          quantidade_parcelas?: number
          valor_parcela?: number
        }
        Relationships: [
          {
            foreignKeyName: "divida_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria"
            referencedColumns: ["id"]
          },
        ]
      }
      forma_pagamento: {
        Row: {
          ativa: boolean
          data_atualizacao: string
          data_inclusao: string
          id: string
          nome: string
        }
        Insert: {
          ativa?: boolean
          data_atualizacao?: string
          data_inclusao?: string
          id?: string
          nome: string
        }
        Update: {
          ativa?: boolean
          data_atualizacao?: string
          data_inclusao?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      manutencao: {
        Row: {
          data_atualizacao: string
          data_inclusao: string
          data_manutencao: string
          descricao: string
          hodometro: number | null
          id: string
          movimentacao_id: string | null
          valor: number
          veiculo_id: string
        }
        Insert: {
          data_atualizacao?: string
          data_inclusao?: string
          data_manutencao: string
          descricao: string
          hodometro?: number | null
          id?: string
          movimentacao_id?: string | null
          valor: number
          veiculo_id: string
        }
        Update: {
          data_atualizacao?: string
          data_inclusao?: string
          data_manutencao?: string
          descricao?: string
          hodometro?: number | null
          id?: string
          movimentacao_id?: string | null
          valor?: number
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manutencao_movimentacao_id_fkey"
            columns: ["movimentacao_id"]
            isOneToOne: false
            referencedRelation: "movimentacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manutencao_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculo"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacao: {
        Row: {
          categoria_id: string
          data_atualizacao: string
          data_inclusao: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          divida_id: string | null
          forma_pagamento_id: string
          id: string
          status_pagamento: Database["public"]["Enums"]["status_pagamento"]
          valor: number
          viagem_id: string | null
        }
        Insert: {
          categoria_id: string
          data_atualizacao?: string
          data_inclusao?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          divida_id?: string | null
          forma_pagamento_id: string
          id?: string
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          valor: number
          viagem_id?: string | null
        }
        Update: {
          categoria_id?: string
          data_atualizacao?: string
          data_inclusao?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          divida_id?: string | null
          forma_pagamento_id?: string
          id?: string
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          valor?: number
          viagem_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacao_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacao_divida_id_fkey"
            columns: ["divida_id"]
            isOneToOne: false
            referencedRelation: "divida"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacao_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "forma_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacao_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagem"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil: {
        Row: {
          data_atualizacao: string
          data_inclusao: string
          id: string
          nome: Database["public"]["Enums"]["perfil_nome"]
        }
        Insert: {
          data_atualizacao?: string
          data_inclusao?: string
          id?: string
          nome: Database["public"]["Enums"]["perfil_nome"]
        }
        Update: {
          data_atualizacao?: string
          data_inclusao?: string
          id?: string
          nome?: Database["public"]["Enums"]["perfil_nome"]
        }
        Relationships: []
      }
      rota: {
        Row: {
          cidade_destino: string
          cidade_origem: string
          data_atualizacao: string
          data_inclusao: string
          distancia_estimada_km: number
          id: string
        }
        Insert: {
          cidade_destino: string
          cidade_origem: string
          data_atualizacao?: string
          data_inclusao?: string
          distancia_estimada_km: number
          id?: string
        }
        Update: {
          cidade_destino?: string
          cidade_origem?: string
          data_atualizacao?: string
          data_inclusao?: string
          distancia_estimada_km?: number
          id?: string
        }
        Relationships: []
      }
      usuario: {
        Row: {
          ativo: boolean
          data_atualizacao: string
          data_inclusao: string
          email: string
          google_subject_id: string | null
          id: string
          nome: string
          perfil_id: string
        }
        Insert: {
          ativo?: boolean
          data_atualizacao?: string
          data_inclusao?: string
          email: string
          google_subject_id?: string | null
          id: string
          nome: string
          perfil_id: string
        }
        Update: {
          ativo?: boolean
          data_atualizacao?: string
          data_inclusao?: string
          email?: string
          google_subject_id?: string | null
          id?: string
          nome?: string
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["id"]
          },
        ]
      }
      veiculo: {
        Row: {
          capacidade_carga: number
          data_atualizacao: string
          data_inclusao: string
          id: string
          marca: string
          modelo: string
          placa: string
          status: Database["public"]["Enums"]["status_veiculo"]
        }
        Insert: {
          capacidade_carga: number
          data_atualizacao?: string
          data_inclusao?: string
          id?: string
          marca: string
          modelo: string
          placa: string
          status?: Database["public"]["Enums"]["status_veiculo"]
        }
        Update: {
          capacidade_carga?: number
          data_atualizacao?: string
          data_inclusao?: string
          id?: string
          marca?: string
          modelo?: string
          placa?: string
          status?: Database["public"]["Enums"]["status_veiculo"]
        }
        Relationships: []
      }
      viagem: {
        Row: {
          data_atualizacao: string
          data_fim: string | null
          data_inclusao: string
          data_inicio: string | null
          hodometro_final: number | null
          hodometro_inicial: number
          id: string
          motorista_id: string
          rota_id: string
          status: Database["public"]["Enums"]["status_viagem"]
          veiculo_id: string
        }
        Insert: {
          data_atualizacao?: string
          data_fim?: string | null
          data_inclusao?: string
          data_inicio?: string | null
          hodometro_final?: number | null
          hodometro_inicial: number
          id?: string
          motorista_id: string
          rota_id: string
          status?: Database["public"]["Enums"]["status_viagem"]
          veiculo_id: string
        }
        Update: {
          data_atualizacao?: string
          data_fim?: string | null
          data_inclusao?: string
          data_inicio?: string | null
          hodometro_final?: number | null
          hodometro_inicial?: number
          id?: string
          motorista_id?: string
          rota_id?: string
          status?: Database["public"]["Enums"]["status_viagem"]
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viagem_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "usuario"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagem_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rota"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagem_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculo"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_perfil: {
        Args: never
        Returns: Database["public"]["Enums"]["perfil_nome"]
      }
      auth_usuario_id: { Args: never; Returns: string }
    }
    Enums: {
      perfil_nome: "Admin" | "Gestor de Frota" | "Financeiro" | "Motorista"
      status_pagamento: "Pendente" | "Pago"
      status_veiculo: "Disponivel" | "EmViagem" | "EmManutencao"
      status_viagem: "EmAndamento" | "Finalizada" | "Cancelada"
      tipo_categoria: "Entrada" | "Saida"
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
    Enums: {
      perfil_nome: ["Admin", "Gestor de Frota", "Financeiro", "Motorista"],
      status_pagamento: ["Pendente", "Pago"],
      status_veiculo: ["Disponivel", "EmViagem", "EmManutencao"],
      status_viagem: ["EmAndamento", "Finalizada", "Cancelada"],
      tipo_categoria: ["Entrada", "Saida"],
    },
  },
} as const
