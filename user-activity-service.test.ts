// src/services/__tests__/UserActivityService.test.ts

import axios, { AxiosInstance } from 'axios';
import Redis from 'ioredis';
import winston from 'winston';
import { UserActivityService } from '../UserActivityService';
import { 
  UserActivity, 
  ActivityType, 
  ApiConfig, 
  CacheConfig 
} from '../../types/UserActivity';

// Mock dependencies
jest.mock('axios');
jest.mock('ioredis');
jest.mock('winston');

// Test constants
const TEST_USER_ID = 'user123';
const API_CONFIG: ApiConfig = {
  basePath: 'https://api.test.com',
  timeoutMs: 1000,
};
const CACHE_CONFIG: CacheConfig = {
  activityTtlSec: 60,
  metricsTtlSec: 300,
};

// Mock activity data
const mockActivities: UserActivity[] = [
  {
    id: 'activity1',
    userId: TEST_USER_ID,
    type: ActivityType.PAGE_VIEW,
    timestamp: '2023-05-01T10:00:00Z',
    path: '/products',
    device: 'desktop',
  },
  {
    id: 'activity2',
    userId: TEST_USER_ID,
    type: ActivityType.CLICK,
    timestamp: '2023-05-01T10:05:00Z',
    path: '/products/123',
    device: 'desktop',
  },
  {
    id: 'activity3',
    userId: TEST_USER_ID,
    type: ActivityType.VIDEO_PLAY,
    timestamp: '2023-05-01T11:00:00Z',
    path: '/products/123/video',
    device: 'desktop',
    durationSec: 120,
  },
];

describe('UserActivityService', () => {
  let service: UserActivityService;
  let mockHttpClient: jest.Mocked<AxiosInstance>;
  let mockCacheClient: jest.Mocked<Redis>;
  let mockLogger: jest.Mocked<winston.Logger>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock HTTP client
    mockHttpClient = axios.create() as jest.Mocked<AxiosInstance>;
    mockHttpClient.get = jest.fn();

    // Setup mock cache client
    mockCacheClient = new Redis() as unknown as jest.Mocked<Redis>;
    mockCacheClient.get = jest.fn();
    mockCacheClient.setex = jest.fn();
    mockCacheClient.keys = jest.fn();
    mockCacheClient.del = jest.fn();

    // Setup mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<winston.Logger>;

    // Create service instance with mocks
    service = new UserActivityService(
      mockHttpClient,
      mockCacheClient,
      mockLogger,
      API_CONFIG,
      CACHE_CONFIG,
    );
  });

  describe('getUserActivity', () => {
    it('should fetch activities from API when not in cache', async () => {
      // Setup cache miss
      mockCacheClient.get.mockResolvedValue(null);
      
      // Setup API response
      mockHttpClient.get.mockResolvedValue({ data: mockActivities });

      // Call method
      const result = await service.getUserActivity(TEST_USER_ID);

      // Assertions
      expect(mockCacheClient.get).toHaveBeenCalled();
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `${API_CONFIG.basePath}/users/${TEST_USER_ID}/activity`,
        expect.any(Object),
      );
      expect(mockCacheClient.setex).toHaveBeenCalled();
      expect(result).toEqual(mockActivities);
    });

    it('should return activities from cache when available', async () => {
      // Setup cache hit
      mockCacheClient.get.mockResolvedValue(JSON.stringify(mockActivities));

      // Call method
      const result = await service.getUserActivity(TEST_USER_ID);

      // Assertions
      expect(mockCacheClient.get).toHaveBeenCalled();
      expect(mockHttpClient.get).not.toHaveBeenCalled();
      expect(result).toEqual(mockActivities);
    });

    it('should apply filters to API request', async () => {
      // Setup cache miss
      mockCacheClient.get.mockResolvedValue(null);
      
      // Setup API response
      mockHttpClient.get.mockResolvedValue({ data: mockActivities });

      // Define filter
      const filter = {
        startDate: '2023-05-01T00:00:00Z',
        type: ActivityType.PAGE_VIEW,
      };

      // Call method with filter
      await service.getUserActivity(TEST_USER_ID, filter);

      // Assertions
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        `${API_CONFIG.basePath}/users/${TEST_USER_ID}/activity`,
        expect.objectContaining({
          params: filter,
        }),
      );
    });

    it('should handle API errors gracefully', async () => {
      // Setup cache miss
      mockCacheClient.get.mockResolvedValue(null);
      
      // Setup API error
      const apiError = new Error('API Error');
      mockHttpClient.get.mockRejectedValue(apiError);

      // Call method and expect it to throw
      await expect(service.getUserActivity(TEST_USER_ID)).rejects.toThrow();

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('calculateEngagementMetrics', () => {
    it('should calculate metrics correctly', async () => {
      // Setup cache miss
      mockCacheClient.get.mockResolvedValue(null);
      
      // Setup API response
      mockHttpClient.get.mockResolvedValue({ data: mockActivities });

      // Call method
      const metrics = await service.calculateEngagementMetrics(TEST_USER_ID);

      // Assertions
      expect(metrics).toHaveProperty('totalActivities', 3);
      expect(metrics).toHaveProperty('activityByType');
      expect(metrics.activityByType).toHaveProperty(ActivityType.PAGE_VIEW, 1);
      expect(metrics.activityByType).toHaveProperty(ActivityType.CLICK, 1);
      expect(metrics.activityByType).toHaveProperty(ActivityType.VIDEO_PLAY, 1);
      expect(metrics).toHaveProperty('engagementScore');
      
      // Verify cache operations
      expect(mockCacheClient.get).toHaveBeenCalled();
      expect(mockCacheClient.setex).toHaveBeenCalled();
    });

    it('should return metrics from cache when available', async () => {
      // Setup mock cached metrics
      const cachedMetrics = {
        totalActivities: 3,
        activityByType: { 
          [ActivityType.PAGE_VIEW]: 1,
          [ActivityType.CLICK]: 1,
          [ActivityType.VIDEO_PLAY]: 1 
        },
        averageDurationSec: 40,
        mostActiveHour: 10,
        mostActiveDay: 1,
        daysSinceLastActivity: 5,
        engagementScore: 75,
      };
      
      // Setup cache hit
      mockCacheClient.get.mockResolvedValue(JSON.stringify(cachedMetrics));

      // Call method
      const metrics = await service.calculateEngagementMetrics(TEST_USER_ID);

      // Assertions
      expect(metrics).toEqual(cachedMetrics);
      expect(mockHttpClient.get).not.toHaveBeenCalled();
    });

    it('should handle empty activity data', async () => {
      // Setup cache miss
      mockCacheClient.get.mockResolvedValue(null);
      
      // Setup API response with empty array
      mockHttpClient.get.mockResolvedValue({ data: [] });

      // Call method
      const metrics = await service.calculateEngagementMetrics(TEST_USER_ID);

      // Assertions for default values
      expect(metrics).toHaveProperty('totalActivities', 0);
      expect(metrics).toHaveProperty('activityByType', {});
      expect(metrics).toHaveProperty('averageDurationSec', 0);
      expect(metrics).toHaveProperty('engagementScore', 0);
    });
  });

  describe('invalidateUserCache', () => {
    it('should delete all cache keys for a user', async () => {
      // Setup keys response
      const cacheKeys = [
        `user-activity:${TEST_USER_ID}:activity`,
        `user-activity:${TEST_USER_ID}:metrics`,
      ];
      mockCacheClient.keys.mockResolvedValue(cacheKeys);
      mockCacheClient.del.mockResolvedValue(2);

      // Call method
      await service.invalidateUserCache(TEST_USER_ID);

      // Assertions
      expect(mockCacheClient.keys).toHaveBeenCalledWith(`user-activity:${TEST_USER_ID}:*`);
      expect(mockCacheClient.del).toHaveBeenCalledWith(...cacheKeys);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should handle case with no keys to invalidate', async () => {
      // Setup empty keys response
      mockCacheClient.keys.mockResolvedValue([]);

      // Call method
      await service.invalidateUserCache(TEST_USER_ID);

      // Assertions
      expect(mockCacheClient.del).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });

  describe('bulkProcessUserMetrics', () => {
    it('should process metrics for multiple users', async () => {
      // Setup users
      const userIds = ['user1', 'user2', 'user3'];
      
      // Mock calculateEngagementMetrics to return different metrics for each user
      const mockCalculateEngagementMetrics = jest.spyOn(service, 'calculateEngagementMetrics');
      
      userIds.forEach((userId, index) => {
        mockCalculateEngagementMetrics.mockResolvedValueOnce({
          totalActivities: index + 1,
          activityByType: { [ActivityType.PAGE_VIEW]: index + 1 },
          averageDurationSec: index * 10,
          mostActiveHour: 10,
          mostActiveDay: 1,
          daysSinceLastActivity: index,
          engagementScore: 50 + index * 10,
        });
      });

      // Call method
      const result = await service.bulkProcessUserMetrics(userIds);

      // Assertions
      expect(mockCalculateEngagementMetrics).toHaveBeenCalledTimes(3);
      expect(result.size).toBe(3);
      expect(result.get('user1')).toBeDefined();
      expect(result.get('user2')).toBeDefined();
      expect(result.get('user3')).toBeDefined();
      expect(result.get('user1')?.totalActivities).toBe(1);
      expect(result.get('user2')?.totalActivities).toBe(2);
      expect(result.get('user3')?.totalActivities).toBe(3);
    });

    it('should handle partial failures gracefully', async () => {
      // Setup users
      const userIds = ['user1', 'user2', 'user3'];
      
      // Mock calculateEngagementMetrics to succeed for two users and fail for one
      const mockCalculateEngagementMetrics = jest.spyOn(service, 'calculateEngagementMetrics');
      
      mockCalculateEngagementMetrics
        .mockResolvedValueOnce({
          totalActivities: 1,
          activityByType: { [ActivityType.PAGE_VIEW]: 1 },
          averageDurationSec: 0,
          mostActiveHour: 10,
          mostActiveDay: 1,
          daysSinceLastActivity: 0,
          engagementScore: 50,
        })
        .mockRejectedValueOnce(new Error('Failed for user2'))
        .mockResolvedValueOnce({
          totalActivities: 3,
          activityByType: { [ActivityType.PAGE_VIEW]: 3 },
          averageDurationSec: 20,
          mostActiveHour: 10,
          mostActiveDay: 1,
          daysSinceLastActivity: 2,
          engagementScore: 70,
        });

      // Call method
      const result = await service.bulkProcessUserMetrics(userIds);

      // Assertions
      expect(mockCalculateEngagementMetrics).toHaveBeenCalledTimes(3);
      expect(result.size).toBe(2); // Only 2 succeeded
      expect(result.get('user1')).toBeDefined();
      expect(result.get('user2')).toBeUndefined(); // Failed
      expect(result.get('user3')).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled(); // Error logged
    });

    it('should deduplicate user IDs', async () => {
      // Setup users with duplicates
      const userIds = ['user1', 'user2', 'user1', 'user2'];
      
      // Mock calculateEngagementMetrics
      const mockCalculateEngagementMetrics = jest.spyOn(service, 'calculateEngagementMetrics');
      
      const mockMetrics = {
        totalActivities: 1,
        activityByType: { [ActivityType.PAGE_VIEW]: 1 },
        averageDurationSec: 0,
        mostActiveHour: 10,
        mostActiveDay: 1,
        daysSinceLastActivity: 0,
        engagementScore: 50,
      };
      
      mockCalculateEngagementMetrics
        .mockResolvedValueOnce(mockMetrics)
        .mockResolvedValueOnce(mockMetrics);

      // Call method
      await service.bulkProcessUserMetrics(userIds);

      // Assertions - should only be called twice (for unique users)
      expect(mockCalculateEngagementMetrics).toHaveBeenCalledTimes(2);
    });
  });
});
