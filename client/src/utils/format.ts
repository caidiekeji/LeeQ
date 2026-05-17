/**
 * 共享格式化工具函数
 */

/**
 * 格式化日期为中文本地时间字符串
 * @param d 日期字符串或时间戳
 * @returns 格式化后的字符串
 */
export function formatDate(d: string | number | undefined | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleString('zh-CN');
}

/**
 * 截断字符串，超出长度追加省略号
 * @param s 原始字符串
 * @param len 最大长度
 * @returns 截断后的字符串
 */
export function truncate(s: string | undefined | null, len: number): string {
  if (!s) return '-';
  return s.length > len ? s.substring(0, len) + '...' : s;
}

/**
 * 格式化数字为千分位
 * @param n 数字
 * @returns 格式化后的字符串
 */
export function formatNum(n: number | undefined | null): string {
  return n ? n.toLocaleString() : '0';
}