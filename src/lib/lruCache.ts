/**
 * LRU (Least Recently Used) 缓存实现
 * 
 * 用于缓存 Markdown 渲染结果，避免重复解析相同内容
 * 采用 Map 的插入顺序特性实现 LRU 淘汰策略
 */

export class LRUCache<K, V> {
  private cache: Map<K, V>
  private readonly maxSize: number

  constructor(maxSize: number = 100) {
    this.cache = new Map()
    this.maxSize = maxSize
  }

  /**
   * 获取缓存值，命中时会将该项移动到最近使用位置
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined
    }
    // 命中：删除后重新插入，移动到 Map 末尾（最近使用）
    const value = this.cache.get(key)!
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  /**
   * 设置缓存值，超出容量时淘汰最久未使用的项
   */
  set(key: K, value: V): void {
    // 如果 key 已存在，先删除旧项
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // 淘汰最久未使用的项（Map 的第一个元素）
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
      }
    }
    this.cache.set(key, value)
  }

  /**
   * 检查是否存在缓存
   */
  has(key: K): boolean {
    return this.cache.has(key)
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * 获取当前缓存大小
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * 获取缓存统计信息
   */
  get stats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    }
  }
}

/**
 * 简单的哈希函数，用于生成缓存 key
 * 使用 FNV-1a 算法，速度快且分布均匀
 */
export function hashString(str: string): string {
  let hash = 2166136261 // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = (hash * 16777619) >>> 0 // FNV prime, 保持为无符号 32 位整数
  }
  return hash.toString(36)
}

// 全局渲染缓存实例
export const renderCache = new LRUCache<string, string>(200)

// 缓存命中统计（用于性能监控）
export const cacheStats = {
  hits: 0,
  misses: 0,
  get hitRate(): number {
    const total = this.hits + this.misses
    return total === 0 ? 0 : this.hits / total
  },
  reset(): void {
    this.hits = 0
    this.misses = 0
  },
}
