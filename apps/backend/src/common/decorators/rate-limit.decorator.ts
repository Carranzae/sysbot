import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

export const SkipRateLimit = () => RateLimit({ limit: 999999, windowMs: 60000 }); // Very high limit

export const StrictRateLimit = () => RateLimit({ limit: 10, windowMs: 60000 }); // 10 requests per minute

export const ModerateRateLimit = () => RateLimit({ limit: 100, windowMs: 60000 }); // 100 requests per minute

export const LenientRateLimit = () => RateLimit({ limit: 1000, windowMs: 60000 }); // 1000 requests per minute
