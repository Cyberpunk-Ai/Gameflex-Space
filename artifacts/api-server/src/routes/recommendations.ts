import { Router } from 'express';
import { recommendationService } from '../services/RecommendationService';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const userId = String(req.query.userId || '');
    const feedType = String(req.query.feedType || 'home') as any;
    const limit = Number(req.query.limit ?? 20);

    const response = await recommendationService.recommend({
      userId: userId || undefined,
      feedType,
      limit: Math.min(Math.max(limit, 5), 50),
    });

    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error?.message ?? 'Unknown error' });
  }
});

router.post('/events', async (req, res) => {
  try {
    const { userId, entityType, entityId, action, metadata } = req.body;
    await recommendationService.recordEvent({
      user_id: userId ?? null,
      entity_type: entityType,
      entity_id: entityId,
      action,
      metadata,
      created_at: new Date().toISOString(),
    });
    res.status(201).json({ status: 'ok' });
  } catch (error: any) {
    res.status(500).json({ error: error?.message ?? 'Failed to record event' });
  }
});

export default router;
