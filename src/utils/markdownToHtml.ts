// import { unified } from 'unified';
// import type { Plugin } from 'unified';
// import remarkParse from 'remark-parse';
// import remarkGfm from 'remark-gfm';
// import remarkMath from 'remark-math';
// import remarkDirective from 'remark-directive'; // 核心指令解析插件
// import remarkRehype from 'remark-rehype';
// import rehypeKatex from 'rehype-katex';
// import rehypeStringify from 'rehype-stringify';
// import { visit } from 'unist-util-visit';
// import 'katex/dist/katex.min.css';
//
//
// // 修复后的扩展指令处理插件（基于标准AST节点）
// // const remarkDirectiveHandler: Plugin = () => {
// //     return (tree: any) => {
// //         // 1. 处理**行内指令**：:badge[内容]{type=success} （remark-directive标准语法）
// //         visit(tree, ['textDirective'], (node) => {
// //             // 仅处理badge指令
// //             if (node.name !== 'badge') return;
// //
// //             // 步骤1：获取指令的内容（从children中提取）
// //             const badgeContent = node.children?.[0]?.value || '默认徽章';
// //             // 步骤2：获取指令的属性（从node.attributes或手动解析参数）
// //             // 兼容两种写法：{type=success} 或 [type=success]
// //             let type = 'success'; // 默认类型
// //             // 方式1：解析标准指令属性（{type=xxx}）
// //             if (node.attributes?.type) {
// //                 type = node.attributes.type;
// //             }
// //             // 方式2：兼容[内容][type=xxx]的自定义写法（提取children中的参数）
// //             else if (node.children?.[0]?.value) {
// //                 const content = node.children[0].value;
// //                 const typeMatch = content.match(/\[type=(\w+)\]/);
// //                 if (typeMatch) {
// //                     type = typeMatch[1];
// //                     // 移除内容中的[type=xxx]，只保留纯文本
// //                     node.children[0].value = content.replace(/\[type=\w+\]/, '').trim();
// //                 }
// //             }
// //
// //             // 将指令节点转换为HTML元素（span.badge）
// //             node.type = 'element';
// //             node.tagName = 'span';
// //             node.properties = {
// //                 className: `badge badge-${type}`
// //             };
// //             node.children = [{ type: 'text', value: badgeContent.replace(/\[type=\w+\]/, '').trim() }];
// //         });
// //
// //         // 2. 处理**块级指令**：:::callout[标题]{type=info} 内容 ::: （标准语法）
// //         visit(tree, ['containerDirective'], (node) => {
// //             // 仅处理callout指令
// //             if (node.name !== 'callout') return;
// //
// //             // 步骤1：获取提示框标题（从指令的label中提取）
// //             const calloutTitle = node.label || '提示'; // label是插件解析的标题属性
// //             // 步骤2：获取提示框类型（从attributes或手动解析）
// //             let type = 'info'; // 默认类型
// //             if (node.attributes?.type) {
// //                 type = node.attributes.type;
// //             }
// //             // 兼容自定义写法：[标题][type=xxx]
// //             else if (node.label) {
// //                 const typeMatch = node.label.match(/\[type=(\w+)\]/);
// //                 if (typeMatch) {
// //                     type = typeMatch[1];
// //                     node.label = node.label.replace(/\[type=\w+\]/, '').trim();
// //                 }
// //             }
// //
// //             // 将指令节点转换为HTML元素（div.callout）
// //             node.type = 'element';
// //             node.tagName = 'div';
// //             node.properties = {
// //                 className: `callout callout-${type}`
// //             };
// //             // 构造提示框的DOM结构：标题 + 内容
// //             node.children = [
// //                 {
// //                     type: 'element',
// //                     tagName: 'h4',
// //                     properties: { className: 'callout-title' },
// //                     children: [{ type: 'text', value: calloutTitle.replace(/\[type=\w+\]/, '').trim() }]
// //                 },
// //                 {
// //                     type: 'element',
// //                     tagName: 'div',
// //                     properties: { className: 'callout-content' },
// //                     children: node.children // 原节点的children是提示框的内容
// //                 }
// //             ];
// //         });
// //     };
// // };
//
//
// /**
//  * 完整的扩展指令处理插件（基于remark-directive）
//  * - 处理行内指令：:badge[内容]{type=xxx} → <span class="badge badge-xxx">内容</span>
//  * - 处理块级指令：:::callout[标题]{type=xxx} 内容 ::: → <div class="callout callout-xxx">...</div>
//  */
// const remarkDirectiveHandler: Plugin = () => {
//     return (tree: any) => {
//         // --------------------------
//         // 1. 预处理：将文本中的行内指令转换为textDirective节点
//         // --------------------------
//         visit(tree, 'text', (node, index, parent) => {
//             // 匹配行内指令格式：:badge[内容]{type=类型}
//             const badgeReg = /:badge\[([^\]]+)\]\{type=([^\}]+)\}/g;
//             if (!badgeReg.test(node.value)) return;
//
//             // 拆分文本为"普通文本"和"指令片段"
//             const parts = node.value.split(badgeReg).filter(Boolean);
//             const newChildren = [];
//             let i = 0;
//             while (i < parts.length) {
//                 // 添加普通文本
//                 if (parts[i]) newChildren.push({ type: 'text', value: parts[i] });
//                 i++;
//                 // 构造textDirective节点（强制行内指令类型）
//                 if (i < parts.length) {
//                     const content = parts[i];
//                     const type = parts[i+1];
//                     newChildren.push({
//                         type: 'textDirective',
//                         name: 'badge',
//                         label: content, // 手动填充内容
//                         attributes: { type: type }, // 手动填充属性
//                         children: [{ type: 'text', value: content }]
//                     });
//                     i += 2;
//                 }
//             }
//             // 替换原文本节点
//             if (parent && index !== undefined) {
//                 parent.children.splice(index, 1, ...newChildren);
//             }
//         });
//
//         // --------------------------
//         // 2. 预处理：将文本中的块级指令转换为containerDirective节点
//         // --------------------------
//         visit(tree, 'paragraph', (node, index, parent) => {
//             const firstText = node.children[0];
//             if (!firstText || firstText.type !== 'text') return;
//
//             // 匹配块级指令格式：:::callout[标题]{type=类型}
//             const calloutReg = /:::callout\[([^\]]+)\]\{type=([^\}]+)\}/;
//             const match = firstText.value.match(calloutReg);
//             if (!match) return;
//
//             const [fullMatch, title, type] = match;
//             // 构造containerDirective节点（强制块级指令类型）
//             const directiveNode = {
//                 type: 'containerDirective',
//                 name: 'callout',
//                 label: title, // 手动填充标题
//                 attributes: { type: type }, // 手动填充属性
//                 children: []
//             };
//
//             // 提取指令内的内容
//             firstText.value = firstText.value.replace(fullMatch, '').trim();
//             if (firstText.value) directiveNode.children.push({ type: 'paragraph', children: [firstText] });
//
//             // 替换原段落节点
//             if (parent && index !== undefined) {
//                 parent.children.splice(index, 1, directiveNode);
//             }
//         });
//
//         // --------------------------
//         // 3. 处理行内指令：textDirective → <span>
//         // --------------------------
//         visit(tree, 'textDirective', (node) => {
//             if (node.name !== 'badge') return;
//
//             // 强制使用手动填充的内容/属性
//             const content = node.label || '默认徽章';
//             const type = node.attributes?.type || 'success';
//
//             node.type = 'element';
//             node.tagName = 'span'; // 强制行内标签
//             node.properties = { className: `badge badge-${type}` };
//             node.children = [{ type: 'text', value: content }];
//         });
//
//         // --------------------------
//         // 4. 处理块级指令：containerDirective → <div>
//         // --------------------------
//         visit(tree, 'containerDirective', (node) => {
//             if (node.name !== 'callout') return;
//
//             // 强制使用手动填充的标题/属性
//             const title = node.label || '提示';
//             const type = node.attributes?.type || 'default';
//
//             node.type = 'element';
//             node.tagName = 'div'; // 强制块级标签
//             node.properties = { className: `callout callout-${type}` };
//             node.children = [
//                 { type: 'element', tagName: 'div', properties: { className: 'callout-title' }, children: [{ type: 'text', value: title }] },
//                 { type: 'element', tagName: 'div', properties: { className: 'callout-content' }, children: node.children }
//             ];
//         });
//     };
// };
//
//
//
// export async function markdownToHtml(markdown: string): Promise<string> {
//     const result = await unified()
//         .use(remarkParse) // 先解析Markdown为AST
//         .use(remarkGfm) // GFM语法支持（含脚注）
//         .use(remarkMath) // 数学公式
//         .use(remarkDirective) // 启用指令解析（必须在parse之后，处理插件之前）
//         .use(remarkDirectiveHandler) // 处理扩展指令（核心修复）
//         .use(remarkRehype) // AST转换为HTML
//         .use(rehypeKatex) // 公式渲染
//         .use(rehypeStringify) // 生成最终HTML
//         .process(markdown);
//     return result.toString();
// }


import { unified } from 'unified';
import type { Plugin } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import 'katex/dist/katex.min.css';

interface ASTNode {
    type: string;
    name?: string;
    label?: string;
    attributes?: Record<string, string>;
    children?: ASTNode[];
    value?: string;
    properties?: Record<string, any>;
    tagName?: string;
    index?: number;
}

const remarkDirectiveHandler: Plugin = () => {
    return (tree: ASTNode) => {
        // 1. 处理行内指令：:badge[内容]{type=类型}
        visit(tree, 'text', (node: ASTNode, index: number | undefined, parent: ASTNode | undefined) => {
            if (!node.value) return;
            
            // 使用正则表达式匹配行内指令格式
            const badgeRegex = /:badge\[([^\]]+)\]\{type=([^\}]+)\}/g;
            const matches = [...node.value.matchAll(badgeRegex)];
            
            if (matches.length > 0) {
                const newChildren: ASTNode[] = [];
                let lastIndex = 0;
                
                matches.forEach((match) => {
                    const [_, content, type] = match; // 使用_忽略未使用的变量
                    const matchIndex = match.index || 0;
                    
                    // 添加匹配前的普通文本
                    if (matchIndex > lastIndex) {
                        newChildren.push({
                            type: 'text',
                            value: node.value!.slice(lastIndex, matchIndex)
                        });
                    }
                    
                    // 添加行内指令节点
                    newChildren.push({
                        type: 'textDirective',
                        name: 'badge',
                        label: content,
                        attributes: { type },
                        children: [{ type: 'text', value: content }]
                    });
                    
                    lastIndex = matchIndex + match[0].length; // 使用match[0]代替未使用的变量
                });
                
                // 添加最后剩余的文本
                if (lastIndex < node.value.length) {
                    newChildren.push({
                        type: 'text',
                        value: node.value.slice(lastIndex)
                    });
                }
                
                // 替换原始节点
                if (parent && index !== undefined && parent.children) {
                    parent.children.splice(index, 1, ...newChildren);
                }
            }
        });

        // 2. 处理块级指令：:::callout[标题]{type=类型}
        visit(tree, 'root', (rootNode: ASTNode) => {
            if (!rootNode.children) return;
            
            const newChildren: ASTNode[] = [];
            let i = 0;
            
            while (i < rootNode.children.length) {
                const node = rootNode.children[i] as ASTNode;
                
                // 检查是否为callout开始标记
                if (node.type === 'paragraph' && node.children?.[0]?.value?.startsWith(':::callout')) {
                    const firstText = node.children[0] as ASTNode;
                    
                    // 确保value存在
                    if (!firstText.value) {
                        newChildren.push(node);
                        i++;
                        continue;
                    }
                    
                    // 匹配带类型的callout格式
                    const match = firstText.value.match(/:::callout\[([^\]]+)\]\{type=([^\}]+)\}/);
                    
                    if (match) {
                        const [_, title, type] = match; // 使用_忽略未使用的变量
                        const contentNodes: ASTNode[] = [];
                        
                        // 收集callout内容直到遇到:::
                        i++;
                        while (i < rootNode.children.length) {
                            const contentNode = rootNode.children[i] as ASTNode;
                            if (contentNode.type === 'paragraph' && contentNode.children?.[0]?.value === ':::') {
                                i++;
                                break;
                            }
                            // 保留原始内容结构
                            contentNodes.push(contentNode);
                            i++;
                        }
                        
                        // 添加处理后的callout节点
                        newChildren.push({
                            type: 'containerDirective',
                            name: 'callout',
                            label: title,
                            attributes: { type },
                            children: contentNodes
                        });
                    } else {
                        // 处理不带类型的callout格式
                        const matchSimple = firstText.value.match(/:::callout\[([^\]]+)\]/);
                        if (matchSimple) {
                            const [_, title] = matchSimple; // 使用_忽略未使用的变量
                            const contentNodes: ASTNode[] = [];
                            
                            i++;
                            while (i < rootNode.children.length) {
                                const contentNode = rootNode.children[i] as ASTNode;
                                if (contentNode.type === 'paragraph' && contentNode.children?.[0]?.value === ':::') {
                                    i++;
                                    break;
                                }
                                contentNodes.push(contentNode);
                                i++;
                            }
                            
                            newChildren.push({
                                type: 'containerDirective',
                                name: 'callout',
                                label: title,
                                attributes: { type: 'default' },
                                children: contentNodes
                            });
                        } else {
                            newChildren.push(node);
                            i++;
                        }
                    }
                } else {
                    newChildren.push(node);
                    i++;
                }
            }
            
            rootNode.children = newChildren;
        });

        // 3. 转换textDirective为HTML元素
        visit(tree, 'textDirective', (node: ASTNode) => {
            if (node.name !== 'badge') return;
            
            node.type = 'element';
            node.tagName = 'span';
            node.properties = {
                className: `badge badge-${node.attributes?.type || 'default'}`
            };
            node.children = [{ type: 'text', value: node.label || '' }];
        });

        // 4. 转换containerDirective为HTML元素
        visit(tree, 'containerDirective', (node: ASTNode) => {
            if (node.name !== 'callout') return;
            
            node.type = 'element';
            node.tagName = 'div';
            node.properties = {
                className: `callout callout-${node.attributes?.type || 'default'}`
            };
            node.children = [
                {
                    type: 'element',
                    tagName: 'div',
                    properties: { className: 'callout-title' },
                    children: [{ type: 'text', value: node.label || '' }]
                },
                {
                    type: 'element',
                    tagName: 'div',
                    properties: { className: 'callout-content' },
                    children: node.children || []
                }
            ];
        });

        // 5. 强制移除footnotes section
        visit(tree, 'element', (node: ASTNode, index: number | undefined, parent: ASTNode | undefined) => {
            if (node.properties?.className?.includes('footnotes') && parent && index !== undefined && parent.children) {
                parent.children.splice(index, 1);
            }
        });
    };
};

// 处理选项接口
export interface MarkdownToHtmlOptions {
    // 是否启用语法修复功能
    enableSyntaxFix?: boolean;
}

// 语法修复辅助函数
function fixMarkdownSyntax(markdown: string): string {
    // 修复未闭合的代码块
    const codeBlockMatches = markdown.match(/```/g);
    if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
        markdown = markdown + '\n```';
    }
    
    // 修复未闭合的callout指令
    // 计算:::callout开始标记和:::结束标记的数量
    const calloutStartMatches = markdown.match(/:::callout/g);
    const calloutEndMatches = markdown.match(/^:::/gm);
    const startCount = calloutStartMatches?.length || 0;
    const endCount = calloutEndMatches?.length || 0;
    
    // 如果开始标记多于结束标记，添加缺少的结束标记
    if (startCount > endCount) {
        markdown = markdown + '\n:::';
    }
    
    // 注意：不自动修复未闭合的数学公式，让它们保持未闭合状态
    // 这样流式渲染可以正确处理正在输入的公式，避免提前渲染完整公式
    
    return markdown;
}

export async function markdownToHtml(markdown: string, options: MarkdownToHtmlOptions = {}): Promise<string> {
    const { enableSyntaxFix = true } = options;
    
    // 如果启用语法修复，则先修复Markdown语法
    let processedMarkdown = markdown;
    if (enableSyntaxFix) {
        processedMarkdown = fixMarkdownSyntax(processedMarkdown);
    }
    
    const result = await unified()
        .use(remarkParse)
        .use(remarkDirective)
        .use(remarkGfm)
        .use(remarkMath)
        .use(remarkDirectiveHandler)
        .use(remarkRehype)
        .use(rehypeKatex)
        .use(rehypeStringify)
        .process(processedMarkdown);

    return result.toString().trim();
}