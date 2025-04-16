// src/services/UserActivityServiceFactory.ts

import axios, { AxiosInstance } from 'axios';
import Redis from 'ioredis';
import winston from 'winston';
import { UserActivityService } from './UserActivityService';
import { ApiConfig, CacheConfig } from '../types/UserActivity';

/**
 * Default API configuration
 */
const DEFAULT_API_CONFIG: ApiConfig = {
  basePath: process.env.USER_ACTIVITY_API_URL || 'https://api.example.com/v1',
  timeoutMs: parseInt(process.env.API_TIMEOUT_MS || '5000', 10),
  apiKey: process.env.USER_ACTIVITY_API_KEY,
};

/**
 * Default cache configuration
 */
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  activityTtlSec: parseInt(process.env.ACTIVITY_CACHE_TTL_SEC || '300', 10), // 5 minutes
  metricsTtlSec: parseInt(process.env.METRICS_CACHE_TTL_SEC || '1800', 10), // 30 minutes
};

/**
 * Factory function to create a configured UserActivityService instance
 * 
 * @param customApiConfig - Optional custom API configuration to override defaults
 * @param customCacheConfig - Optional custom cache configuration to override defaults
 * @param customHttpClient - Optional custom Axios instance
 * @param customCacheClient - Optional custom Redis client
 * @param customLogger - Optional custom Winston logger
 * @returns Configured UserActivityService instance
 */
export function createUserActivityService(
  customApiConfig?: Partial<ApiConfig>,
  customCacheConfig?: Partial<CacheConfig>,
  customHttpClient?: AxiosInstance,
  customCacheClient?: Redis,
  customLogger?: winston.Logger,
): UserActivityService {
  // Merge configs with defaults
  const apiConfig: ApiConfig = {
    ...DEFAULT_API_CONFIG,
    ...customApiConfig,
  };
  
  const cacheConfig: CacheConfig = {
    ...DEFAULT_CACHE_CONFIG,
    ...customCacheConfig,
  };

  // Create or use HTTP client
  const httpClient = customHttpClient || axios.create({
    baseURL: apiConfig.basePath,
    timeout: apiConfig.timeoutMs,
    headers: apiConfig.apiKey ? { 'X-API-Key': apiConfig.apiKey } : undefined,
  });

  // Create or use Redis client
  const redisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    // Enable reconnection
    retryStrategy: (times: number) => {
      // Maximum retry time is 30 seconds
      const maxRetryMs = 30 * 1000;
      // Exponential backoff with jitter
      const delay = Math.min(
        maxRetryMs,
        Math.floor(Math.random() * 100 + Math.pow(2, times) * 50)
      );
      return delay;
    },
  };
  
  const cacheClient = customCacheClient || new Redis(redisOptions);

  // Create or use logger
  const logger = customLogger || winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    defaultMeta: { service: 'user-activity-service' },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
        ),
      }),
    ],
  });

  // Create and return service instance
  return new UserActivityService(
    httpClient,
    cacheClient,
    logger,
    apiConfig,
    cacheConfig,
  );
}
