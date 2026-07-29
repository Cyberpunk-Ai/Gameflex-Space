// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export interface RecommendationEvent {
  user_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface RecommendationCandidate {
  id: string;
  type: string;
  score: number;
  payload: Record<string, any>;
}

export interface RecommendationRequest {
  userId?: string;
  feedType: 'home' | 'stories' | 'reels' | 'friends' | 'explore';
  limit?: number;
}

export interface RecommendationResponse {
  items: RecommendationCandidate[];
}

const DEFAULT_WEIGHT_CONFIG = {
  interests: 3.0,
  follows: 2.5,
  gameAffinity: 2.0,
  likes: 1.3,
  comments: 1.2,
  shares: 1.0,
  saves: 1.5,
  watchTime: 1.4,
  profileVisits: 1.1,
  searchSignals: 1.0,
  ctr: 1.2,
  dwellTime: 1.2,
  friendInteractions: 1.5,
  recency: 1.8,
  popularity: 1.1,
  contentQuality: 1.6,
  exploration: 0.8,
  spamPenalty: 2.0,
};

function buildWeightConfig(overrides: Partial<typeof DEFAULT_WEIGHT_CONFIG> = {}) {
  return { ...DEFAULT_WEIGHT_CONFIG, ...overrides };
}

function freshScore(createdAt: string) {
  const ageHours = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3_600_000);
  return Math.max(0.1, Math.exp(-ageHours / 24));
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export class RecommendationService {
  async recommend(request: RecommendationRequest): Promise<RecommendationResponse> {
    const { userId, feedType, limit = 20 } = request;
    const weights = buildWeightConfig();

    const candidates = await this.getCandidates(feedType, limit * 3);
    const profileSignals = userId ? await this.getUserSignals(userId) : null;

    const scored = candidates.map((candidate) => {
      const score = this.scoreCandidate(candidate, profileSignals, weights);
      return { ...candidate, score };
    });

    const ranked = scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return { items: ranked };
  }

  async getCandidates(feedType: RecommendationRequest['feedType'], maxItems: number): Promise<RecommendationCandidate[]> {
    switch (feedType) {
      case 'home':
      case 'explore':
        return this.getStatusCandidates(maxItems);
      case 'stories':
        return this.getStoryCandidates(maxItems);
      case 'reels':
        return this.getReelCandidates(maxItems);
      case 'friends':
        return this.getSuggestedFriendCandidates(maxItems);
      default:
        return [];
    }
  }

  async getStatusCandidates(limit: number): Promise<RecommendationCandidate[]> {
    const { data } = await supabase
      .from('user_statuses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data ?? []).map((status: any) => ({
      id: status.id,
      type: 'post',
      payload: status,
      score: 0,
    }));
  }

  async getStoryCandidates(limit: number): Promise<RecommendationCandidate[]> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('user_statuses')
      .select('*')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data ?? []).map((story: any) => ({
      id: story.id,
      type: 'story',
      payload: story,
      score: 0,
    }));
  }

  async getReelCandidates(limit: number): Promise<RecommendationCandidate[]> {
    const { data } = await supabase
      .from('user_statuses')
      .select('*')
      .eq('media_type', 'video')
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data ?? []).map((reel: any) => ({
      id: reel.id,
      type: 'reel',
      payload: reel,
      score: 0,
    }));
  }

  async getSuggestedFriendCandidates(limit: number): Promise<RecommendationCandidate[]> {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url, total_wins, total_matches')
      .order('total_wins', { ascending: false })
      .limit(limit);
    return (data ?? []).map((profile: any) => ({
      id: profile.user_id,
      type: 'friend',
      payload: profile,
      score: 0,
    }));
  }

  async getUserSignals(userId: string) {
    const [eventsRes, followsRes] = await Promise.all([
      supabase
        .from('recommendation_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', userId),
    ]);

    const events = eventsRes.data ?? [];
    const follows = followsRes.data?.map((f: any) => f.following_id) ?? [];
    return { events, follows };
  }

  scoreCandidate(candidate: RecommendationCandidate, profileSignals: any, weights: ReturnType<typeof buildWeightConfig>) {
    const payload = candidate.payload as any;
    const now = Date.now();
    let score = 0;

    if (profileSignals) {
      const follows = new Set(profileSignals.follows || []);
      if (follows.has(payload.user_id)) score += weights.follows;
    }

    if (payload.likes_count != null) score += (payload.likes_count ?? 0) * weights.likes;
    if (payload.comments_count != null) score += (payload.comments_count ?? 0) * weights.comments;
    if (payload.views_count != null) score += (payload.views_count ?? 0) * weights.watchTime * 0.1;
    if (payload.media_type === 'video') score += weights.watchTime;
    if (payload.media_url && payload.media_type !== 'video') score += 0.25;

    if (payload.created_at) {
      score += freshScore(payload.created_at) * weights.recency;
    }

    if (payload.likes_count != null && payload.comments_count != null) {
      const engagement = (payload.likes_count * 1.2 + payload.comments_count * 1.4);
      score += engagement * weights.popularity;
    }

    if (profileSignals) {
      const spamSignal = profileSignals.events.filter((event: any) => event.action === 'hide' || event.action === 'report').length;
      score -= spamSignal * weights.spamPenalty;
    }

    const quality = payload.likes_count ?? 0 + payload.comments_count ?? 0;
    score += clamp(quality / 50, 0, 1) * weights.contentQuality;

    if (candidate.type === 'friend') {
      score += 0.5;
      if (profileSignals) {
        const coPlayed = profileSignals.events.filter((event: any) => event.entity_type === 'tournament' && event.action === 'register').length;
        score += clamp(coPlayed / 5, 0, 1) * weights.friendInteractions;
      }
    }

    score += Math.random() * weights.exploration;

    return score;
  }
}

export const recommendationService = new RecommendationService();
