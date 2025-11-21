export type SmootherConfig = {
  baseSpeed?: number // 初速（字符/帧）
  maxVelocity?: number // 最大速度（字符/帧）
  acceleration?: number // 加速度
  damping?: number // 阻尼 0-1
}

export class Smoother {
  private queue = '' // 待输出内容
  private output = '' // 已输出内容

  private velocity = 0
  private maxVelocity: number
  private acceleration: number
  private damping: number
  private baseSpeed: number

  constructor(cfg: SmootherConfig = {}) {
    this.baseSpeed = cfg.baseSpeed ?? 5
    this.maxVelocity = cfg.maxVelocity ?? 20
    this.acceleration = cfg.acceleration ?? 2
    this.damping = cfg.damping ?? 0.85
    this.velocity = this.baseSpeed
  }

  reset() {
    this.queue = ''
    this.output = ''
    this.velocity = this.baseSpeed
  }

  push(text: string) {
    if (!text) return
    this.queue += text
  }

  receiveTailChunk(text: string) {
    if (text) this.queue += text
    // 极限加速，下一帧基本吐光
    this.velocity = this.maxVelocity * 999
  }

  flushAll(): string {
    if (this.queue.length) {
      this.output += this.queue
      this.queue = ''
    }
    return this.output
  }

  setSpeed(cfg: Partial<SmootherConfig>) {
    if (cfg.baseSpeed != null) this.baseSpeed = cfg.baseSpeed
    if (cfg.maxVelocity != null) this.maxVelocity = cfg.maxVelocity
    if (cfg.acceleration != null) this.acceleration = cfg.acceleration
    if (cfg.damping != null) this.damping = cfg.damping
  }

  tick(): string {
    if (!this.queue.length) {
      // 没有字，回落至初速以保持平稳感
      this.velocity = Math.max(this.velocity * this.damping, this.baseSpeed)
      return this.output
    }

    // 加速度 + 阻尼，限制最大速度
    this.velocity = Math.min(
      this.velocity * this.damping + this.acceleration,
      this.maxVelocity
    )

    const count = Math.max(1, Math.floor(this.velocity))
    const chunk = this.queue.slice(0, count)
    this.queue = this.queue.slice(count)
    this.output += chunk
    return this.output
  }

  get state() {
    return {
      outputLength: this.output.length,
      queueLength: this.queue.length,
      velocity: this.velocity,
    }
  }
}
