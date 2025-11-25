// hooks/useStreamingText.ts
import { useState, useRef, useEffect, useCallback } from 'react';

interface UseStreamingTextOptions {
    // 初始速度调节参数（弹簧系数）
    initialSpringK?: number;
    // 初始阻尼系数
    initialDamping?: number;
    // 初始质量
    initialMass?: number;
    // 尾包加速参数
    tailSpringK?: number;
    tailDamping?: number;
    tailMass?: number;
    // 尾包最小速度
    minTailVelocity?: number;
    // 尾包检测敏感度
    tailDetectionSensitivity?: number;
}

/**
 * 检测文档结构的完整性
 * 判断当前文本是否可能包含未闭合的Markdown结构
 */
const isStructureComplete = (text: string): boolean => {
    // 检查代码块是否未闭合
    const codeBlocks = text.match(/```/g);
    if (codeBlocks && codeBlocks.length % 2 !== 0) {
        return false;
    }

    // 检查数学公式是否未闭合 - 区分 $$ 和 $
    // 处理 $$ 公式块
    const mathBlocks = text.match(/\$\$/g);
    if (mathBlocks && mathBlocks.length % 2 !== 0) {
        return false;
    }
    
    // 处理 $ 行内公式
    // 需要考虑转义的 $ 符号，但这里简化处理，只检查非转义的 $
    const inlineMath = text.match(/(?<!\\)\$/g);
    if (inlineMath && inlineMath.length % 2 !== 0) {
        return false;
    }

    // 检查列表项是否在最后且可能未完成
    const lines = text.split('\n');
    if (lines.length > 0) {
        const lastLine = lines[lines.length - 1].trim();
        // 如果最后一行是列表项标记但没有内容，认为结构不完整
        if (/^[-*+]\s*$/.test(lastLine)) {
            return false;
        }
    }

    // 检查引用块是否在最后且可能未完成
    if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        if (/^>\s*$/.test(lastLine)) {
            return false;
        }
    }
    
    // 检查callout指令是否未闭合
    const calloutStarts = text.match(/:::callout/g);
    const calloutEnds = text.match(/:::/g);
    const calloutStartCount = calloutStarts ? calloutStarts.length : 0;
    const calloutEndCount = calloutEnds ? calloutEnds.length : 0;
    if (calloutStartCount > calloutEndCount) {
        return false;
    }

    // 默认认为结构完整
    return true;
};

/**
 * 平滑流式文本渲染Hook
 * 实现弹簧物理模型的平滑逐字输出，支持智能尾包检测
 */
export const useStreamingText = (rawMarkdown: string, options?: UseStreamingTextOptions) => {
    // 状态管理
    const [currentText, setCurrentText] = useState('');
    const [isComplete, setIsComplete] = useState(false);
    const [isTail, setIsTail] = useState(false);

    // 默认选项 - 适中的初始渲染速度，确保有明显的流式效果
    const defaultOptions: Required<UseStreamingTextOptions> = {
        initialSpringK: 0.01,     // 弹簧系数适中
        initialDamping: 0.4,      // 阻尼适中
        initialMass: 2.0,         // 质量适中
        tailSpringK: 0.3,         // 尾包弹簧系数
        tailDamping: 0.2,         // 尾包阻尼
        tailMass: 1.0,            // 尾包质量
        minTailVelocity: 1,       // 尾包最小速度
        tailDetectionSensitivity: 0.8
    };

    const mergedOptions = { ...defaultOptions, ...options };

    // 存储状态的引用，避免循环依赖
    const isCompleteRef = useRef(isComplete);
    const isTailRef = useRef(isTail);
    const optionsRef = useRef(mergedOptions);
    const markdownRef = useRef(rawMarkdown);
    
    // 存储前一个文本状态用于比较
    const previousTextRef = useRef('');
    const structureCompleteRef = useRef(false);
    const hasDetectedTailRef = useRef(false);

    // 更新引用值
    useEffect(() => {
        isCompleteRef.current = isComplete;
    }, [isComplete]);

    useEffect(() => {
        isTailRef.current = isTail;
    }, [isTail]);

    useEffect(() => {
        optionsRef.current = mergedOptions;
    }, [mergedOptions]);

    useEffect(() => {
        // 当接收到新的完整文本时，检查是否包含尾包特征
        const previousLength = markdownRef.current.length;
        const newLength = rawMarkdown.length;
        
        // 更新引用
        markdownRef.current = rawMarkdown;
        
        // 如果文本长度显著增加，可能是接收到了新的数据
        if (newLength > previousLength && previousLength > 0) {
            // 检查是否从不完整结构变为完整结构
            const wasComplete = structureCompleteRef.current;
            const isNowComplete = isStructureComplete(rawMarkdown);
            structureCompleteRef.current = isNowComplete;
            
            // 如果之前结构不完整，现在完整了，可能是收到了尾包
            if (!wasComplete && isNowComplete) {
                // 标记为已检测到尾包，但在下一次更新时应用加速
                hasDetectedTailRef.current = true;
            }
        }
    }, [rawMarkdown]);

    // 弹簧系统参数引用
    const springRef = useRef({
        k: mergedOptions.initialSpringK,
        damping: mergedOptions.initialDamping,
        mass: mergedOptions.initialMass,
        target: rawMarkdown.length,
        position: 0,
        velocity: 0,
        animationFrame: null as number | null,
        isProcessing: false,
        hasStarted: false
    });

    // 动画帧更新函数 - 不依赖React状态，避免循环依赖
    const animate = useCallback(() => {
        if (!springRef.current.isProcessing) return;
        
        const options = optionsRef.current;
        const { k, damping, mass, target, position, velocity } = springRef.current;
        
        // 计算弹簧力和阻尼力
        const force = -k * (position - target) - damping * velocity;
        const acceleration = force / mass;
        
        // 更新速度和位置
        springRef.current.velocity = velocity + acceleration;
        springRef.current.position = position + springRef.current.velocity;

        // 边界检查和完成状态设置
        let shouldComplete = false;
        if (springRef.current.position >= target) {
            springRef.current.position = target;
            springRef.current.velocity = 0;
            shouldComplete = true;
        } else if (springRef.current.position < 0) {
            springRef.current.position = 0;
            springRef.current.velocity = 0;
        }

        // 更新当前显示的文本
        const currentPos = Math.floor(springRef.current.position);
        const newText = markdownRef.current.slice(0, currentPos);
        
        // 只有当文本发生变化时才更新
        if (newText !== previousTextRef.current) {
            setCurrentText(newText);
            previousTextRef.current = newText;
        }

        // 检查是否检测到尾包
        if (!isTailRef.current && hasDetectedTailRef.current) {
            setIsTail(true);
            isTailRef.current = true;
            // 更新弹簧参数以加速
            springRef.current.k = options.tailSpringK;
            springRef.current.damping = options.tailDamping;
            springRef.current.mass = options.tailMass;
            hasDetectedTailRef.current = false;
        }

        // 尾包特殊处理：确保最小速度
        if (isTailRef.current) {
            springRef.current.velocity = Math.max(springRef.current.velocity, options.minTailVelocity);
        }

        // 继续动画或终止
        if (!shouldComplete) {
            springRef.current.animationFrame = requestAnimationFrame(animate);
        } else {
            setIsComplete(true);
            springRef.current.isProcessing = false;
            // 确保显示完整文本
            setCurrentText(markdownRef.current);
            // 清理动画帧
            if (springRef.current.animationFrame) {
                cancelAnimationFrame(springRef.current.animationFrame);
            }
        }
    }, []); // 空依赖数组，避免函数重新创建

    // 初始化和重置逻辑
    useEffect(() => {
        // 终止之前的处理
        springRef.current.isProcessing = false;
        if (springRef.current.animationFrame) {
            cancelAnimationFrame(springRef.current.animationFrame);
            springRef.current.animationFrame = null;
        }

        // 重置状态
        setCurrentText('');
        setIsComplete(false);
        setIsTail(false);
        
        // 重置引用
        isCompleteRef.current = false;
        isTailRef.current = false;
        previousTextRef.current = '';
        hasDetectedTailRef.current = false;
        structureCompleteRef.current = isStructureComplete(rawMarkdown);
        
        // 如果文本为空，直接完成
        if (!rawMarkdown) {
            setIsComplete(true);
            return;
        }
        
        // 重置弹簧系统
        springRef.current = {
            k: mergedOptions.initialSpringK,
            damping: mergedOptions.initialDamping,
            mass: mergedOptions.initialMass,
            target: rawMarkdown.length,
            position: 0,
            velocity: 0,
            animationFrame: null,
            isProcessing: true,
            hasStarted: true
        };

        // 启动新的动画
        springRef.current.animationFrame = requestAnimationFrame(animate);

        // 组件卸载时清理
        return () => {
            springRef.current.isProcessing = false;
            if (springRef.current.animationFrame) {
                cancelAnimationFrame(springRef.current.animationFrame);
            }
        };
    }, [rawMarkdown, mergedOptions.initialSpringK, mergedOptions.initialDamping, mergedOptions.initialMass]); // animate不再是依赖项

    return { 
        currentText, 
        isComplete, 
        isTail,
        // 暴露控制方法，便于外部操作
        reset: useCallback(() => {
            setCurrentText('');
            setIsComplete(false);
            setIsTail(false);
            isCompleteRef.current = false;
            isTailRef.current = false;
            previousTextRef.current = '';
            hasDetectedTailRef.current = false;
        }, [])
    };
};