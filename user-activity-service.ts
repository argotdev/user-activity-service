// src/services/UserActivityService.ts

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import Redis from 'ioredis';
import { Logger } from 'winston';
import { 
  UserActivity, 
  EngagementMetrics, 
  UserActivityFilter, 
  CacheConfig,
  ApiConfig,
  ActivityType
} from '../types/UserActivity';

/**
 * Service responsible for fetching and processing user activity data.
 * Handles API interactions, caching, and calculates engagement metrics.
 */
export class UserActivityService {
  private httpClient: AxiosInstance;
  private cacheClient: Redis;
  private logger: Logger;
  private readonly apiConfig: ApiConfig;
  private readonly cacheConfig: CacheConfig;

  /**
   * Creates a new instance of UserActivityService.
   * 
   * @param httpClient - Axios instance for making HTTP requests
   * @param cacheClient - Redis client for caching results
   * @param logger - Winston logger for logging
   * @param apiConfig - Configuration for the API
   * @param cacheConfig - Configuration for the cache
   */
  constructor(
    httpClient: AxiosInstance,
    cacheClient: Redis,
    logger: Logger,
    apiConfig: ApiConfig,
    cacheConfig: CacheConfig,
  ) {
    this.httpClient = httpClient;
    this.cacheClient = cacheClient;
    this.logger = logger;
    this.apiConfig = apiConfig;
    this.cacheConfig = cacheConfig;
  }

  /**
   * Fetches user activity data from the API or cache.
   * 
   * @param userId - The ID of the user to fetch activity for
   * @param filter - Optional filters to apply to the activity data
   * @returns Promise resolving to an array of user activities
   * @throws Error if the API request fails
   */
  public async getUserActivity(
    userId: string,
    filter?: UserActivityFilter,
  ): Promise<UserActivity[]> {
    try {
      const cacheKey = this.generateCacheKey('activity', userId, filter);
      
      // Try to get data from cache first
      const cachedData = await this.getFromCache<UserActivity[]>(cacheKey);
      if (cachedData) {
        this.logger.debug('Retrieved user activity from cache', { userId });
        return cachedData;
      }

      // If not in cache, fetch from API
      const endpoint = `${this.apiConfig.basePath}/users/${userId}/activity`;
      const requestConfig: AxiosRequestConfig = {
        params: filter,
        timeout: this.apiConfig.timeoutMs,
      };

      this.logger.debug('Fetching user activity from API', { userId, filter });
      const response = await this.httpClient.get(endpoint, requestConfig);
      const activities = response.data as UserActivity[];

      // Store in cache
      await this.setInCache(cacheKey, activities, this.cacheConfig.activityTtlSec);
      
      return activities;
    } catch (error) {
      this.handleError('Failed to fetch user activity', error, { userId });
      throw error;
    }
  }

  /**
   * Calculates engagement metrics for a user based on their activity data.
   * 
   * @param userId - The ID of the user to calculate metrics for
   * @param timeRangeInDays - Optional time range in days to limit the activity data
   * @returns Promise resolving to engagement metrics
   * @throws Error if fetching activity data fails
   */
  public async calculateEngagementMetrics(
    userId: string,
    timeRangeInDays?: number,
  ): Promise<EngagementMetrics> {
    try {
      const cacheKey = this.generateCacheKey(
        'metrics', 
        userId, 
        { timeRangeInDays }
      );
      
      // Try to get metrics from cache
      const cachedMetrics = await this.getFromCache<EngagementMetrics>(cacheKey);
      if (cachedMetrics) {
        this.logger.debug('Retrieved engagement metrics from cache', { userId });
        return cachedMetrics;
      }

      // Create filter based on time range
      const filter: UserActivityFilter = {};
      if (timeRangeInDays) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - timeRangeInDays);
        filter.startDate = startDate.toISOString();
      }

      // Fetch activity data
      const activities = await this.getUserActivity(userId, filter);
      
      // Calculate metrics
      const metrics = this.processActivities(activities);
      
      // Store in cache
      await this.setInCache(
        cacheKey, 
        metrics, 
        this.cacheConfig.metricsTtlSec
      );
      
      return metrics;
    } catch (error) {
      this.handleError('Failed to calculate engagement metrics', error, { userId });
      throw error;
    }
  }

  /**
   * Invalidates cached data for a specific user.
   * 
   * @param userId - The ID of the user to invalidate cache for
   * @returns Promise resolving when cache is invalidated
   */
  public async invalidateUserCache(userId: string): Promise<void> {
    try {
      const pattern = `user-activity:${userId}:*`;
      
      // Find all keys matching the pattern
      const keys = await this.cacheClient.keys(pattern);
      
      if (keys.length > 0) {
        // Delete all matching keys
        await this.cacheClient.del(...keys);
        this.logger.info('Invalidated user cache', { userId, keysCount: keys.length });
      } else {
        this.logger.debug('No cache to invalidate', { userId });
      }
    } catch (error) {
      this.handleError('Failed to invalidate user cache', error, { userId });
      throw error;
    }
  }

  /**
   * Bulks process activities for multiple users.
   * 
   * @param userIds - Array of user IDs to process
   * @param timeRangeInDays - Optional time range in days
   * @returns Promise resolving to a map of user IDs to their engagement metrics
   */
  public async bulkProcessUserMetrics(
    userIds: string[],
    timeRangeInDays?: number,
  ): Promise<Map<string, EngagementMetrics>> {
    const uniqueUserIds = [...new Set(userIds)]; // Remove duplicates
    const metricsMap = new Map<string, EngagementMetrics>();
    
    // Use Promise.allSettled to handle partial failures
    const results = await Promise.allSettled(
      uniqueUserIds.map(async (userId) => {
        const metrics = await this.calculateEngagementMetrics(userId, timeRangeInDays);
        return { userId, metrics };
      })
    );
    
    // Process results
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { userId, metrics } = result.value;
        metricsMap.set(userId, metrics);
      } else {
        this.logger.error('Failed to process user metrics', {
          error: result.reason,
          userIdsCount: uniqueUserIds.length,
        });
      }
    });
    
    this.logger.info('Bulk processed user metrics', {
      requested: uniqueUserIds.length,
      processed: metricsMap.size,
    });
    
    return metricsMap;
  }

  // Private methods

  /**
   * Processes activity data to calculate engagement metrics.
   * 
   * @param activities - Array of user activities
   * @returns Calculated engagement metrics
   */
  private processActivities(activities: UserActivity[]): EngagementMetrics {
    // Initialize metrics with default values
    const metrics: EngagementMetrics = {
      totalActivities: activities.length,
      activityByType: {},
      averageDurationSec: 0,
      mostActiveHour: 0,
      mostActiveDay: 0,
      daysSinceLastActivity: 0,
      engagementScore: 0,
    };

    if (activities.length === 0) {
      return metrics;
    }

    // Initialize counters
    let totalDuration = 0;
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    const typeCounts: Record<ActivityType, number> = {} as Record<ActivityType, number>;
    let latestActivityDate = new Date(0);

    // Process each activity
    activities.forEach((activity) => {
      // Count activities by type
      typeCounts[activity.type] = (typeCounts[activity.type] || 0) + 1;
      
      // Track duration
      if (activity.durationSec) {
        totalDuration += activity.durationSec;
      }
      
      // Process timestamp data
      const activityDate = new Date(activity.timestamp);
      
      // Update latest activity
      if (activityDate > latestActivityDate) {
        latestActivityDate = activityDate;
      }
      
      // Track hour and day distribution
      hourCounts[activityDate.getHours()]++;
      dayCounts[activityDate.getDay()]++;
    });

    // Calculate average duration
    metrics.averageDurationSec = activities.length > 0 
      ? Math.round(totalDuration / activities.length) 
      : 0;
    
    // Find most active hour and day
    metrics.mostActiveHour = hourCounts.indexOf(Math.max(...hourCounts));
    metrics.mostActiveDay = dayCounts.indexOf(Math.max(...dayCounts));
    
    // Calculate days since last activity
    const currentDate = new Date();
    const timeDiff = currentDate.getTime() - latestActivityDate.getTime();
    metrics.daysSinceLastActivity = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    
    // Set activity by type
    metrics.activityByType = typeCounts;
    
    // Calculate engagement score (simplified example)
    // In a real implementation, this would use a more sophisticated algorithm
    metrics.engagementScore = this.calculateEngagementScore(metrics);
    
    return metrics;
  }

  /**
   * Calculates an engagement score based on activity metrics.
   * 
   * @param metrics - The engagement metrics to calculate a score from
   * @returns A numerical engagement score
   */
  private calculateEngagementScore(metrics: EngagementMetrics): number {
    // This is a simplified example of an engagement score calculation
    // A real implementation would likely use a more sophisticated algorithm
    
    // Base score from total activities with diminishing returns
    const activityScore = Math.log(metrics.totalActivities + 1) * 10;
    
    // Recency factor - higher for more recent activity
    const recencyFactor = Math.max(0, 1 - (metrics.daysSinceLastActivity / 30));
    
    // Duration factor - longer average durations are better
    const durationFactor = Math.min(1, metrics.averageDurationSec / 300); // Cap at 5 minutes
    
    // Diversity factor - reward having multiple types of activities
    const activityTypes = Object.keys(metrics.activityByType).length;
    const diversityFactor = Math.min(1, activityTypes / 5); // Cap at 5 types
    
    // Weighted score calculation
    const score = (
      (activityScore * 0.4) + 
      (recencyFactor * 30) + 
      (durationFactor * 15) + 
      (diversityFactor * 15)
    );
    
    // Normalize to 0-100 range and round
    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Generates a cache key based on prefix, user ID, and optional filter.
   * 
   * @param prefix - The cache key prefix
   * @param userId - The user ID
   * @param filter - Optional filter to include in the cache key
   * @returns Generated cache key
   */
  private generateCacheKey(
    prefix: string,
    userId: string,
    filter?: Record<string, any>,
  ): string {
    let key = `user-activity:${userId}:${prefix}`;
    
    if (filter && Object.keys(filter).length > 0) {
      // Sort keys for consistent cache keys regardless of object property order
      const sortedEntries = Object.entries(filter)
        .filter(([, value]) => value !== undefined)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
      
      if (sortedEntries.length > 0) {
        const filterString = sortedEntries
          .map(([key, value]) => `${key}=${value}`)
          .join('&');
        
        key += `:${Buffer.from(filterString).toString('base64')}`;
      }
    }
    
    return key;
  }

  /**
   * Retrieves data from cache.
   * 
   * @param key - The cache key
   * @returns Promise resolving to cached data or null if not found
   */
  private async getFromCache<T>(key: string): Promise<T | null> {
    try {
      const cachedData = await this.cacheClient.get(key);
      
      if (!cachedData) {
        return null;
      }
      
      return JSON.parse(cachedData) as T;
    } catch (error) {
      this.logger.warn('Cache retrieval failed, falling back to API', { key, error });
      return null;
    }
  }

  /**
   * Stores data in cache.
   * 
   * @param key - The cache key
   * @param data - The data to store
   * @param ttlSeconds - Time to live in seconds
   * @returns Promise resolving when data is cached
   */
  private async setInCache<T>(
    key: string,
    data: T,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      const serializedData = JSON.stringify(data);
      await this.cacheClient.setex(key, ttlSeconds, serializedData);
    } catch (error) {
      // Non-critical error, just log it
      this.logger.warn('Failed to cache data', { key, error });
    }
  }

  /**
   * Handles and logs errors consistently.
   * 
   * @param message - Error message
   * @param error - The error object
   * @param context - Additional context
   */
  private handleError(
    message: string,
    error: unknown,
    context: Record<string, any> = {},
  ): void {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      this.logger.error(message, {
        ...context,
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        url: axiosError.config?.url,
        error: axiosError.message,
      });
    } else {
      this.logger.error(message, {
        ...context,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
