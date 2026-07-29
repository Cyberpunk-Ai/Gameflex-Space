// @ts-nocheck

export type RecommendationFeedType = 'home' | 'stories' | 'reels' | 'friends' | 'explore';
export type RecommendationEntityType = 'post' | 'story' | 'reel' | 'profile' | 'friend' | 'tournament' | 'comment';
export type RecommendationAction =
  | 'view'
  | 'like'
  | 'save'
  | 'share'
  | 'hide'
  | 'report'
  | 'follow'
  | 'unfollow'
  | 'unlike'
  | 'unsave'
  | 'comment'
  | 'story_view'
  | 'reel_view';

export interface RecommendationEvent {
  userId?: string | null;
  entityType: RecommendationEntityType;
  entityId: string;
  action: RecommendationAction;
  metadata?: Record<string, any>;
}

export class RecommendationEventService {
  private readonly baseUrl = '/api/recommendations/events';

  async recordEvent(event: RecommendationEvent) {
    try {
      await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });
    } catch {
      // best-effort only; do not block UI
    }
  }
}

export const recommendationEventService = new RecommendationEventService();
