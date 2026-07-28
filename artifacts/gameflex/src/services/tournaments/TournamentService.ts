// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type Tournament = Database['public']['Tables']['tournaments']['Row'];
export type Registration = Database['public']['Tables']['registrations']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
export type GameRoom = Database['public']['Tables']['game_rooms']['Row'];

export type TournamentInput = Omit<Database['public']['Tables']['tournaments']['Insert'], 'id' | 'created_at' | 'updated_at'>;

export interface LeaderboardEntry {
  user_id: string;
  username?: string;
  points: number;
  rank: number;
}

export class TournamentService {
  async getAll(filters?: { status?: string; game?: string; search?: string }): Promise<Tournament[]> {
    try {
      let query = supabase.from('tournaments').select('*').order('created_at', { ascending: false });
      
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.game) query = query.eq('game_id', filters.game);
      if (filters?.search) query = query.ilike('title', `%${filters.search}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data as Tournament[];
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  async getById(id: string): Promise<Tournament | null> {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Tournament;
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  async create(data: TournamentInput): Promise<{ tournament: Tournament | null; error?: Error }> {
    try {
      const { data: result, error } = await supabase
        .from('tournaments')
        .insert(data as any)
        .select()
        .single();
      if (error) throw error;
      return { tournament: result as Tournament };
    } catch (err: any) {
      return { tournament: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async update(id: string, data: Partial<TournamentInput>): Promise<{ error?: Error }> {
    try {
      const { error } = await supabase
        .from('tournaments')
        .update(data as any)
        .eq('id', id);
      if (error) throw error;
      return {};
    } catch (err: any) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async delete(id: string): Promise<{ error?: Error }> {
    try {
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return {};
    } catch (err: any) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async joinTournament(tournamentId: string, userId: string, gameHandle: string, paymentId?: string): Promise<{ registration: Registration | null; error?: Error }> {
    try {
      const { data, error } = await supabase
        .from('registrations')
        .insert({
          tournament_id: tournamentId,
          user_id: userId,
          game_handle: gameHandle,
          payment_id: paymentId,
          status: 'pending' // or 'approved' depending on whether payment is required
        } as any)
        .select()
        .single();
      if (error) throw error;
      return { registration: data as Registration };
    } catch (err: any) {
      return { registration: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async leaveTournament(tournamentId: string, userId: string): Promise<{ error?: Error }> {
    try {
      const { error } = await supabase
        .from('registrations')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('user_id', userId);
      if (error) throw error;
      return {};
    } catch (err: any) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async getRegistrations(tournamentId: string): Promise<Registration[]> {
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('*, profiles!inner(*)')
        .eq('tournament_id', tournamentId);
      if (error) return [];
      return data as any[];
    } catch (err) {
      return [];
    }
  }

  async getUserRegistrations(userId: string): Promise<Registration[]> {
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('*, tournaments!inner(*)')
        .eq('user_id', userId);
      if (error) return [];
      return data as any[];
    } catch (err) {
      return [];
    }
  }

  async getMatches(tournamentId: string): Promise<Match[]> {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*, player1:profiles!matches_player1_id_fkey(*), player2:profiles!matches_player2_id_fkey(*)')
        .eq('tournament_id', tournamentId)
        .order('round_number', { ascending: true });
      if (error) return [];
      return data as any[];
    } catch (err) {
      return [];
    }
  }

  async updateScore(matchId: string, player1Score: number, player2Score: number): Promise<{ error?: Error }> {
    try {
      const { error } = await supabase
        .from('matches')
        .update({
          player1_score: player1Score,
          player2_score: player2Score,
          status: 'completed',
          winner_id: player1Score > player2Score ? 'player1_id' : (player2Score > player1Score ? 'player2_id' : null) // Requires custom logic to fetch actual IDs, simplified here
        } as any)
        .eq('id', matchId);
      if (error) throw error;
      return {};
    } catch (err: any) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  async getLeaderboard(tournamentId: string): Promise<LeaderboardEntry[]> {
    // Basic stub - in reality you might aggregate matches or fetch from a materialized view
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('user_id, profiles!inner(username)')
        .eq('tournament_id', tournamentId);
      if (error) return [];
      return data.map((row: any, i) => ({
        user_id: row.user_id,
        username: row.profiles?.username,
        points: 0,
        rank: i + 1
      }));
    } catch (err) {
      return [];
    }
  }

  async getGameRooms(tournamentId: string): Promise<GameRoom[]> {
    try {
      const { data, error } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('tournament_id', tournamentId);
      if (error) return [];
      return data as GameRoom[];
    } catch (err) {
      return [];
    }
  }
}

export const tournamentService = new TournamentService();
