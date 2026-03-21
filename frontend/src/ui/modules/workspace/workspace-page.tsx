import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InfiniteCanvas, type CanvasItem, type CanvasViewport } from './InfiniteCanvas';
import { FloatingChat, type ChatMode } from './FloatingChat';
import { generateWorkspaceAsset, getWorkspaceConfig, IWorkspaceConfigResponse } from '../../../api';
import type {
    IWorkspaceAsset,
    IWorkspaceComposerReference,
    IWorkspaceConversation,
    IWorkspaceConversationMessage,
    IWorkspaceGenerationRequest,
    IWorkspaceViewport,
} from '../../../types/workspace';
import imageOne from '../../../../../assets/image_1.png';
import imageBasicUse from '../../../../../assets/image_basic_use.png';
import imageCreateProject from '../../../../../assets/image_create_project.png';
import imageSetting from '../../../../../assets/image_setting.png';
import videoTimesheet from '../../../../../assets/output.mp4';

const defaultAssistantCopy = '描述你想要的图片，或先选中一张图把它 @ 到输入框里，然后继续生成视频。';

const CONVERSATION_STORAGE_KEY = 'workspace-conversations-v5';
const ACTIVE_CONVERSATION_STORAGE_KEY = 'workspace-active-conversation-id-v5';

const demoAssets: Array<Pick<IWorkspaceAsset, 'type' | 'prompt' | 'previewUrl' | 'downloadUrl' | 'width' | 'height'>> = [
    { type: 'image', prompt: '演示图片 01', previewUrl: imageOne, downloadUrl: imageOne, width: 960, height: 1260 },
    { type: 'image', prompt: '演示图片 02', previewUrl: imageBasicUse, downloadUrl: imageBasicUse, width: 960, height: 1260 },
    { type: 'image', prompt: '演示图片 03', previewUrl: imageCreateProject, downloadUrl: imageCreateProject, width: 960, height: 1260 },
    { type: 'image', prompt: '演示图片 04', previewUrl: imageSetting, downloadUrl: imageSetting, width: 960, height: 1260 },
    { type: 'video', prompt: '演示视频素材', previewUrl: videoTimesheet, downloadUrl: videoTimesheet, width: 1280, height: 720 },
];

const formatTime = (date = new Date()) => new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
}).format(date);

const createViewport = (): IWorkspaceViewport => ({
    x: 0,
    y: 0,
    scale: 0.62,
});

const getAssetPlacement = (index: number) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    return {
        x: 160 + column * 1180,
        y: 160 + row * 980,
    };
};

const createLocalMessage = (
    role: IWorkspaceConversationMessage['role'],
    content: string,
    suffix: string,
    status: IWorkspaceConversationMessage['status'] = 'done',
): IWorkspaceConversationMessage => ({
    id: `${Date.now()}-${suffix}`,
    role,
    content,
    createdAt: formatTime(),
    status,
});

const createDemoCanvasAssets = (seed: string): IWorkspaceAsset[] => demoAssets.map((asset, index) => {
    const placement = getAssetPlacement(index);
    return {
        id: `${seed}-demo-asset-${index}`,
        type: asset.type,
        prompt: asset.prompt,
        status: 'ready',
        createdAt: new Date().toISOString(),
        previewUrl: asset.previewUrl,
        downloadUrl: asset.downloadUrl,
        width: asset.width,
        height: asset.height,
        x: placement.x,
        y: placement.y,
    };
});

const createConversation = (seed = 'new'): IWorkspaceConversation => ({
    id: `${Date.now()}-${seed}`,
    title: '新会话',
    updatedAt: formatTime(),
    messages: [createLocalMessage('assistant', defaultAssistantCopy, `${seed}-welcome`)],
    assets: createDemoCanvasAssets(seed),
    selectedAssetId: null,
    viewport: createViewport(),
    composerText: '',
    composerReference: null,
});

const createPendingAsset = (request: IWorkspaceGenerationRequest, count: number): IWorkspaceAsset => {
    const placement = getAssetPlacement(count);
    const isVideo = request.mode === 'image_to_video';

    return {
        id: `pending-${Date.now()}-${count}`,
        type: isVideo ? 'video' : 'image',
        prompt: request.text,
        status: 'generating',
        createdAt: new Date().toISOString(),
        width: isVideo ? 1280 : 960,
        height: isVideo ? 720 : 1260,
        x: placement.x,
        y: placement.y,
        sourceAssetId: request.referencedAssets[0]?.assetId,
    };
};

const hydrateConversation = (raw: Partial<IWorkspaceConversation>, index: number): IWorkspaceConversation => {
    const seed = raw.id || `hydrated-${index}`;
    const hydratedAssets: IWorkspaceAsset[] = Array.isArray(raw.assets) ? raw.assets.map((asset, assetIndex) => ({
        id: asset.id || `${seed}-asset-${assetIndex}`,
        type: asset.type === 'video' ? 'video' : 'image',
        prompt: asset.prompt || '未命名素材',
        status: asset.status || 'ready',
        createdAt: asset.createdAt || new Date().toISOString(),
        previewUrl: asset.previewUrl,
        downloadUrl: asset.downloadUrl,
        sourceAssetId: asset.sourceAssetId,
        width: asset.width || (asset.type === 'video' ? 1280 : 960),
        height: asset.height || (asset.type === 'video' ? 720 : 1260),
        x: typeof asset.x === 'number' ? asset.x : getAssetPlacement(assetIndex).x,
        y: typeof asset.y === 'number' ? asset.y : getAssetPlacement(assetIndex).y,
        errorMessage: asset.errorMessage,
        raw: asset.raw,
    })) : [];

    return {
        id: raw.id || `${Date.now()}-${seed}`,
        title: raw.title || '新会话',
        updatedAt: raw.updatedAt || formatTime(),
        messages: Array.isArray(raw.messages) && raw.messages.length > 0
            ? raw.messages.map((message, messageIndex) => ({
                id: message.id || `${seed}-message-${messageIndex}`,
                role: message.role || 'assistant',
                content: message.content || '',
                createdAt: message.createdAt || formatTime(),
                status: message.status || 'done',
            }))
            : [createLocalMessage('assistant', defaultAssistantCopy, `${seed}-welcome`)],
        assets: hydratedAssets.length > 0 ? hydratedAssets : createDemoCanvasAssets(seed),
        selectedAssetId: raw.selectedAssetId || null,
        viewport: {
            x: raw.viewport?.x ?? createViewport().x,
            y: raw.viewport?.y ?? createViewport().y,
            scale: raw.viewport?.scale ?? createViewport().scale,
        },
        composerText: raw.composerText || '',
        composerReference: raw.composerReference || null,
    };
};


export const WorkspacePage = () => {
    const [initialConversation] = useState<IWorkspaceConversation>(() => createConversation());
    const [conversations, setConversations] = useState<IWorkspaceConversation[]>(() => [initialConversation]);
    const [activeConversationId, setActiveConversationId] = useState(initialConversation.id);
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<IWorkspaceConfigResponse | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);

    const activeConversation = useMemo(() => {
        return conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0];
    }, [activeConversationId, conversations]);

    useEffect(() => {
        getWorkspaceConfig()
            .then(setConfig)
            .catch(() => {
                setNotice('后端配置尚未完成，当前先展示工作台骨架。');
            });
    }, []);

    useEffect(() => {
        try {
            const rawConversations = window.localStorage.getItem(CONVERSATION_STORAGE_KEY);
            const rawActiveId = window.localStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY);
            if (!rawConversations) {
                setIsHydrated(true);
                return;
            }

            const parsed = JSON.parse(rawConversations) as Partial<IWorkspaceConversation>[];
            if (!Array.isArray(parsed) || parsed.length === 0) {
                setIsHydrated(true);
                return;
            }

            const hydrated = parsed.map(hydrateConversation);
            setConversations(hydrated);
            if (rawActiveId && hydrated.some((conversation) => conversation.id === rawActiveId)) {
                setActiveConversationId(rawActiveId);
            } else {
                setActiveConversationId(hydrated[0].id);
            }
        } catch {
            // ignore invalid local cache
        }
        setIsHydrated(true);
    }, []);

    useEffect(() => {
        if (!isHydrated) {
            return;
        }
        window.localStorage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(conversations));
        window.localStorage.setItem(ACTIVE_CONVERSATION_STORAGE_KEY, activeConversationId);
    }, [activeConversationId, conversations, isHydrated]);

    useEffect(() => {
        if (!notice) {
            return undefined;
        }
        const timer = window.setTimeout(() => setNotice(null), 3200);
        return () => window.clearTimeout(timer);
    }, [notice]);


    const updateConversationById = (conversationId: string, updater: (conversation: IWorkspaceConversation) => IWorkspaceConversation) => {
        setConversations((current) => current.map((conversation) => (
            conversation.id === conversationId ? updater(conversation) : conversation
        )));
    };

    const setComposerText = (value: string) => {
        if (!activeConversation) {
            return;
        }
        updateConversationById(activeConversation.id, (conversation) => ({
            ...conversation,
            composerText: value,
        }));
    };

    const setComposerReference = (reference: IWorkspaceComposerReference | null) => {
        if (!activeConversation) {
            return;
        }
        updateConversationById(activeConversation.id, (conversation) => ({
            ...conversation,
            composerReference: reference,
        }));
    };

    const insertReferenceFromAsset = (asset: IWorkspaceAsset) => {
        if (asset.type !== 'image') {
            setNotice('当前首版仅支持将图片素材 @ 到输入框中。');
            return;
        }
        setComposerReference({
            assetId: asset.id,
            type: 'image',
            name: asset.prompt.slice(0, 16) || '图片素材',
            previewUrl: asset.previewUrl,
            downloadUrl: asset.downloadUrl,
        });
        setNotice('已将图片加入输入框引用。');
    };

    // ---------------------------------------------------------------------------
    // InfiniteCanvas handlers
    // ---------------------------------------------------------------------------

    const handleCanvasSelect = (id: string | null) => {
        if (!activeConversation) return;
        updateConversationById(activeConversation.id, (conv) => ({ ...conv, selectedAssetId: id }));
    };

    const handleCanvasViewportChange = (vp: CanvasViewport) => {
        if (!activeConversation) return;
        updateConversationById(activeConversation.id, (conv) => ({ ...conv, viewport: vp }));
    };

    const handleCanvasItemChange = (
        id: string,
        patch: { x?: number; y?: number; width?: number; height?: number },
    ) => {
        if (!activeConversation) return;
        updateConversationById(activeConversation.id, (conv) => ({
            ...conv,
            assets: conv.assets.map((asset) => (asset.id === id ? { ...asset, ...patch } : asset)),
        }));
    };

    const handleCanvasDoubleClick = (id: string) => {
        const asset = activeConversation?.assets.find((a) => a.id === id);
        if (asset) insertReferenceFromAsset(asset);
    };

    const submit = async (chatMode: ChatMode = 'agent') => {
        if (!activeConversation || loading) {
            return;
        }

        const prompt = activeConversation.composerText.trim();
        if (!prompt) {
            return;
        }

        const mode: IWorkspaceGenerationRequest['mode'] =
            chatMode === 'video'
                ? 'image_to_video'
                : chatMode === 'image'
                    ? 'text_to_image'
                    : activeConversation.composerReference
                        ? 'image_to_video'
                        : 'text_to_image';
        const requestPayload: IWorkspaceGenerationRequest = {
            mode,
            text: prompt,
            referencedAssets: activeConversation.composerReference ? [activeConversation.composerReference] : [],
        };
        const pendingAsset = createPendingAsset(requestPayload, activeConversation.assets.length);
        const assistantMessageId = `${Date.now()}-generation-status`;
        const title = activeConversation.title === '新会话' ? prompt.slice(0, 18) : activeConversation.title;

        updateConversationById(activeConversation.id, (conversation) => ({
            ...conversation,
            title,
            updatedAt: formatTime(),
            composerText: '',
            composerReference: null,
            selectedAssetId: pendingAsset.id,
            assets: [...conversation.assets, pendingAsset],
            messages: [
                ...conversation.messages,
                createLocalMessage('user', prompt, 'user'),
                {
                    id: assistantMessageId,
                    role: 'assistant',
                    content: mode === 'text_to_image' ? '正在生成图片...' : '正在基于引用图片生成视频...',
                    createdAt: formatTime(),
                    status: 'pending',
                },
            ],
        }));
        setLoading(true);

        try {
            const response = await generateWorkspaceAsset(requestPayload);
            updateConversationById(activeConversation.id, (conversation) => ({
                ...conversation,
                updatedAt: formatTime(),
                selectedAssetId: pendingAsset.id,
                assets: conversation.assets.map((asset) => (
                    asset.id === pendingAsset.id
                        ? {
                            ...asset,
                            type: response.asset.type,
                            prompt: response.asset.prompt,
                            status: response.asset.status,
                            createdAt: response.asset.createdAt,
                            previewUrl: response.asset.previewUrl,
                            downloadUrl: response.asset.downloadUrl,
                            sourceAssetId: response.asset.sourceAssetId,
                            raw: response.asset.raw,
                            errorMessage: undefined,
                        }
                        : asset
                )),
                messages: conversation.messages.map((message) => (
                    message.id === assistantMessageId
                        ? {
                            ...message,
                            content: response.message.content,
                            status: 'done',
                        }
                        : message
                )),
            }));
        } catch (error: any) {
            const detail = error?.message || '生成失败，请检查后端配置。';
            updateConversationById(activeConversation.id, (conversation) => ({
                ...conversation,
                updatedAt: formatTime(),
                assets: conversation.assets.map((asset) => (
                    asset.id === pendingAsset.id
                        ? {
                            ...asset,
                            status: 'failed',
                            errorMessage: detail,
                        }
                        : asset
                )),
                messages: conversation.messages.map((message) => (
                    message.id === assistantMessageId
                        ? {
                            ...message,
                            content: `执行失败：${detail}`,
                            status: 'failed',
                        }
                        : message
                )),
            }));
            setNotice(detail);
        } finally {
            setLoading(false);
        }
    };

    const resetConversation = () => {
        const nextConversation = createConversation('reset');
        setConversations((current) => [nextConversation, ...current]);
        setActiveConversationId(nextConversation.id);
        setNotice('已创建新的演示工作台。');
    };

    const openConversation = (conversationId: string) => {
        setActiveConversationId(conversationId);
    };

    const copyMessage = async (content: string) => {
        try {
            await navigator.clipboard.writeText(content);
            setNotice('消息已复制。');
        } catch {
            setNotice('复制失败，请检查浏览器剪贴板权限。');
        }
    };

    const canvasItems = useMemo<CanvasItem[]>(() =>
        (activeConversation?.assets ?? []).map((asset) => ({
            id: asset.id,
            type: asset.type,
            x: asset.x,
            y: asset.y,
            width: asset.width,
            height: asset.height,
            src: asset.previewUrl ?? asset.downloadUrl,
            isGenerating: asset.status === 'generating',
            isFailed: asset.status === 'failed',
            label: asset.prompt,
        })),
        [activeConversation?.assets],
    );

    if (!activeConversation) {
        return null;
    }

    return (
        <div className='workspace-page'>
            {/* Full-screen canvas */}
            <InfiniteCanvas
                key={activeConversation.id}
                items={canvasItems}
                selectedId={activeConversation.selectedAssetId}
                viewport={activeConversation.viewport}
                onViewportChange={handleCanvasViewportChange}
                onSelect={handleCanvasSelect}
                onItemChange={handleCanvasItemChange}
                onDoubleClick={handleCanvasDoubleClick}
            />

            {/* Floating chat panel */}
            <FloatingChat
                activeConversation={activeConversation}
                loading={loading}
                onSubmit={submit}
                onComposerTextChange={setComposerText}
                onComposerReferenceChange={setComposerReference}
            />

            {notice ? <div className='workspace-toast'>{notice}</div> : null}
        </div>
    );
};
