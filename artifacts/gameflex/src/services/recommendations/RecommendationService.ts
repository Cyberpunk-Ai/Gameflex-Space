// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';

export type RecommendationFeedType = 'home' | 'stories' | 'reels' | 'friends' | 'explore';

export interface RecommendationCandidate<T = any> {
  id: string;
  type: string;
  score: number;
  payload: T;
}

export interface RecommendationResponse<T = any> {
  items: RecommendationCandidate<T>[];
}

export class RecommendationService {
  private readonly baseUrl = '/api/recommendations';

  async fetchRecommendations(feedType: RecommendationFeedType, userId?: string, limit = 20) {
    const params = new URLSearchParams({
      feedType,
      limit: String(limit),
    });
    if (userId) params.set('userId', userId);

    const res = await fetch(`${this.baseUrl}?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to load recommendations: ${res.statusText}`);
    }
    return (await res.json()) as RecommendationResponse;
  }
}

export const recommendationService = new RecommendationService();
