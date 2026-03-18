# OpenSpec: 对话式 AI 素材创作工具首版规格

## 1. Spec Metadata

- Spec Name: `ai-creative-workspace-mvp`
- Version: `0.1.0`
- Status: `Draft`
- Scope: `MVP`
- Updated At: `2026-03-17`

## 2. Product Intent

本产品是一款面向视频创作者的 AI 素材创作工具。  
用户通过右侧侧边栏与 AI 对话，触发素材生成；生成后的素材自动进入左侧画布，并可继续被引用、组织与下载。

当前首版目标不是一次性做全能力平台，而是先跑通最小可用链路：

- 文生图
- 图生视频
- 画布基础交互
- 资源引用与下载

## 3. MVP Scope

### 3.1 In Scope

- 文生图
- 图生视频
- 右侧侧边栏会话式输入
- 左侧自由画布展示素材
- 画布平移、缩放、素材拖拽
- 资源选中
- 双击图片加入 `@引用`
- 顶部 `@` 按钮把选中资源加入输入框
- 顶部 `下载` 按钮下载选中资源
- 生成结果自动进入画布
- 本地会话持久化

### 3.2 Out of Scope

- 文生视频
- 图生图
- 多资源同时引用
- 时间线编辑器
- 批量导出
- 多人协作
- 自动复杂任务拆解
- 高级提示词自动优化

## 4. Layout Specification

### 4.1 Overall Layout

界面基于当前“左画布 + 右侧边栏”布局继续演进：

- 左侧：画布区
- 中间：可拖动分割线
- 右侧：AI 侧边栏

### 4.2 Layout Requirements

- 画布与侧边栏撑满全屏高度
- 中间分割线支持左右拖动
- 布局比例变化时两侧内容自适应
- 整体风格保持暗黑简约
- 所有 UI 样式由项目自定义，不依赖 Ant Design 视觉体系

## 5. User Stories

### 5.1 文生图

作为创作者，我希望直接输入一句需求，例如“生成一张未来感城市夜景图”，系统自动生成图片并放到画布中。

### 5.2 图生视频

作为创作者，我希望先生成一张图，再通过双击或 `@` 按钮把图片加入输入框，然后输入“基于这张图生成一个镜头推进视频”，系统自动生成视频并放到画布中。

### 5.3 画布整理

作为创作者，我希望在画布中自由拖拽、缩放和组织素材，方便构思视频素材布局。

### 5.4 下载资源

作为创作者，我希望选中资源后能直接下载图片或视频到本地。

## 6. Functional Specification

### 6.1 Sidebar Chat

右侧侧边栏负责所有创作入口与会话交互。

支持能力：

- 输入自然语言创作需求
- 显示会话消息流
- 显示发送中 / 生成中状态
- 支持 `@资源`
- 支持新建会话
- 支持本地保存最近会话

### 6.2 Generation Modes

首版仅允许两种生成模式：

#### Mode A: `text_to_image`

触发条件：

- 输入框中无引用图片
- 用户发送普通文本创作需求

执行结果：

- 调用文生图接口
- 返回图片资源
- 自动加入画布

#### Mode B: `image_to_video`

触发条件：

- 输入框中存在 1 个被引用的图片资源
- 用户继续输入视频生成需求

执行结果：

- 调用图生视频接口
- 返回视频资源
- 自动加入画布

### 6.3 Asset Canvas

左侧画布负责承载所有素材。

支持能力：

- 展示图片资源
- 展示视频资源
- 支持选中素材
- 支持素材拖拽移动
- 支持画布整体平移
- 支持画布整体缩放
- 支持顶部操作栏

### 6.4 Asset Referencing

图片资源可以进入侧边栏输入框，作为图生视频的输入。

支持方式：

- 双击图片资源，自动加入输入框 `@引用`
- 选中图片资源后，点击顶部 `@` 按钮加入输入框

首版限制：

- 一次只支持引用 1 张图片
- 被引用资源类型仅支持 `image`

### 6.5 Asset Download

选中资源后，顶部操作栏至少提供：

- `@`
- `下载`

下载规则：

- 图片下载原图
- 视频下载原视频

## 7. Interaction Rules

### 7.1 Canvas Interactions

#### 7.1.1 画布平移

- 鼠标按住画布空白区域拖动时，移动画布视口

#### 7.1.2 画布缩放

- 鼠标滚轮缩放画布
- 首版缩放中心默认跟随当前鼠标位置

#### 7.1.3 素材拖拽

- 鼠标拖动素材时，改变素材在画布中的位置

#### 7.1.4 素材选中

- 单击素材时进入选中状态
- 同一时刻只允许单选

#### 7.1.5 双击图片

- 双击图片素材时，将其加入输入框引用

### 7.2 Sidebar Interactions

#### 7.2.1 Enter 行为

- `Enter` 发送
- `Shift + Enter` 换行

#### 7.2.2 引用展示

- 输入框中被引用素材应展示为结构化 `@资源`
- 首版可以使用简化的视觉 token 表达

#### 7.2.3 会话切换

- 左侧画布内容与当前会话绑定
- 切换会话时，同步切换画布内容

#### 7.2.4 新会话

- 点击 `新会话` 时：
  - 新建会话
  - 新建空画布
  - 输入框清空

## 8. State Model

### 8.1 Conversation State

```ts
type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: Message[];
  assets: Asset[];
}
```

### 8.2 Message State

```ts
type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  referencedAssetIds?: string[];
  status?: 'streaming' | 'done' | 'failed';
}
```

### 8.3 Asset State

```ts
type Asset = {
  id: string;
  type: 'image' | 'video';
  mode: 'text_to_image' | 'image_to_video';
  previewUrl: string;
  downloadUrl: string;
  prompt: string;
  sourceAssetId?: string;
  createdAt: string;
  status: 'generating' | 'ready' | 'failed';
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
  selected?: boolean;
}
```

### 8.4 Canvas State

```ts
type CanvasState = {
  zoom: number;
  offsetX: number;
  offsetY: number;
  selectedAssetId?: string;
}
```

## 9. Backend API Specification

### 9.1 Chat Orchestration API

#### Endpoint

`POST /workspace/chat`

#### Request

```json
{
  "text": "生成一张未来城市夜景图",
  "referencedAssets": []
}
```

或

```json
{
  "text": "基于这张图生成一个镜头推进视频",
  "referencedAssets": [
    {
      "id": "asset_123",
      "type": "image"
    }
  ]
}
```

#### Response

```json
{
  "reply": "正在为你生成图片",
  "mode": "text_to_image",
  "taskId": "task_001"
}
```

### 9.2 Image Generation API

#### Purpose

用于文生图。

#### Output Schema

```json
{
  "id": "asset_001",
  "type": "image",
  "mode": "text_to_image",
  "previewUrl": "https://...",
  "downloadUrl": "https://...",
  "prompt": "未来城市夜景",
  "createdAt": "2026-03-17T10:00:00+08:00",
  "status": "ready"
}
```

### 9.3 Image-to-Video Generation API

#### Purpose

用于图生视频。

#### Input

- 图片资源 id
- 用户补充文本描述

#### Output Schema

```json
{
  "id": "asset_002",
  "type": "video",
  "mode": "image_to_video",
  "previewUrl": "https://...",
  "downloadUrl": "https://...",
  "prompt": "镜头推进视频",
  "sourceAssetId": "asset_001",
  "createdAt": "2026-03-17T10:01:00+08:00",
  "status": "ready"
}
```

## 10. Frontend UI Contract

### 10.1 Sidebar Input Payload

前端发送消息时必须显式携带引用资源：

```ts
type ChatSubmitPayload = {
  text: string;
  referencedAssets: Array<{
    id: string;
    type: 'image';
  }>;
}
```

### 10.2 Top Toolbar Actions

当素材被选中时，顶部工具栏显示：

- `@`
- `下载`

如果当前选中资源不是图片：

- `@` 按钮禁用

### 10.3 Asset Rendering Contract

- 图片以图片卡片形式展示
- 视频以视频封面卡片或视频卡片形式展示
- 资源生成中时显示加载态
- 资源失败时显示失败态

## 11. Status Model

### 11.1 Message Status

- `streaming`
- `done`
- `failed`

### 11.2 Asset Status

- `generating`
- `ready`
- `failed`

### 11.3 Task Lifecycle

#### 文生图

1. 用户发送文本
2. 侧边栏显示发送中
3. 创建生成任务
4. 画布插入占位图片卡片
5. 图片生成完成
6. 占位卡片更新为真实资源

#### 图生视频

1. 用户引用图片
2. 用户发送图生视频需求
3. 侧边栏显示发送中
4. 创建生成任务
5. 画布插入占位视频卡片
6. 视频生成完成
7. 占位卡片更新为真实资源

## 12. Error Handling

### 12.1 Chat Errors

- 模型调用失败
- 工具调度失败
- 输入为空

处理方式：

- 侧边栏显示失败消息
- 不清除用户原始意图上下文

### 12.2 Generation Errors

- 生成接口超时
- 资源返回为空
- 生成失败

处理方式：

- 画布中的占位资源进入 `failed` 状态
- 侧边栏提示失败原因

## 13. Acceptance Criteria

### 13.1 文生图

- 用户输入一段文本
- 系统识别为文生图
- 图片生成成功后自动进入画布

### 13.2 图生视频

- 用户双击图片或点击顶部 `@`
- 输入框出现结构化引用
- 用户发送图生视频指令
- 视频生成成功后自动进入画布

### 13.3 画布交互

- 用户可平移画布
- 用户可缩放画布
- 用户可拖动素材
- 用户可选中素材
- 选中后可使用 `@` 和 `下载`

### 13.4 会话持久化

- 页面刷新后最近会话仍在
- 重新打开时能恢复最近画布内容

## 14. Build Order

### Phase 1

- 统一会话模型
- 统一资源模型
- 统一画布模型

### Phase 2

- 实现画布平移 / 缩放 / 素材拖拽 / 选中
- 实现顶部工具栏 `@` / `下载`

### Phase 3

- 接入文生图
- 接入图生视频
- 生成结果自动进入画布

### Phase 4

- 接入会话持久化
- 优化侧边栏对话体验
- 完善失败态和加载态

## 15. Next Step

下一步开发应严格按本规格推进 P0：

1. 统一 `Conversation` / `Message` / `Asset` / `CanvasState`
2. 完成画布基础交互
3. 完成单图片引用机制
4. 接入文生图
5. 接入图生视频
6. 打通“生成结果自动进入画布”闭环
