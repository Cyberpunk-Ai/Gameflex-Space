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

export default router;
