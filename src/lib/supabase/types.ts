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
      items: {
        Row: {
          id: string
          user_id: string
          name: string
          category: string
          quantity: number
          unit: string
          price: number | null
          currency: string
          expiry_date: string | null
          purchase_date: string | null
          is_consumed: boolean
          consumed_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          category?: string
          quantity?: number
          unit?: string
          price?: number | null
          currency?: string
          expiry_date?: string | null
          purchase_date?: string | null
          is_consumed?: boolean
          consumed_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          category?: string
          quantity?: number
          unit?: string
          price?: number | null
          currency?: string
          expiry_date?: string | null
          purchase_date?: string | null
          is_consumed?: boolean
          consumed_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}