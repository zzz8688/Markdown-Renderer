/**
  * 文本流平滑输出器
  *
  * 用于将外部不断到达的文本片段，按“速度、加速度、阻尼、最大速度”等参数
  * 平滑地吐出到最终输出，以模拟自然的打字/流式效果。
  *
  * 典型用例：LLM 流式响应、增量渲染等。
  */
 export type SmootherConfig = {
  /** 初速（字符/帧） */
  baseSpeed?: number // 初速（字符/帧）
  /** 最大速度（字符/帧） */
  maxVelocity?: number // 最大速度（字符/帧）
  /** 加速度（每帧速度增量） */
  acceleration?: number // 加速度
  /** 阻尼系数 0-1，越小衰减越快 */
  damping?: number // 阻尼 0-1
 }

 /**
  * 按帧推进的平滑器。通过 `push`/`receiveTailChunk` 输入内容，
  * 每次调用 `tick` 消费一部分到 `output`。
  */
 export class Smoother {
  private queue = '' // 待输出内容
  private output = '' // 已输出内容 tick()返回值

  private velocity = 0
  private maxVelocity: number
  private acceleration: number
  private damping: number
  private baseSpeed: number
  private tailMode = false // 尾包快速模式：按最大速度逐字吐出
  private lastTs = 0 // 上次 tick 的时间戳（ms）
  private carry = 0 // 小数位累积，用于按时间积分发射字符

  /**
   * 创建 Smoother
   * @param cfg 速度相关参数，均可选
   */
  constructor(cfg: SmootherConfig = {}) {
    this.baseSpeed = cfg.baseSpeed ?? 5
    this.maxVelocity = cfg.maxVelocity ?? 20
    this.acceleration = cfg.acceleration ?? 2
    this.damping = cfg.damping ?? 0.85
    this.velocity = this.baseSpeed
    this.lastTs = performance.now()
  }

  /**
   * 重置内部状态（清空队列与输出，恢复到初速）
   */
  reset() {
    this.queue = ''
    this.output = ''
    this.velocity = this.baseSpeed
    this.lastTs = performance.now()
    this.carry = 0
  }

  /**
   * 追加待输出内容（常规追加，不改变速度）
   */
  push(text: string) {
    if (!text) return
    this.queue += text
  }

  /**
   * 接收“结尾块”（例如流式最后一段），并进行极限加速，
   * 促使下一帧几乎全部吐出，缩短尾端等待时间。
   */
  receiveTailChunk(text: string) {
    if (text) this.queue += text
    // 进入尾包模式：后续以最大速度逐字吐出
    this.tailMode = true
    this.velocity = this.maxVelocity
  }

  /**
   * 立即吐出全部剩余内容
   * @returns 当前完整输出
   */
  flushAll(): string {
    if (this.queue.length) {
      this.output += this.queue
      this.queue = ''
    }
    return this.output
  }

  /**
   * 运行时动态调整速度参数
   */
  setSpeed(cfg: Partial<SmootherConfig>) {
    if (cfg.baseSpeed != null) this.baseSpeed = cfg.baseSpeed
    if (cfg.maxVelocity != null) this.maxVelocity = cfg.maxVelocity
    if (cfg.acceleration != null) this.acceleration = cfg.acceleration
    if (cfg.damping != null) this.damping = cfg.damping
    // 约束当前速度在新参数范围附近
    this.velocity = Math.min(Math.max(this.velocity, this.baseSpeed), this.maxVelocity)
  }

  /**
   * 推进一步：根据当前速度消费若干字符进入输出。
   * 无队列时速度缓慢回落至初速，以保证“平稳感”。
   * @returns 当前完整输出
   */
  tick(): string {
    const now = performance.now()
    const dtSec = Math.max(0, (now - this.lastTs) / 1000)
    this.lastTs = now

    // 当队列为空：退出尾包模式；速度以阻尼逐步回落到 baseSpeed（时间归一）
    if (!this.queue.length) {
      if (this.tailMode) this.tailMode = false
      // 将阻尼按每秒归一，等效：v *= damping^(dt * fpsRef)
      const fpsRef = 60
      const dampingPow = Math.pow(this.damping, dtSec * fpsRef)
      this.velocity = Math.max(this.baseSpeed, this.velocity * dampingPow)
      return this.output
    }

    if (this.tailMode) {
      // 尾包模式：以最大速度按时间推进（允许每帧 0 字）
      const emitNeed = this.maxVelocity * dtSec + this.carry
      const count = Math.floor(emitNeed)
      this.carry = emitNeed - count
      if (count > 0) {
        const chunk = this.queue.slice(0, count)
        this.queue = this.queue.slice(count)
        this.output += chunk
      }
      this.velocity = this.maxVelocity
      return this.output
    }

    // 常规模式：时间积分的速度更新
    const fpsRef = 60
    const dampingPow = Math.pow(this.damping, dtSec * fpsRef)
    // 先阻尼再加速（或反之差异不大），并限制最大速度
    const vAfterDamping = this.velocity * dampingPow
    const vAfterAccel = vAfterDamping + this.acceleration * dtSec
    this.velocity = Math.min(Math.max(vAfterAccel, this.baseSpeed), this.maxVelocity)

    const emitNeed = this.velocity * dtSec + this.carry
    const count = Math.floor(emitNeed)
    this.carry = emitNeed - count
    if (count > 0) {
      const chunk = this.queue.slice(0, count)
      this.queue = this.queue.slice(count)
      this.output += chunk
    }
    return this.output
  }

  /**
   * 当前内部状态快照，便于调试与可视化
   */
  get state() {
    return {
      outputLength: this.output.length,
      queueLength: this.queue.length,
      velocity: this.velocity,
    }
  }
}
