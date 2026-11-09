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
      alternativas: {
        Row: {
          correta: boolean
          equivoco: string | null
          id: string
          ordem: number
          questao_id: string
          texto: string
        }
        Insert: {
          correta?: boolean
          equivoco?: string | null
          id?: string
          ordem?: number
          questao_id: string
          texto: string
        }
        Update: {
          correta?: boolean
          equivoco?: string | null
          id?: string
          ordem?: number
          questao_id?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "alternativas_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades: {
        Row: {
          created_at: string
          id: string
          material_id: string | null
          prazo: string | null
          professor_id: string
          publicada_em: string | null
          status: Database["public"]["Enums"]["status_atividade"]
          titulo: string
          turma_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id?: string | null
          prazo?: string | null
          professor_id: string
          publicada_em?: string | null
          status?: Database["public"]["Enums"]["status_atividade"]
          titulo: string
          turma_id: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string | null
          prazo?: string | null
          professor_id?: string
          publicada_em?: string | null
          status?: Database["public"]["Enums"]["status_atividade"]
          titulo?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atividades_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostico_resumos: {
        Row: {
          conteudo: Json
          gerado_em: string
          turma_id: string
        }
        Insert: {
          conteudo: Json
          gerado_em?: string
          turma_id: string
        }
        Update: {
          conteudo?: Json
          gerado_em?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostico_resumos_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: true
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      entregas: {
        Row: {
          aluno_id: string
          atividade_id: string
          enviada_em: string
          feedback: Json | null
          id: string
        }
        Insert: {
          aluno_id: string
          atividade_id: string
          enviada_em?: string
          feedback?: Json | null
          id?: string
        }
        Update: {
          aluno_id?: string
          atividade_id?: string
          enviada_em?: string
          feedback?: Json | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entregas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entregas_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
        ]
      }
      materiais: {
        Row: {
          conteudo_texto: string | null
          created_at: string
          id: string
          professor_id: string
          storage_path: string | null
          tipo: Database["public"]["Enums"]["tipo_material"]
          titulo: string
          turma_id: string
        }
        Insert: {
          conteudo_texto?: string | null
          created_at?: string
          id?: string
          professor_id: string
          storage_path?: string | null
          tipo: Database["public"]["Enums"]["tipo_material"]
          titulo: string
          turma_id: string
        }
        Update: {
          conteudo_texto?: string | null
          created_at?: string
          id?: string
          professor_id?: string
          storage_path?: string | null
          tipo?: Database["public"]["Enums"]["tipo_material"]
          titulo?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "materiais_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materiais_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      material_trechos: {
        Row: {
          conteudo: string
          embedding: string | null
          id: string
          material_id: string
          ordem: number
          pagina: number | null
        }
        Insert: {
          conteudo: string
          embedding?: string | null
          id?: string
          material_id: string
          ordem: number
          pagina?: number | null
        }
        Update: {
          conteudo?: string
          embedding?: string | null
          id?: string
          material_id?: string
          ordem?: number
          pagina?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "material_trechos_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nome: string
          papel: Database["public"]["Enums"]["papel"]
          turma_id: string | null
        }
        Insert: {
          created_at?: string
          id: string
          nome: string
          papel: Database["public"]["Enums"]["papel"]
          turma_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          papel?: Database["public"]["Enums"]["papel"]
          turma_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_turma_fk"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      questoes: {
        Row: {
          atividade_id: string
          enunciado: string
          id: string
          ordem: number
          rubrica: Json | null
          tipo: Database["public"]["Enums"]["tipo_questao"]
          topico_id: string
          trecho_id: string | null
        }
        Insert: {
          atividade_id: string
          enunciado: string
          id?: string
          ordem?: number
          rubrica?: Json | null
          tipo: Database["public"]["Enums"]["tipo_questao"]
          topico_id: string
          trecho_id?: string | null
        }
        Update: {
          atividade_id?: string
          enunciado?: string
          id?: string
          ordem?: number
          rubrica?: Json | null
          tipo?: Database["public"]["Enums"]["tipo_questao"]
          topico_id?: string
          trecho_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questoes_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_topico_id_fkey"
            columns: ["topico_id"]
            isOneToOne: false
            referencedRelation: "topicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questoes_trecho_id_fkey"
            columns: ["trecho_id"]
            isOneToOne: false
            referencedRelation: "material_trechos"
            referencedColumns: ["id"]
          },
        ]
      }
      respostas: {
        Row: {
          alternativa_id: string | null
          correcao: Json | null
          entrega_id: string
          id: string
          nota_ajustada: number | null
          nota_ia: number | null
          questao_id: string
          texto: string | null
        }
        Insert: {
          alternativa_id?: string | null
          correcao?: Json | null
          entrega_id: string
          id?: string
          nota_ajustada?: number | null
          nota_ia?: number | null
          questao_id: string
          texto?: string | null
        }
        Update: {
          alternativa_id?: string | null
          correcao?: Json | null
          entrega_id?: string
          id?: string
          nota_ajustada?: number | null
          nota_ia?: number | null
          questao_id?: string
          texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "respostas_alternativa_id_fkey"
            columns: ["alternativa_id"]
            isOneToOne: false
            referencedRelation: "alternativas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_entrega_id_fkey"
            columns: ["entrega_id"]
            isOneToOne: false
            referencedRelation: "entregas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
        ]
      }
      topicos: {
        Row: {
          confirmado: boolean
          created_at: string
          descricao: string | null
          id: string
          material_id: string | null
          nome: string
          professor_id: string
        }
        Insert: {
          confirmado?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          material_id?: string | null
          nome: string
          professor_id: string
        }
        Update: {
          confirmado?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          material_id?: string | null
          nome?: string
          professor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topicos_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topicos_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      turmas: {
        Row: {
          codigo_convite: string
          created_at: string
          id: string
          nome: string
          professor_id: string
        }
        Insert: {
          codigo_convite?: string
          created_at?: string
          id?: string
          nome: string
          professor_id: string
        }
        Update: {
          codigo_convite?: string
          created_at?: string
          id?: string
          nome?: string
          professor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "turmas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      atividade_visivel_ao_aluno: {
        Args: { p_atividade: string }
        Returns: boolean
      }
      ja_entreguei: { Args: { p_atividade: string }; Returns: boolean }
      meu_papel: { Args: never; Returns: Database["public"]["Enums"]["papel"] }
      minha_turma: { Args: never; Returns: string }
      questoes_para_responder: {
        Args: { p_atividade: string }
        Returns: {
          alternativas: Json
          enunciado: string
          ordem: number
          questao_id: string
          tipo: Database["public"]["Enums"]["tipo_questao"]
          topico: string
        }[]
      }
      sou_professor_da_turma: { Args: { p_turma: string }; Returns: boolean }
    }
    Enums: {
      papel: "professor" | "aluno"
      status_atividade: "rascunho" | "publicada"
      tipo_material: "pdf" | "texto"
      tipo_questao: "multipla_escolha" | "dissertativa"
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
      papel: ["professor", "aluno"],
      status_atividade: ["rascunho", "publicada"],
      tipo_material: ["pdf", "texto"],
      tipo_questao: ["multipla_escolha", "dissertativa"],
    },
  },
} as const
