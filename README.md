# User Activity Service

A TypeScript service for fetching and processing user activity data to calculate engagement metrics.

## Features

- Fetch user activity data from REST API
- Process data to calculate engagement metrics
- Cache results to minimize API calls
- Comprehensive error handling with logging
- Support for bulk processing of multiple users
- Cache invalidation for data freshness

## Installation

```bash
npm install
```

## Dependencies

- Node.js 14+
- TypeScript 4.5+
- Axios for HTTP requests
- Redis for caching
- Winston for logging

## Usage

### Basic Usage

```typescript
import { createUserActivityService } from './services/UserActivityServiceFactory';

// Create the service with default configuration
const userActivityService = createUserActivityService();

// Get user activity
const activities = await userActivityService.getUserActivity('user123');

// Calculate engagement metrics
const metrics = await userActivityService.calculateEngagementMetrics('user123');

console.log('User engagement score:', metrics.engagementScore);
```

### Custom Configuration

```typescript
import { createUserActivityService } from './services/UserActivityServiceFactory';

// Custom API config
const apiConfig = {
  basePath: 'https://api.yourdomain.com/v2',
  timeoutMs: 10000,
  apiKey: 'your-api-key',
};

// Custom cache config
const cacheConfig = {
  activityTtlSec: 120, // 2 minutes
  metricsTtlSec: 600,  // 10 minutes
};

// Create with custom configuration
const userActivityService = createUserActivityService(apiConfig, cacheConfig);
```

### Activity Filtering

```typescript
import { ActivityType } from './types/UserActivity';

// Filter activities by various criteria
const activities = await userActivityService.getUserActivity('user123', {
  startDate: '2023-01-01T00:00:00Z',
  endDate: '2023-01-31T23:59:59Z',
  type: ActivityType.PAGE_VIEW,
  path: '/products',
  limit: 100,
});
```

### Bulk Processing

```typescript
// Process metrics for multiple users at once
const userIds = ['user1', 'user2', 'user3'];
const metricsMap = await userActivityService.bulkProcessUserMetrics(userIds, 30);

// Process the results
metricsMap.forEach((metrics, userId) => {
  console.log(`User ${userId} engagement score: ${metrics.engagementScore}`);
});
```

### Cache Invalidation

```typescript
// Invalidate cache for a specific user
await userActivityService.invalidateUserCache('user123');
```

## API Reference

### UserActivityService

#### `getUserActivity(userId: string, filter?: UserActivityFilter): Promise<UserActivity[]>`

Fetches user activity data from the API or cache.

- `userId`: The ID of the user to fetch activity for
- `filter`: Optional filters to apply to the activity data
- Returns: Promise resolving to an array of user activities

#### `calculateEngagementMetrics(userId: string, timeRangeInDays?: number): Promise<EngagementMetrics>`

Calculates engagement metrics for a user based on their activity data.

- `userId`: The ID of the user to calculate metrics for
- `timeRangeInDays`: Optional time range in days to limit the activity data
- Returns: Promise resolving to engagement metrics

#### `invalidateUserCache(userId: string): Promise<void>`

Invalidates cached data for a specific user.

- `userId`: The ID of the user to invalidate cache for
- Returns: Promise resolving when cache is invalidated

#### `bulkProcessUserMetrics(userIds: string[], timeRangeInDays?: number): Promise<Map<string, EngagementMetrics>>`

Bulks process activities for multiple users.

- `userIds`: Array of user IDs to process
- `timeRangeInDays`: Optional time range in days
- Returns: Promise resolving to a map of user IDs to their engagement metrics

### Types

#### UserActivity

```typescript
interface UserActivity {
  id: string;
  userId: string;
  type: ActivityType;
  timestamp: string;
  path: string;
  device?: string;
  durationSec?: number;
  metadata?: Record<string, any>;
}
```

#### ActivityType

```typescript
enum ActivityType {
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
```

#### UserActivityFilter

```typescript
interface UserActivityFilter {
  startDate?: string;
  endDate?: string;
  type?: ActivityType;
  path?: string;
  limit?: number;
}
```

#### EngagementMetrics

```typescript
interface EngagementMetrics {
  totalActivities: number;
  activityByType: Partial<Record<ActivityType, number>>;
  averageDurationSec: number;
  mostActiveHour: number;
  mostActiveDay: number;
  daysSinceLastActivity: number;
  engagementScore: number;
}
```

## Configuration

The service can be configured through environment variables:

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `USER_ACTIVITY_API_URL` | Base URL for the activity API | `https://api.example.com/v1` |
| `API_TIMEOUT_MS` | API request timeout in milliseconds | `5000` |
| `USER_ACTIVITY_API_KEY` | API key for authentication | |
| `ACTIVITY_CACHE_TTL_SEC` | TTL for activity data in seconds | `300` (5 minutes) |
| `METRICS_CACHE_TTL_SEC` | TTL for metrics data in seconds | `1800` (30 minutes) |
| `REDIS_HOST` | Redis server hostname | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_PASSWORD` | Redis server password | |
| `REDIS_DB` | Redis database number | `0` |
| `LOG_LEVEL` | Winston logger level | `info` |

## Testing

The service includes comprehensive unit tests using Jest:

```bash
npm test
```

## Architecture

The service follows SOLID principles and functional programming patterns:

- **Single Responsibility**: Each class and function has a single responsibility
- **Open/Closed**: The service is open for extension but closed for modification
- **Liskov Substitution**: Interfaces are used for dependencies to allow substitution
- **Interface Segregation**: Small, focused interfaces are used
- **Dependency Inversion**: Dependencies are injected and configurable

## Error Handling

The service implements robust error handling:

- Graceful handling of API failures
- Fallback to API when cache operations fail
- Comprehensive error logging with context
- Propagation of errors with clear messages
- Fault tolerance in bulk operations

## Performance Considerations

- Efficient caching strategy to minimize API calls
- Cache key generation optimized for different filter combinations
- Bulk processing capability for multiple users
- Proper handling of cache invalidation for data freshness

## Contributors

Your Name <your.email@example.com>
