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
      User: {
        Row: {
          id: string
          email: string
          created_at: string
        }
        Insert: {
          id: string
          email: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
        }
      }
      Tour: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
          start_location: Json | null
          end_location: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
          start_location?: Json | null
          end_location?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
          start_location?: Json | null
          end_location?: Json | null
        }
      }
      Poi: {
        Row: {
          id: string
          place_id: string
          name: string
          formatted_address: string | null
          location: Json | null
          types: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          place_id: string
          name: string
          formatted_address?: string | null
          location?: Json | null
          types?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          place_id?: string
          name?: string
          formatted_address?: string | null
          location?: Json | null
          types?: string[] | null
          created_at?: string
        }
      }
      TourPoi: {
        Row: {
          id: string
          tour_id: string
          poi_id: string
          order: number | null
          created_at: string
        }
        Insert: {
          id?: string
          tour_id: string
          poi_id: string
          order?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          tour_id?: string
          poi_id?: string
          order?: number | null
          created_at?: string
        }
      }
      poi_audio: {
        Row: {
          id: string
          poi_id: string
          core_audio_url: string
          secondary_audio_url: string
          tertiary_audio_url: string
          sources: string[] | null
          quality_score: number | null
          voice: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          poi_id: string
          core_audio_url: string
          secondary_audio_url: string
          tertiary_audio_url: string
          sources?: string[] | null
          quality_score?: number | null
          voice?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          poi_id?: string
          core_audio_url?: string
          secondary_audio_url?: string
          tertiary_audio_url?: string
          sources?: string[] | null
          quality_score?: number | null
          voice?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Functions: {}
  }
  auth: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
        }
        Insert: {
          id: string
          email: string
        }
        Update: {
          id?: string
          email?: string
        }
      }
    }
    Functions: {}
  }
} 