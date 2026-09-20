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
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          company_id: string | null
          created_at: string | null
          details: Json | null
          entity_type: string
          id: string
          record_id: string | null
          updated_at: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity_type: string
          id?: string
          record_id?: string | null
          updated_at?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string | null
          details?: Json | null
          entity_type?: string
          id?: string
          record_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      boqs: {
        Row: {
          id: string
          company_id: string | null
          number: string
          boq_date: string
          client_name: string
          client_email: string | null
          client_phone: string | null
          client_address: string | null
          client_city: string | null
          client_country: string | null
          contractor: string | null
          project_title: string | null
          currency: string | null
          exchange_rate: number | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number
          attachment_url: string | null
          data: Json | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
          status: string | null
          converted_to_invoice_id: string | null
          converted_at: string | null
          due_date: string | null
          terms_and_conditions: string | null
          showCalculatedValuesInTerms: boolean | null
        }
        Insert: {
          id?: string
          company_id?: string | null
          number: string
          boq_date: string
          client_name: string
          client_email?: string | null
          client_phone?: string | null
          client_address?: string | null
          client_city?: string | null
          client_country?: string | null
          contractor?: string | null
          project_title?: string | null
          currency?: string | null
          exchange_rate?: number | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount: number
          attachment_url?: string | null
          data?: Json | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          status?: string | null
          converted_to_invoice_id?: string | null
          converted_at?: string | null
          due_date?: string | null
          terms_and_conditions?: string | null
          showCalculatedValuesInTerms?: boolean | null
        }
        Update: {
          id?: string
          company_id?: string | null
          number?: string
          boq_date?: string
          client_name?: string
          client_email?: string | null
          client_phone?: string | null
          client_address?: string | null
          client_city?: string | null
          client_country?: string | null
          contractor?: string | null
          project_title?: string | null
          currency?: string | null
          exchange_rate?: number | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number
          attachment_url?: string | null
          data?: Json | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
          status?: string | null
          converted_to_invoice_id?: string | null
          converted_at?: string | null
          due_date?: string | null
          terms_and_conditions?: string | null
          showCalculatedValuesInTerms?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "boqs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boqs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          branch_code: string | null
          city: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          email: string | null
          fiscal_year_start: number | null
          id: string
          logo_url: string | null
          name: string
          paybill_number: string | null
          phone: string | null
          postal_code: string | null
          registration_number: string | null
          state: string | null
          swift_code: string | null
          tax_number: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          branch_code?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          fiscal_year_start?: number | null
          id?: string
          logo_url?: string | null
          name: string
          paybill_number?: string | null
          phone?: string | null
          postal_code?: string | null
          registration_number?: string | null
          state?: string | null
          swift_code?: string | null
          tax_number?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          branch_code?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          fiscal_year_start?: number | null
          id?: string
          logo_url?: string | null
          name?: string
          paybill_number?: string | null
          phone?: string | null
          postal_code?: string | null
          registration_number?: string | null
          state?: string | null
          swift_code?: string | null
          tax_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          company_id: string
          id: string
          terms_and_conditions: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          company_id: string
          id?: string
          terms_and_conditions?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          id?: string
          terms_and_conditions?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_note_allocations: {
        Row: {
          allocated_amount: number
          allocation_date: string
          created_at: string | null
          created_by: string | null
          credit_note_id: string
          id: string
          invoice_id: string
          notes: string | null
        }
        Insert: {
          allocated_amount?: number
          allocation_date?: string
          created_at?: string | null
          created_by?: string | null
          credit_note_id: string
          id?: string
          invoice_id: string
          notes?: string | null
        }
        Update: {
          allocated_amount?: number
          allocation_date?: string
          created_at?: string | null
          created_by?: string | null
          credit_note_id?: string
          id?: string
          invoice_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_allocations_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_credit_note_allocations_invoice_id"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_note_items: {
        Row: {
          created_at: string | null
          credit_note_id: string
          description: string
          id: string
          line_total: number
          product_id: string | null
          quantity: number
          sort_order: number
          tax_amount: number
          tax_inclusive: boolean
          tax_percentage: number
          tax_setting_id: string | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credit_note_id: string
          description: string
          id?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          sort_order?: number
          tax_amount?: number
          tax_inclusive?: boolean
          tax_percentage?: number
          tax_setting_id?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credit_note_id?: string
          description?: string
          id?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          sort_order?: number
          tax_amount?: number
          tax_inclusive?: boolean
          tax_percentage?: number
          tax_setting_id?: string | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_credit_note_items_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          affects_inventory: boolean
          applied_amount: number
          balance: number
          company_id: string
          created_at: string | null
          created_by: string | null
          credit_note_date: string
          credit_note_number: string
          customer_id: string
          id: string
          invoice_id: string | null
          notes: string | null
          reason: string | null
          status: string
          subtotal: number
          tax_amount: number
          terms_and_conditions: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          affects_inventory?: boolean
          applied_amount?: number
          balance?: number
          company_id: string
          created_at?: string | null
          created_by?: string | null
          credit_note_date: string
          credit_note_number: string
          customer_id: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          reason?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          terms_and_conditions?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Update: {
          affects_inventory?: boolean
          applied_amount?: number
          balance?: number
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          credit_note_date?: string
          credit_note_number?: string
          customer_id?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          reason?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          terms_and_conditions?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_credit_notes_company_id"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_credit_notes_customer_id"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_credit_notes_invoice_id"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          company_id: string | null
          country: string | null
          created_at: string | null
          credit_limit: number | null
          customer_code: string
          customer_number: number | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          payment_terms: number | null
          phone: string | null
          postal_code: string | null
          state: string | null
          tax_number: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          customer_code: string
          customer_number?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          payment_terms?: number | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_number?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          customer_code?: string
          customer_number?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          payment_terms?: number | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_note_items: {
        Row: {
          delivery_note_id: string | null
          description: string
          id: string
          product_id: string | null
          quantity_delivered: number
          quantity_ordered: number
          sort_order: number | null
          unit_of_measure: string | null
          unit_price: number | null
        }
        Insert: {
          delivery_note_id?: string | null
          description: string
          id?: string
          product_id?: string | null
          quantity_delivered: number
          quantity_ordered: number
          sort_order?: number | null
          unit_of_measure?: string | null
          unit_price?: number | null
        }
        Update: {
          delivery_note_id?: string | null
          description?: string
          id?: string
          product_id?: string | null
          quantity_delivered?: number
          quantity_ordered?: number
          sort_order?: number | null
          unit_of_measure?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_note_items_delivery_note_id_fkey"
            columns: ["delivery_note_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_notes: {
        Row: {
          carrier: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string | null
          delivered_by: string | null
          delivery_address: string | null
          delivery_date: string
          delivery_method: string | null
          delivery_number: string
          exchange_rate: number | null
          id: string
          invoice_id: string | null
          notes: string | null
          received_by: string | null
          status: Database["public"]["Enums"]["document_status"] | null
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          carrier?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          delivered_by?: string | null
          delivery_address?: string | null
          delivery_date: string
          delivery_method?: string | null
          delivery_number: string
          exchange_rate?: number | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          received_by?: string | null
          status?: Database["public"]["Enums"]["document_status"] | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          carrier?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          delivered_by?: string | null
          delivery_address?: string | null
          delivery_date?: string
          delivery_method?: string | null
          delivery_number?: string
          exchange_rate?: number | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          received_by?: string | null
          status?: Database["public"]["Enums"]["document_status"] | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          description: string
          discount_before_vat: number
          discount_percentage: number | null
          id: string
          invoice_id: string | null
          line_total: number
          product_id: string | null
          quantity: number
          sort_order: number | null
          tax_amount: number | null
          tax_inclusive: boolean | null
          tax_percentage: number | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          description: string
          discount_before_vat?: number
          discount_percentage?: number | null
          id?: string
          invoice_id?: string | null
          line_total: number
          product_id?: string | null
          quantity: number
          sort_order?: number | null
          tax_amount?: number | null
          tax_inclusive?: boolean | null
          tax_percentage?: number | null
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          description?: string
          discount_before_vat?: number
          discount_percentage?: number | null
          id?: string
          invoice_id?: string | null
          line_total?: number
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          tax_amount?: number | null
          tax_inclusive?: boolean | null
          tax_percentage?: number | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          affects_inventory: boolean | null
          balance_due: number | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string | null
          discount_amount: number | null
          display_as_percentage: boolean
          due_date: string
          exchange_rate: number | null
          id: string
          invoice_date: string
          invoice_number: string
          lpo_number: string | null
          notes: string | null
          paid_amount: number | null
          quotation_id: string | null
          status: Database["public"]["Enums"]["document_status"] | null
          subtotal: number | null
          tax_amount: number | null
          terms_and_conditions: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          affects_inventory?: boolean | null
          balance_due?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          display_as_percentage?: boolean
          due_date: string
          exchange_rate?: number | null
          id?: string
          invoice_date: string
          invoice_number: string
          lpo_number?: string | null
          notes?: string | null
          paid_amount?: number | null
          quotation_id?: string | null
          status?: Database["public"]["Enums"]["document_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          terms_and_conditions?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          affects_inventory?: boolean | null
          balance_due?: number | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          display_as_percentage?: boolean
          due_date?: string
          exchange_rate?: number | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          lpo_number?: string | null
          notes?: string | null
          paid_amount?: number | null
          quotation_id?: string | null
          status?: Database["public"]["Enums"]["document_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          terms_and_conditions?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoices_customer_id"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      lpo_items: {
        Row: {
          description: string
          id: string
          line_total: number
          lpo_id: string | null
          notes: string | null
          product_id: string | null
          quantity: number
          sort_order: number | null
          tax_amount: number | null
          tax_rate: number | null
          unit_of_measure: string | null
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          line_total: number
          lpo_id?: string | null
          notes?: string | null
          product_id?: string | null
          quantity: number
          sort_order?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          unit_of_measure?: string | null
          unit_price: number
        }
        Update: {
          description?: string
          id?: string
          line_total?: number
          lpo_id?: string | null
          notes?: string | null
          product_id?: string | null
          quantity?: number
          sort_order?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          unit_of_measure?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "lpo_items_lpo_id_fkey"
            columns: ["lpo_id"]
            isOneToOne: false
            referencedRelation: "lpos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lpo_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      lpos: {
        Row: {
          company_id: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          delivery_address: string | null
          delivery_date: string | null
          exchange_rate: number | null
          id: string
          lpo_date: string
          lpo_number: string
          notes: string | null
          status: Database["public"]["Enums"]["lpo_status"] | null
          subtotal: number | null
          supplier_id: string | null
          tax_amount: number | null
          terms_and_conditions: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          exchange_rate?: number | null
          id?: string
          lpo_date?: string
          lpo_number: string
          notes?: string | null
          status?: Database["public"]["Enums"]["lpo_status"] | null
          subtotal?: number | null
          supplier_id?: string | null
          tax_amount?: number | null
          terms_and_conditions?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          delivery_address?: string | null
          delivery_date?: string | null
          exchange_rate?: number | null
          id?: string
          lpo_date?: string
          lpo_number?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["lpo_status"] | null
          subtotal?: number | null
          supplier_id?: string | null
          tax_amount?: number | null
          terms_and_conditions?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lpos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lpos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lpos_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_logs: {
        Row: {
          executed_at: string | null
          id: string
          migration_name: string
          notes: string | null
          status: string | null
        }
        Insert: {
          executed_at?: string | null
          id?: string
          migration_name: string
          notes?: string | null
          status?: string | null
        }
        Update: {
          executed_at?: string | null
          id?: string
          migration_name?: string
          notes?: string | null
          status?: string | null
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          amount_allocated: number
          created_at: string | null
          id: string
          invoice_id: string | null
          payment_id: string | null
        }
        Insert: {
          amount_allocated: number
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          payment_id?: string | null
        }
        Update: {
          amount_allocated?: number
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          code: string
          company_id: string | null
          created_at: string | null
          description: string | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string | null
          exchange_rate: number | null
          id: string
          invoice_id: string | null
          notes: string | null
          payment_date: string
          payment_method: string
          payment_number: string
          reference_number: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          exchange_rate?: number | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date: string
          payment_method: string
          payment_number: string
          reference_number?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          exchange_rate?: number | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_number?: string
          reference_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          company_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          company_id: string | null
          cost_price: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          maximum_stock_level: number | null
          minimum_stock_level: number | null
          name: string
          product_code: string
          reorder_point: number | null
          selling_price: number
          stock_quantity: number | null
          track_inventory: boolean | null
          unit_of_measure: string | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          company_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          maximum_stock_level?: number | null
          minimum_stock_level?: number | null
          name: string
          product_code: string
          reorder_point?: number | null
          selling_price: number
          stock_quantity?: number | null
          track_inventory?: boolean | null
          unit_of_measure?: string | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          company_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          maximum_stock_level?: number | null
          minimum_stock_level?: number | null
          name?: string
          product_code?: string
          reorder_point?: number | null
          selling_price?: number
          stock_quantity?: number | null
          track_inventory?: boolean | null
          unit_of_measure?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_products_category_id"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          company_id: string | null
          created_at: string | null
          department: string | null
          email: string
          force_password_reset: boolean | null
          full_name: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean | null
          last_login: string | null
          password: string | null
          phone: string | null
          position: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          status: Database["public"]["Enums"]["user_status"] | null
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          email: string
          force_password_reset?: boolean | null
          full_name?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          last_login?: string | null
          password?: string | null
          phone?: string | null
          position?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          status?: Database["public"]["Enums"]["user_status"] | null
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string | null
          department?: string | null
          email?: string
          force_password_reset?: boolean | null
          full_name?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          last_login?: string | null
          password?: string | null
          phone?: string | null
          position?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          status?: Database["public"]["Enums"]["user_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      proforma_invoices: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          currency_code: string | null
          customer_id: string | null
          discount_amount: number | null
          display_as_percentage: boolean
          exchange_rate: number | null
          id: string
          notes: string | null
          proforma_date: string
          proforma_number: string
          status: Database["public"]["Enums"]["document_status"] | null
          subtotal: number | null
          tax_amount: number | null
          terms_and_conditions: string | null
          total_amount: number | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency_code?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          display_as_percentage?: boolean
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          proforma_date: string
          proforma_number: string
          status?: Database["public"]["Enums"]["document_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          terms_and_conditions?: string | null
          total_amount?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency_code?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          display_as_percentage?: boolean
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          proforma_date?: string
          proforma_number?: string
          status?: Database["public"]["Enums"]["document_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          terms_and_conditions?: string | null
          total_amount?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proforma_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proforma_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proforma_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      proforma_items: {
        Row: {
          created_at: string | null
          description: string
          discount_percentage: number | null
          id: string
          line_total: number
          product_id: string | null
          proforma_id: string | null
          quantity: number
          sort_order: number | null
          tax_amount: number | null
          tax_inclusive: boolean | null
          tax_percentage: number | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          discount_percentage?: number | null
          id?: string
          line_total: number
          product_id?: string | null
          proforma_id?: string | null
          quantity: number
          sort_order?: number | null
          tax_amount?: number | null
          tax_inclusive?: boolean | null
          tax_percentage?: number | null
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          discount_percentage?: number | null
          id?: string
          line_total?: number
          product_id?: string | null
          proforma_id?: string | null
          quantity?: number
          sort_order?: number | null
          tax_amount?: number | null
          tax_inclusive?: boolean | null
          tax_percentage?: number | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proforma_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proforma_items_proforma_id_fkey"
            columns: ["proforma_id"]
            isOneToOne: false
            referencedRelation: "proforma_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          description: string
          discount_percentage: number | null
          id: string
          line_total: number
          product_id: string | null
          quantity: number
          quotation_id: string | null
          sort_order: number | null
          tax_amount: number | null
          tax_inclusive: boolean | null
          tax_percentage: number | null
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          description: string
          discount_percentage?: number | null
          id?: string
          line_total: number
          product_id?: string | null
          quantity: number
          quotation_id?: string | null
          sort_order?: number | null
          tax_amount?: number | null
          tax_inclusive?: boolean | null
          tax_percentage?: number | null
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          description?: string
          discount_percentage?: number | null
          id?: string
          line_total?: number
          product_id?: string | null
          quantity?: number
          quotation_id?: string | null
          sort_order?: number | null
          tax_amount?: number | null
          tax_inclusive?: boolean | null
          tax_percentage?: number | null
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          customer_id: string | null
          discount_amount: number | null
          display_as_percentage: boolean
          exchange_rate: number | null
          id: string
          notes: string | null
          quotation_date: string
          quotation_number: string
          status: Database["public"]["Enums"]["document_status"] | null
          subtotal: number | null
          tax_amount: number | null
          terms_and_conditions: string | null
          total_amount: number | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          display_as_percentage?: boolean
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          quotation_date: string
          quotation_number: string
          status?: Database["public"]["Enums"]["document_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          terms_and_conditions?: string | null
          total_amount?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          display_as_percentage?: boolean
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          quotation_date?: string
          quotation_number?: string
          status?: Database["public"]["Enums"]["document_status"] | null
          subtotal?: number | null
          tax_amount?: number | null
          terms_and_conditions?: string | null
          total_amount?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      remittance_advice: {
        Row: {
          advice_date: string
          advice_number: string
          company_id: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["document_status"] | null
          total_payment: number
          updated_at: string | null
        }
        Insert: {
          advice_date: string
          advice_number: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["document_status"] | null
          total_payment: number
          updated_at?: string | null
        }
        Update: {
          advice_date?: string
          advice_number?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["document_status"] | null
          total_payment?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remittance_advice_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remittance_advice_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remittance_advice_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      remittance_advice_items: {
        Row: {
          credit_amount: number | null
          customer_address: string | null
          customer_name: string | null
          document_date: string
          document_number: string
          document_type: Database["public"]["Enums"]["document_type"]
          id: string
          invoice_amount: number | null
          invoice_id: string | null
          payment_amount: number
          payment_id: string | null
          remittance_advice_id: string | null
          sort_order: number | null
          supplier_address: string | null
          supplier_name: string | null
          tax_amount: number | null
          tax_inclusive: boolean | null
          tax_percentage: number | null
          tax_setting_id: string | null
        }
        Insert: {
          credit_amount?: number | null
          customer_address?: string | null
          customer_name?: string | null
          document_date: string
          document_number: string
          document_type: Database["public"]["Enums"]["document_type"]
          id?: string
          invoice_amount?: number | null
          invoice_id?: string | null
          payment_amount: number
          payment_id?: string | null
          remittance_advice_id?: string | null
          sort_order?: number | null
          supplier_address?: string | null
          supplier_name?: string | null
          tax_amount?: number | null
          tax_inclusive?: boolean | null
          tax_percentage?: number | null
          tax_setting_id?: string | null
        }
        Update: {
          credit_amount?: number | null
          customer_address?: string | null
          customer_name?: string | null
          document_date?: string
          document_number?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          id?: string
          invoice_amount?: number | null
          invoice_id?: string | null
          payment_amount?: number
          payment_id?: string | null
          remittance_advice_id?: string | null
          sort_order?: number | null
          supplier_address?: string | null
          supplier_name?: string | null
          tax_amount?: number | null
          tax_inclusive?: boolean | null
          tax_percentage?: number | null
          tax_setting_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remittance_advice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remittance_advice_items_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remittance_advice_items_remittance_advice_id_fkey"
            columns: ["remittance_advice_id"]
            isOneToOne: false
            referencedRelation: "remittance_advice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remittance_advice_items_tax_setting_id_fkey"
            columns: ["tax_setting_id"]
            isOneToOne: false
            referencedRelation: "tax_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          permissions: Json
          role_type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          permissions?: Json
          role_type?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          permissions?: Json
          role_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          company_id: string | null
          cost_per_unit: number | null
          created_at: string | null
          created_by: string | null
          id: string
          movement_date: string
          movement_type: string
          notes: string | null
          product_id: string | null
          quantity: number
          reference_id: string | null
          reference_number: string | null
          reference_type: string | null
          unit_cost: number | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          cost_per_unit?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_date: string
          movement_type: string
          notes?: string | null
          product_id?: string | null
          quantity: number
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          cost_per_unit?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_date?: string
          movement_type?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          company_id: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          payment_terms: number | null
          phone: string | null
          postal_code: string | null
          state: string | null
          supplier_code: string
          tax_number: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          payment_terms?: number | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          supplier_code: string
          tax_number?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          payment_terms?: number | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          supplier_code?: string
          tax_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_settings: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          rate: number
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          rate?: number
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          rate?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      units_of_measure: {
        Row: {
          abbreviation: string
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          abbreviation: string
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          abbreviation?: string
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_of_measure_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          approved_at: string | null
          approved_by: string | null
          company_id: string | null
          email: string
          expires_at: string | null
          id: string
          invitation_token: string | null
          invited_at: string | null
          invited_by: string | null
          is_approved: boolean | null
          role: Database["public"]["Enums"]["user_role"] | null
          send_error: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          accepted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invitation_token?: string | null
          invited_at?: string | null
          invited_by?: string | null
          is_approved?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          send_error?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          accepted_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invitation_token?: string | null
          invited_at?: string | null
          invited_by?: string | null
          is_approved?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          send_error?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations_archive_minimal: {
        Row: {
          archived_at: string | null
          company_id: string | null
          email: string | null
          expires_at: string | null
          id: string | null
          invitation_token: string | null
          invited_at: string | null
          invited_by: string | null
          payload: Json | null
          status: string | null
        }
        Insert: {
          archived_at?: string | null
          company_id?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string | null
          invitation_token?: string | null
          invited_at?: string | null
          invited_by?: string | null
          payload?: Json | null
          status?: string | null
        }
        Update: {
          archived_at?: string | null
          company_id?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string | null
          invitation_token?: string | null
          invited_at?: string | null
          invited_by?: string | null
          payload?: Json | null
          status?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          granted: boolean | null
          granted_at: string | null
          granted_by: string | null
          id: string
          permission_name: string
          user_id: string
        }
        Insert: {
          granted?: boolean | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          permission_name: string
          user_id: string
        }
        Update: {
          granted?: boolean | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          permission_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      variant_images: {
        Row: {
          alt_text: string | null
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string
          updated_at: string | null
          variant_id: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          updated_at?: string | null
          variant_id: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          updated_at?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "web_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      web_categories: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      web_variants: {
        Row: {
          category_id: string
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_path: string | null
          is_active: boolean | null
          name: string
          sku: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_path?: string | null
          is_active?: boolean | null
          name: string
          sku: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_path?: string | null
          is_active?: boolean | null
          name?: string
          sku?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "web_variants_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "web_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "web_variants_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "web_categories_with_counts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      web_categories_with_counts: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          slug: string | null
          updated_at: string | null
          variant_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      apply_credit_note_to_invoice: {
        Args: {
          amount_to_apply: number
          applied_by_uuid: string
          credit_note_uuid: string
          invoice_uuid: string
        }
        Returns: Json
      }
      generate_credit_note_number: {
        Args: { company_uuid: string }
        Returns: string
      }
      generate_delivery_number: {
        Args: { company_uuid: string }
        Returns: string
      }
      generate_invoice_number: {
        Args: { company_uuid: string }
        Returns: string
      }
      generate_lpo_number: { Args: { company_uuid: string }; Returns: string }
      generate_payment_number: {
        Args: { company_uuid: string }
        Returns: string
      }
      generate_proforma_number: {
        Args: { company_uuid: string }
        Returns: string
      }
      generate_quotation_number: {
        Args: { company_uuid: string }
        Returns: string
      }
      generate_remittance_number: {
        Args: { company_uuid: string }
        Returns: string
      }
      get_user_permissions: {
        Args: { user_uuid: string }
        Returns: {
          granted: boolean
          permission_name: string
        }[]
      }
      has_permission: {
        Args: { permission: string; user_uuid: string }
        Returns: boolean
      }
      is_admin: {
        Args: { check_company_id?: string; user_id: string }
        Returns: boolean
      }
      is_company_admin: { Args: { target_company: string }; Returns: boolean }
      record_payment_with_allocation: {
        Args: {
          p_amount: number
          p_company_id: string
          p_customer_id: string
          p_invoice_id: string
          p_notes: string
          p_payment_date: string
          p_payment_method: string
          p_payment_number: string
          p_reference_number: string
        }
        Returns: Json
      }
      update_product_stock: {
        Args: { movement_type: string; product_uuid: string; quantity: number }
        Returns: Json
      }
      update_product_stock_core: {
        Args: {
          p_movement_type: string
          p_product_uuid: string
          p_quantity: number
        }
        Returns: Json
      }
    }
    Enums: {
      document_status:
        | "draft"
        | "pending"
        | "approved"
        | "sent"
        | "paid"
        | "cancelled"
        | "overdue"
        | "partial"
        | "accepted"
        | "expired"
        | "converted"
        | "rejected"
      document_type:
        | "quotation"
        | "invoice"
        | "proforma"
        | "delivery_note"
        | "credit_note"
        | "debit_note"
      lpo_status: "draft" | "sent" | "approved" | "received" | "cancelled"
      user_role:
        | "admin"
        | "accountant"
        | "stock_manager"
        | "sales"
        | "accounts"
        | "user"
        | "custom"
      user_status: "active" | "inactive" | "pending"
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
      document_status: [
        "draft",
        "pending",
        "approved",
        "sent",
        "paid",
        "cancelled",
        "overdue",
        "partial",
        "accepted",
        "expired",
        "converted",
        "rejected",
      ],
      document_type: [
        "quotation",
        "invoice",
        "proforma",
        "delivery_note",
        "credit_note",
        "debit_note",
      ],
      lpo_status: ["draft", "sent", "approved", "received", "cancelled"],
      user_role: [
        "admin",
        "accountant",
        "stock_manager",
        "sales",
        "accounts",
        "user",
        "custom",
      ],
      user_status: ["active", "inactive", "pending"],
    },
  },
} as const
