/**
 * 图片懒加载与骨架屏优化模块
 * 
 * 使用 IntersectionObserver 实现精细的懒加载控制
 * 支持预加载即将进入视口的图片
 * 提供渐进式加载动画效果
 */

export interface LazyLoadOptions {
  /** 根元素（视口容器） */
  root?: Element | null
  /** 根元素的 margin，用于提前触发加载 */
  rootMargin?: string
  /** 触发阈值 */
  threshold?: number | number[]
  /** 是否启用渐进式加载动画 */
  fadeIn?: boolean
  /** 淡入动画时长（ms） */
  fadeInDuration?: number
  /** 占位图 URL */
  placeholderSrc?: string
}

const DEFAULT_OPTIONS: Required<LazyLoadOptions> = {
  root: null,
  rootMargin: '200px 0px', // 提前 200px 开始加载
  threshold: 0.01,
  fadeIn: true,
  fadeInDuration: 300,
  placeholderSrc: '',
}

/**
 * 图片懒加载管理器
 */
export class ImageLazyLoader {
  private observer: IntersectionObserver | null = null
  private options: Required<LazyLoadOptions>
  private loadedImages: Set<string> = new Set()//已加载的图片src集合
  private pendingImages: Map<HTMLImageElement, () => void> = new Map()
  
  constructor(options: LazyLoadOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.initObserver()
  }
  
  /**
   * 初始化 IntersectionObserver
   */
  private initObserver(): void {
    if (typeof IntersectionObserver === 'undefined') {
      // 不支持 IntersectionObserver 时，直接加载所有图片
      console.warn('IntersectionObserver not supported, falling back to eager loading')
      return
    }
    
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement
            this.loadImage(img)
            this.observer?.unobserve(img)
          }
        })
      },
      {
        root: this.options.root,
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold,
      }
    )
  }
  
  /**
   * 加载单张图片
   */
  private loadImage(img: HTMLImageElement): void {
    const src = img.dataset.src || img.src
    if (!src) return
    
    // 已加载过的图片直接显示
    if (this.loadedImages.has(src)) {
      this.showImage(img)
      return
    }
    
    // 创建临时图片预加载
    const tempImg = new Image()
    
    tempImg.onload = () => {
      this.loadedImages.add(src)
      if (img.dataset.src) {
        img.src = img.dataset.src
        delete img.dataset.src
      }
      this.showImage(img)
    }
    
    tempImg.onerror = () => {
      this.showError(img)
    }
    
    tempImg.src = src
  }
  
  /**
   * 显示图片（带淡入动画）
   */
  private showImage(img: HTMLImageElement): void {
    const wrapper = img.closest('.md-img-wrap') as HTMLElement
    const skeleton = wrapper?.querySelector('.md-img-skeleton') as HTMLElement
    
    if (this.options.fadeIn) {
      img.style.opacity = '0'
      img.style.display = 'block'
      img.style.transition = `opacity ${this.options.fadeInDuration}ms ease-in-out`
      
      // 触发重排后开始动画
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          img.style.opacity = '1'
        })
      })
      
      // 动画结束后移除骨架屏
      setTimeout(() => {
        skeleton?.remove()
        img.style.transition = ''
      }, this.options.fadeInDuration)
    } else {
      img.style.display = 'block'
      skeleton?.remove()
    }
    
    // 调用回调
    const callback = this.pendingImages.get(img)
    if (callback) {
      callback()
      this.pendingImages.delete(img)
    }
  }
  
  /**
   * 显示加载错误
   */
  private showError(img: HTMLImageElement): void {
    const wrapper = img.closest('.md-img-wrap') as HTMLElement
    const skeleton = wrapper?.querySelector('.md-img-skeleton') as HTMLElement
    
    if (skeleton) {
      skeleton.textContent = '图片加载失败'
      skeleton.style.display = 'flex'
      skeleton.style.alignItems = 'center'
      skeleton.style.justifyContent = 'center'
      skeleton.style.color = '#999'
      skeleton.style.fontSize = '14px'
    }
    
    img.style.display = 'none'
  }
  
  /**
   * 观察图片元素
   */
  observe(img: HTMLImageElement, onLoad?: () => void): void {
    if (onLoad) {
      this.pendingImages.set(img, onLoad)
    }
    
    // 检查是否已加载
    const src = img.dataset.src || img.src
    if (src && this.loadedImages.has(src)) {
      this.showImage(img)
      return
    }
    
    if (this.observer) {
      this.observer.observe(img)
    } else {
      // 降级：直接加载
      this.loadImage(img)
    }
  }
  
  /**
   * 停止观察图片
   */
  unobserve(img: HTMLImageElement): void {
    this.observer?.unobserve(img)
    this.pendingImages.delete(img)
  }
  
  /**
   * 预加载图片（不显示）
   */
  preload(src: string): Promise<void> {
    if (this.loadedImages.has(src)) {
      return Promise.resolve()
    }
    
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        this.loadedImages.add(src)
        resolve()
      }
      img.onerror = reject
      img.src = src
    })
  }
  
  /**
   * 批量预加载
   */
  preloadAll(srcs: string[]): Promise<void[]> {
    return Promise.all(srcs.map((src) => this.preload(src).catch(() => {})))
  }
  
  /**
   * 销毁
   */
  destroy(): void {
    this.observer?.disconnect()
    this.observer = null
    this.pendingImages.clear()
  }
  
  /**
   * 检查图片是否已加载
   */
  isLoaded(src: string): boolean {
    return this.loadedImages.has(src)
  }
  
  /**
   * 获取已加载图片数量
   */
  get loadedCount(): number {
    return this.loadedImages.size
  }
}

/**
 * 增强预览区域中的图片
 * @param container 预览容器元素
 * @param loader 懒加载管理器
 * @param loadedSrcs 已加载的图片 src 集合（用于跨渲染周期保持状态）
 */
export function enhanceImages(
  container: HTMLElement,
  loader: ImageLazyLoader,
  loadedSrcs: Set<string>
): void {
  const imgs = container.querySelectorAll('img')
  
  imgs.forEach((img) => {
    const i = img as HTMLImageElement
    
    // 已增强过的跳过
    if (i.dataset.enhanced === '1') return
    i.dataset.enhanced = '1'
    
    // 设置加载属性
    i.loading = 'lazy'
    i.decoding = 'async'
    
    const parent = i.parentElement
    if (!parent) return
    
    // 检查是否已有包装器
    if (parent.classList.contains('md-img-wrap')) return
    
    // 创建包装器和骨架屏
    const wrap = document.createElement('span')
    wrap.className = 'md-img-wrap'
    
    const skeleton = document.createElement('span')
    skeleton.className = 'md-img-skeleton'
    
    parent.insertBefore(wrap, i)
    wrap.appendChild(skeleton)
    wrap.appendChild(i)
    
    // 设置初始样式
    i.style.height = '400px'
    i.style.maxWidth = '100%'
    
    const src = i.currentSrc || i.src
    const isAlreadyLoaded = src && (loadedSrcs.has(src) || (i.complete && i.naturalWidth > 0))
    
    if (isAlreadyLoaded) {
      // 已加载：直接显示
      i.style.display = 'block'
      i.style.opacity = '1'
      skeleton.remove()
      if (src) loadedSrcs.add(src)
    } else {
      // 未加载：隐藏图片，显示骨架屏
      i.style.display = 'none'
      i.style.opacity = '0'
      
      // 使用懒加载管理器观察
      loader.observe(i, () => {
        const s = i.currentSrc || i.src
        if (s) loadedSrcs.add(s)
      })
    }
  })
}

/**
 * 创建全局懒加载管理器实例
 */
export function createGlobalImageLoader(root?: Element | null): ImageLazyLoader {
  return new ImageLazyLoader({
    root,
    rootMargin: '300px 0px', // 提前 300px 开始加载
    fadeIn: true,
    fadeInDuration: 250,
  })
}
