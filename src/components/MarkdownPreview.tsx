// components/MarkdownPreview.tsx
import { useState, useEffect, useRef } from 'react';
// 引入markdown转HTML工具函数
import { markdownToHtml } from '../utils/markdownToHtml';
// 引入流式文本Hook
import { useStreamingText } from '../hooks/useStreamingText';

// 组件属性类型定义
interface MarkdownPreviewProps {
    rawMarkdown: string; // 外部传入的原始Markdown文本
    // 可选的渲染配置
    config?: {
        // 初始渲染速度配置
        initialSpeed?: 'slow' | 'medium' | 'fast';
        // 最大渲染速度配置
        maxSpeed?: 'medium' | 'fast' | 'veryFast';
        // 是否显示状态指示器
        showStatus?: boolean;
        // 是否开启语法修复功能
        enableSyntaxFix?: boolean;
    };
}

/**
 * Markdown流式预览组件
 * 实现平滑的逐字流式渲染，支持尾包加速和动态配置
 */
export const MarkdownPreview = ({ 
    rawMarkdown, 
    config = {} 
}: MarkdownPreviewProps) => {
    // 解构配置项，设置默认值 - 使用最慢的渲染速度
    const { 
        initialSpeed = 'slow', // 已经是最慢的选项
        maxSpeed = 'medium',   // 保持中等最大速度
        showStatus = true,
        enableSyntaxFix = true // 默认开启语法修复
    } = config;

    // 根据速度配置计算弹簧参数 - 使用适中的渲染速度，确保有明显的流式效果
    const getSpeedConfig = () => {
        // 初始速度参数映射
        const initialSpeedMap = {
            slow: { k: 0.005, damping: 0.5, mass: 3.0 },     // 慢速
            medium: { k: 0.01, damping: 0.4, mass: 2.0 },   // 中速
            fast: { k: 0.02, damping: 0.3, mass: 1.5 }      // 快速
        };
        
        // 最大速度参数映射
        const maxSpeedMap = {
            medium: { k: 0.2, damping: 0.3, mass: 1.5, minVelocity: 1 },
            fast: { k: 0.4, damping: 0.2, mass: 1.0, minVelocity: 2 },
            veryFast: { k: 0.6, damping: 0.15, mass: 0.8, minVelocity: 3 }
        };
        
        const initial = initialSpeedMap[initialSpeed];
        const max = maxSpeedMap[maxSpeed];
        
        return {
            initialSpringK: initial.k,
            initialDamping: initial.damping,
            initialMass: initial.mass,
            tailSpringK: max.k,
            tailDamping: max.damping,
            tailMass: max.mass,
            tailThreshold: 20,
            minTailVelocity: max.minVelocity
        };
    };

    // 1. 调用Hook获取流式文本和状态，传入速度配置
    const { currentText, isComplete, isTail } = useStreamingText(
        rawMarkdown, 
        getSpeedConfig()
    );

    // 2. 存储转换后的HTML
    const [renderedHtml, setRenderedHtml] = useState('');
    // 防抖引用，避免过于频繁的转换
    const convertTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 3. 优化的Markdown转HTML逻辑
    useEffect(() => {
        // 清除之前的定时器
        if (convertTimeoutRef.current) {
            clearTimeout(convertTimeoutRef.current);
        }

        // 空文本直接返回
        if (!currentText) {
            setRenderedHtml('');
            return;
        }

        // 根据用户要求的逻辑：
        // 1. 判断输入是否完整
        // 2. 如果不完整：
        //    - 如果启用了语法修复：修复后直接全部立即渲染
        //    - 如果未启用语法修复：当前输入的全部内容都需要缓慢流式渲染
        
        // 检查输入是否完整（通过isComplete标志）
        const isInputComplete = isComplete;
        
        // 决定是否应用语法修复
        const shouldApplyFix = enableSyntaxFix;
        
        // 根据逻辑决定渲染延迟
        let delay = 0;
        if (!isInputComplete) {
            if (!shouldApplyFix) {
                // 不完整且未启用语法修复：使用流式渲染，设置适当延迟确保逐字效果
                delay = 30; // 适中的延迟以确保明显的流式效果
            }
            // 不完整但启用语法修复：delay保持0，立即渲染
        } else {
            // 输入完整：立即渲染
            delay = 0;
        }
        
        convertTimeoutRef.current = setTimeout(async () => {
            try {
                // 根据配置应用语法修复
                const html = await markdownToHtml(currentText, { enableSyntaxFix: shouldApplyFix });
                setRenderedHtml(html);
            } catch (error) {
                console.error('Markdown转换失败：', error);
                setRenderedHtml('<p style="color: red;">Markdown解析出错</p>');
            }
        }, delay);

        // 清理定时器
        return () => {
            if (convertTimeoutRef.current) {
                clearTimeout(convertTimeoutRef.current);
            }
        };
    }, [currentText, isComplete, enableSyntaxFix]); // 依赖项完整

    // 4. 获取状态文本
    const getStatusText = () => {
        if (isComplete) return '（渲染完成）';
        if (isTail) return '（快速渲染中）';
        return '（平滑渲染中）';
    };

    return (
        <div className="markdown-preview-container">
            {showStatus && (
                <h2 className="preview-title">
                    流式预览 {getStatusText()}
                </h2>
            )}
            {/* 核心：渲染转换后的HTML */}
            <div
                className={`preview-content ${
                    isTail ? 'tail-mode' : 
                    isComplete ? 'complete-mode' : 'streaming-mode'
                }`}
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
        </div>
    );
};

// 导出默认组件
export default MarkdownPreview;