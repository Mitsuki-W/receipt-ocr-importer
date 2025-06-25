export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      receipts: {
        Row: {
          id: string
          user_id: string
          image_url: string
          original_filename: string | null
          file_size: number | null
          ocr_text: string | null
          store_name: string | null
          purchase_date: string | null
          total_amount: number | null
          processing_status: string
          uploaded_at: string
          processed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          image_url: string
          original_filename?: string | null
          file_size?: number | null
          ocr_text?: string | null
          store_name?: string | null
          purchase_date?: string | null
          total_amount?: number | null
          processing_status?: string
          uploaded_at?: string
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          image_url?: string
          original_filename?: string | null
          file_size?: number | null
          ocr_text?: string | null
          store_name?: string | null
          purchase_date?: string | null
          total_amount?: number | null
          processing_status?: string
          uploaded_at?: string
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      items: {
        Row: {
          id: string
          user_id: string
          receipt_id: string | null
          name: string
          category: string
          quantity: number
          unit: string
          price: number | null
          expiry_date: string | null
          purchase_date: string | null
          is_consumed: boolean
          consumed_at: string | null
          notes: string | null
          registered_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          receipt_id?: string | null
          name: string
          category?: string
          quantity?: number
          unit?: string
          price?: number | null
          expiry_date?: string | null
          purchase_date?: string | null
          is_consumed?: boolean
          consumed_at?: string | null
          notes?: string | null
          registered_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          receipt_id?: string | null
          name?: string
          category?: string
          quantity?: number
          unit?: string
          price?: number | null
          expiry_date?: string | null
          purchase_date?: string | null
          is_consumed?: boolean
          consumed_at?: string | null
          notes?: string | null
          registered_at?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}