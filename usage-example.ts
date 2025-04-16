// src/examples/userActivityExample.ts

import express from 'express';
import { createUserActivityService } from '../services/UserActivityServiceFactory';
import { ActivityType } from '../types/UserActivity';

// Create an Express app
const app = express();
app.use(express.json());

// Initialize the user activity service
const userActivityService = createUserActivityService();

/**
 * Route to get user engagement metrics
 */
app.get('/api/users/:userId/engagement', async (req, res) => {
  try {
    const { userId } = req.params;
    const { timeRange } = req.query;
    
    // Convert timeRange to number if provided
    const timeRangeInDays = timeRange ? parseInt(timeRange as string, 10) : undefined;
    
    // Get engagement metrics
    const metrics = await userActivityService.calculateEngagementMetrics(
      userId,
      timeRangeInDays
    );
    
    res.json({
      userId,
      metrics,
      timeRangeInDays,
    });
  } catch (error) {
    console.error('Error fetching engagement metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch engagement metrics',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Route to get user activity history
 */
app.get('/api/users/:userId/activity', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, type, path, limit } = req.query;
    
    // Build filter from query parameters
    const filter = {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      type: type as ActivityType | undefined,
      path: path as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    };
    
    // Get user activity
    const activities = await userActivityService.getUserActivity(userId, filter);
    
    res.json({
      userId,
      activities,
      filter,
    });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user activity',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Route to fetch engagement metrics for multiple users
 */
app.post('/api/users/bulk/engagement', async (req, res) => {
  try {
    const { userIds, timeRange } = req.body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'User IDs array is required' });
    }
    
    // Convert timeRange to number if provided
    const timeRangeInDays = timeRange ? parseInt(timeRange as string, 10) : undefined;
    
    // Process metrics for multiple users
    const metricsMap = await userActivityService.bulkProcessUserMetrics(
      userIds,
      timeRangeInDays
    );
    
    // Convert Map to array of objects for JSON response
    const results = Array.from(metricsMap.entries()).map(([userId, metrics]) => ({
      userId,
      metrics,
    }));
    
    res.json({
      results,
      processed: results.length,
      requested: userIds.length,
      timeRangeInDays,
    });
  } catch (error) {
    console.error('Error processing bulk metrics:', error);
    res.status(500).json({ 
      error: 'Failed to process bulk metrics',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Route to invalidate user cache
 */
app.post('/api/users/:userId/cache/invalidate', async (req, res) => {
  try {
    const { userId } = req.params;
    
    await userActivityService.invalidateUserCache(userId);
    
    res.json({
      success: true,
      message: `Cache invalidated for user ${userId}`,
    });
  } catch (error) {
    console.error('Error invalidating cache:', error);
    res.status(500).json({ 
      error: 'Failed to invalidate cache',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
