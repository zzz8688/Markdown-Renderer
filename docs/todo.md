# 项目 TODO 清单（结构化）

按里程碑与优先级组织，实际执行可滚动调整。勾选框由实现进度维护。

## M0 基础环境与 UI
- [ ] 建立 Playground 骨架（React+TS）：左右布局，输入框与预览区，基础状态管理
- [ ] 集成 remark 基线管线：remark-parse、remark-gfm、remark-rehype、rehype-stringify

## M1 流式核心能力
- [ ] 实现流式文本缓冲层（Chunk 汇聚与尾包识别）
- [ ] 实现“平滑输出器”（弹簧模型/速度平滑算法），可配置初速/最大速
- [ ] 构建 StreamingRenderer 组件：逐字推进渲染并最小化重排
- [ ] 尾包快速收敛逻辑：收到尾包后加速输出并一次性结构修补

## M2 语法能力与扩展
- [ ] GFM 支持验证：表格、任务列表、删除线、围栏代码块、脚注
- [ ] 集成数学公式：remark-math + rehype-katex（含样式）
- [ ] Directive 扩展（加分项）：remark-directive + 自定义渲染（badge、callout）
- [ ] 常见语法修复（可选）：未闭合代码块自动补全（可开关）

## M3 质量与交付
- [ ] 性能与流畅性调优：大文本/快速输入基准测试与帧率监控
- [ ] 样张验证：使用“Markdown 样张”全量通过渲染验收
- [ ] 文档与配置项说明：平滑参数、开关项、指令格式
- [ ] 基础测试用例：单元测试（解析/指令/修复）与端到端流式测试
- [ ] Playground 打包与公开访问配置（Netlify/Vercel）

## 已完成
- [x] 落盘 TODO 清单（docs/todo.md）
- [x] 预置“Markdown 样张”到 Playground 默认输入（便于直接验收）
