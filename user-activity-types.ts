// src/types/UserActivity.ts

/**
 * Enum representing different types of user activities
 */
export enum ActivityType {
  PAGE_VIEW = 'PAGE_VIEW',
  CLICK = 'CLICK',
  SCROLL = 'SCROLL',
  FORM_SUBMISSION = 'FORM_SUBMISSION',
  VIDEO_PLAY = 'VIDEO_PLAY',
  VIDEO_PAUSE = 'VIDEO_PAUSE',
  VIDEO_COMPLETE = 'VIDEO_COMPLETE',
  DOWNLOAD = 'DOWNLOAD',
  SHARE = 'SHARE',
  COMMENT = 'COMMENT',
}

/**
 * Interface representing a single user activity
 */
export interface UserActivity {
  /** Unique identifier for the activity */
  id: string;
  /** User identifier */
  userId: string;
  /** Type of activity */
  type: ActivityType;
  /** Timestamp when the activity occurred */
  timestamp: string;
  /** Path or location where the activity occurred */
  path: string;
  /** Device information */
  device?: string;
  /** Duration of the activity in seconds (if applicable) */
  durationSec?: number;
  /** Additional metadata about the activity */
  metadata?: Record<string, any>;
}

/**
 * Interface for filtering user activities
 */
export interface UserActivityFilter {
  /** Start date for filtering activities (ISO string) */
  startDate?: string;
  /** End date for filtering activities (ISO string) */
  endDate?: string;
  /** Filter by activity type */
  type?: ActivityType;
  /** Filter by path */
  path?: string;
  /** Maximum number of results to return */
  limit?: number;
}

/**
 * Interface representing calculated engagement metrics
 */
export interface EngagementMetrics {
  /** Total number of activities */
  totalActivities: number;
  /** Activity count broken down by type */
  activityByType: Partial<Record<ActivityType, number>>;
  /** Average duration of activities in seconds */
  averageDurationSec: number;
  /** Hour of day with most activity (0-23) */
  mostActiveHour: number;
  /** Day of week with most activity (0-6, Sunday-Saturday) */
  mostActiveDay: number;
  /** Number of days since last activity */
  daysSinceLastActivity: number;
  /** Calculated engagement score (0-100) */
  engagementScore: number;
}

/**
 * Configuration for API calls
 */
export interface ApiConfig {
  /** Base URL path for API */
  basePath: string;
  /** API request timeout in milliseconds */
  timeoutMs: number;
  /** API key (if required) */
  apiKey?: string;
}

/**
 * Configuration for caching
 */
export interface CacheConfig {
  /** TTL for activity data in seconds */
  activityTtlSec: number;
  /** TTL for metrics data in seconds */
  metricsTtlSec: number;
}
