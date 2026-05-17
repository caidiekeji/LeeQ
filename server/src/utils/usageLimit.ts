import pool from '../config/database';

const ipUsageCache = new Map<string, { count: number; resetTime: number }>();
const FREE_LIMIT = 5;

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipUsageCache.entries()) {
    if (now > record.resetTime) ipUsageCache.delete(ip);
  }
}, 3600000);

export async function checkUsageLimit(ip: string, userId?: number): Promise<{ canUse: boolean; remaining: number; isLoggedIn: boolean; used: number }> {
  if (userId) return { canUse: true, remaining: Infinity, isLoggedIn: true, used: 0 };
  const now = Date.now();
  let record = ipUsageCache.get(ip);
  if (!record || now > record.resetTime) { record = { count: 0, resetTime: now + 86400000 }; ipUsageCache.set(ip, record); }
  const remaining = FREE_LIMIT - record.count;
  return { canUse: remaining > 0, remaining, isLoggedIn: false, used: record.count };
}

export async function recordUsage(ip: string, userId?: number): Promise<void> {
  if (userId) return;
  const record = ipUsageCache.get(ip);
  if (record) { record.count += 1; } else { ipUsageCache.set(ip, { count: 1, resetTime: Date.now() + 86400000 }); }
}