import '@tldraw/tldraw/tldraw.css';

import React, { KeyboardEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
    AssetRecordType,
    createShapeId,
    Editor,
    PageRecordType,
    Tldraw,
    type TLAsset,
    type TLImageShape,
    type TLShape,
    type TLVideoShape,
} from '@tldraw/tldraw';
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

const starterPrompts = [
    '生成一张具有电影感的海边日落图',
    '生成一张未来感城市夜景图，适合做视频封面',
    '生成一张极简产品广告风格的工作台主视觉',
];

const CONVERSATION_STORAGE_KEY = 'workspace-conversations-v5';
const ACTIVE_CONVERSATION_STORAGE_KEY = 'workspace-active-conversation-id-v5';

const demoAssets: Array<Pick<IWorkspaceAsset, 'type' | 'prompt' | 'previewUrl' | 'downloadUrl' | 'width' | 'height'>> = [
    { type: 'image', prompt: '演示图片 01', previewUrl: imageOne, downloadUrl: imageOne, width: 960, height: 1260 },
    { type: 'image', prompt: '演示图片 02', previewUrl: imageBasicUse, downloadUrl: imageBasicUse, width: 960, height: 1260 },
    { type: 'image', prompt: '演示图片 03', previewUrl: imageCreateProject, downloadUrl: imageCreateProject, width: 960, height: 1260 },
    { type: 'image', prompt: '演示图片 04', previewUrl: imageSetting, downloadUrl: imageSetting, width: 960, height: 1260 },
    { type: 'video', prompt: '演示视频素材', previewUrl: videoTimesheet, downloadUrl: videoTimesheet, width: 1280, height: 720 },
];

type TResizeState = { dragging: boolean } | null;

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

const getPageId = (conversationId: string) => PageRecordType.createId(`workspace-${conversationId}`);
const getTlAssetId = (assetId: string) => AssetRecordType.createId(`workspace-${assetId}`);
const getTlShapeId = (assetId: string) => createShapeId(`workspace-${assetId}`);

type TCanvasShape = TLImageShape | TLVideoShape;

const isCanvasShape = (shape: TLShape): shape is TCanvasShape => shape.type === 'image' || shape.type === 'video';

const getMimeType = (asset: IWorkspaceAsset) => {
    if (asset.type === 'video') {
        return 'video/mp4';
    }
    return 'image/png';
};

const getApproximateFileSize = (asset: IWorkspaceAsset) => {
    const pixels = Math.max(1, asset.width * asset.height);
    if (asset.type === 'video') {
        return Math.max(1024 * 1024, Math.round(pixels * 0.45));
    }
    return Math.max(32 * 1024, Math.round(pixels * 0.18));
};

const toTlAsset = (asset: IWorkspaceAsset): TLAsset | null => {
    const src = asset.downloadUrl || asset.previewUrl;
    if (!src) {
        return null;
    }

    return {
        id: getTlAssetId(asset.id),
        typeName: 'asset',
        type: asset.type,
        props: {
            name: asset.prompt,
            src,
            w: asset.width,
            h: asset.height,
            mimeType: getMimeType(asset),
            isAnimated: asset.type === 'video',
            fileSize: getApproximateFileSize(asset),
        },
        meta: {
            workspaceAssetId: asset.id,
        },
    } as TLAsset;
};

export const WorkspacePage = () => {
    const [initialConversation] = useState<IWorkspaceConversation>(() => createConversation());
    const [conversations, setConversations] = useState<IWorkspaceConversation[]>(() => [initialConversation]);
    const [activeConversationId, setActiveConversationId] = useState(initialConversation.id);
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<IWorkspaceConfigResponse | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const [stageWidth, setStageWidth] = useState(62);
    const frameRef = useRef<HTMLDivElement | null>(null);
    const resizeStateRef = useRef<TResizeState>(null);
    const messagesRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<Editor | null>(null);
    const syncLockRef = useRef(false);
    const rafSyncRef = useRef<number | null>(null);
    const activeConversationRef = useRef<IWorkspaceConversation | null>(initialConversation);

    const activeConversation = useMemo(() => {
        return conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0];
    }, [activeConversationId, conversations]);

    useEffect(() => {
        activeConversationRef.current = activeConversation;
    }, [activeConversation]);

    const selectedAsset = useMemo(() => {
        return activeConversation?.assets.find((asset) => asset.id === activeConversation.selectedAssetId) || null;
    }, [activeConversation]);

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

    useEffect(() => {
        const container = messagesRef.current;
        if (!container) {
            return;
        }
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth',
        });
    }, [activeConversation?.messages, loading]);

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
            if (!resizeStateRef.current?.dragging || !frameRef.current || window.innerWidth <= 1100) {
                return;
            }

            const bounds = frameRef.current.getBoundingClientRect();
            const ratio = ((event.clientX - bounds.left) / bounds.width) * 100;
            const nextWidth = Math.min(78, Math.max(34, ratio));
            setStageWidth(nextWidth);
        };

        const handlePointerUp = () => {
            resizeStateRef.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, []);

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

    const downloadAsset = (asset: IWorkspaceAsset) => {
        const targetUrl = asset.downloadUrl || asset.previewUrl;
        if (!targetUrl) {
            setNotice('当前素材还没有可下载地址。');
            return;
        }

        const anchor = document.createElement('a');
        anchor.href = targetUrl;
        anchor.download = `${asset.type}-${asset.id}`;
        anchor.rel = 'noreferrer';
        anchor.target = '_blank';
        anchor.click();
    };

    const syncConversationToEditor = (conversation: IWorkspaceConversation) => {
        const editor = editorRef.current;
        if (!editor) {
            return;
        }

        syncLockRef.current = true;
        try {
            const pageId = getPageId(conversation.id);
            if (!editor.getPage(pageId)) {
                editor.createPage({ id: pageId, name: conversation.title || '工作台' });
            }
            if (editor.getCurrentPageId() !== pageId) {
                editor.setCurrentPage(pageId);
            }

            const currentShapes = editor.getCurrentPageShapes().filter(isCanvasShape);
            const nextShapeIds = new Set(conversation.assets.map((asset) => getTlShapeId(asset.id)));
            const nextAssetIds = new Set(conversation.assets.map((asset) => getTlAssetId(asset.id)));

            const shapesToDelete = currentShapes
                .filter((shape) => !nextShapeIds.has(shape.id))
                .map((shape) => shape.id);

            if (shapesToDelete.length > 0) {
                editor.deleteShapes(shapesToDelete);
            }

            const assetsToDelete = editor.getAssets()
                .filter((asset) => !nextAssetIds.has(asset.id) && String(asset.id).includes('workspace-'))
                .map((asset) => asset.id);

            if (assetsToDelete.length > 0) {
                editor.deleteAssets(assetsToDelete);
            }

            const assetsToCreate: TLAsset[] = [];
            const assetUpdates: TLAsset[] = [];
            const shapeCreates: any[] = [];
            const shapeUpdates: any[] = [];

            conversation.assets.forEach((asset) => {
                const tlAsset = toTlAsset(asset);
                const shapeId = getTlShapeId(asset.id);
                const assetId = getTlAssetId(asset.id);

                if (tlAsset) {
                    if (editor.getAsset(assetId)) {
                        assetUpdates.push(tlAsset);
                    } else {
                        assetsToCreate.push(tlAsset);
                    }
                }

                const existingShape = editor.getShape(shapeId);
                const shapePartial = {
                    id: shapeId,
                    type: asset.type,
                    x: asset.x,
                    y: asset.y,
                    opacity: 1,
                    props: {
                        assetId: tlAsset ? assetId : null,
                        w: asset.width,
                        h: asset.height,
                    },
                };

                if (existingShape) {
                    shapeUpdates.push(shapePartial);
                } else {
                    shapeCreates.push(shapePartial);
                }
            });

            if (assetsToCreate.length > 0) {
                editor.createAssets(assetsToCreate);
            }
            if (assetUpdates.length > 0) {
                editor.updateAssets(assetUpdates);
            }
            if (shapeCreates.length > 0) {
                editor.createShapes(shapeCreates);
            }
            if (shapeUpdates.length > 0) {
                editor.updateShapes(shapeUpdates);
            }

            const selectedShapeId = conversation.selectedAssetId ? getTlShapeId(conversation.selectedAssetId) : null;
            if (selectedShapeId && editor.getShape(selectedShapeId)) {
                editor.select(selectedShapeId);
            } else {
                editor.selectNone();
            }

            editor.setCamera({
                x: conversation.viewport.x,
                y: conversation.viewport.y,
                z: conversation.viewport.scale,
            });
        } finally {
            window.setTimeout(() => {
                syncLockRef.current = false;
            }, 0);
        }
    };

    useEffect(() => {
        if (activeConversation) {
            syncConversationToEditor(activeConversation);
        }
    }, [activeConversation]);

    const syncConversationFromEditor = () => {
        const editor = editorRef.current;
        const conversation = activeConversationRef.current;
        if (!editor || !conversation || syncLockRef.current) {
            return;
        }

        const flush = () => {
            rafSyncRef.current = null;
            const pageId = getPageId(conversation.id);
            if (editor.getCurrentPageId() !== pageId) {
                return;
            }

            const camera = editor.getCamera();
            const selectedShape = editor.getSelectedShapes().find(isCanvasShape);
            const shapeMap = new Map(
                editor.getCurrentPageShapes()
                    .filter(isCanvasShape)
                    .map((shape) => [shape.id, shape]),
            );

            updateConversationById(conversation.id, (currentConversation) => ({
                ...currentConversation,
                selectedAssetId: selectedShape
                    ? currentConversation.assets.find((asset) => getTlShapeId(asset.id) === selectedShape.id)?.id || null
                    : null,
                viewport: {
                    x: camera.x,
                    y: camera.y,
                    scale: camera.z,
                },
                assets: currentConversation.assets.map((asset) => {
                    const shape = shapeMap.get(getTlShapeId(asset.id));
                    if (!shape || !isCanvasShape(shape)) {
                        return asset;
                    }

                    return {
                        ...asset,
                        x: shape.x,
                        y: shape.y,
                        width: typeof shape.props.w === 'number' ? shape.props.w : asset.width,
                        height: typeof shape.props.h === 'number' ? shape.props.h : asset.height,
                    };
                }),
            }));
        };

        if (rafSyncRef.current !== null) {
            window.cancelAnimationFrame(rafSyncRef.current);
        }
        rafSyncRef.current = window.requestAnimationFrame(flush);
    };

    const bindEditor = (editor: Editor) => {
        editorRef.current = editor;
        editor.on('change', syncConversationFromEditor);
        editor.on('event', (info) => {
            if ((info as any)?.name !== 'double_click') {
                return;
            }

            const conversation = activeConversationRef.current;
            if (!conversation) {
                return;
            }

            const selectedShape = editor.getSelectedShapes().find(isCanvasShape);
            if (!selectedShape || selectedShape.type !== 'image') {
                return;
            }

            const matchedAsset = conversation.assets.find((asset) => getTlShapeId(asset.id) === selectedShape.id);
            if (matchedAsset) {
                insertReferenceFromAsset(matchedAsset);
            }
        });
        editor.setCurrentTool('select');

        if (activeConversationRef.current) {
            syncConversationToEditor(activeConversationRef.current);
        }
    };

    const submit = async () => {
        if (!activeConversation || loading) {
            return;
        }

        const prompt = activeConversation.composerText.trim();
        if (!prompt) {
            return;
        }

        const mode: IWorkspaceGenerationRequest['mode'] = activeConversation.composerReference ? 'image_to_video' : 'text_to_image';
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

    const startDividerDragging = (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (window.innerWidth <= 1100) {
            return;
        }

        resizeStateRef.current = { dragging: true };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        event.preventDefault();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
        }
    };

    const usePrompt = (prompt: string) => {
        setComposerText(prompt);
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

    if (!activeConversation) {
        return null;
    }

    return (
        <div className='workspace-page'>
            <div className='workspace-shell' ref={frameRef}>
                <section className='workspace-panel workspace-stage' style={{ width: `${stageWidth}%` }}>
                    <div className='workspace-stage-inner'>
                        <div className='workspace-panel-bar'>
                            <div>
                                <div className='workspace-panel-kicker'>Canvas</div>
                                <h1 className='workspace-panel-title'>创作画布</h1>
                                <div className='workspace-panel-copy'>
                                    左侧已经切成无限画布内核。你可以像创作工具一样自由平移、缩放、拖动和缩放素材，后续会继续往多选、分组、排版和时间轴方向扩展。
                                </div>
                            </div>
                            <div className='workspace-chip-row'>
                                <div className='workspace-chip workspace-chip-strong'>Infinite Canvas</div>
                                <div className='workspace-chip'>{activeConversation.assets.length} Assets</div>
                                <div className='workspace-chip'>
                                    {Math.round(activeConversation.viewport.scale * 100)}%
                                </div>
                            </div>
                        </div>
                        <div className='workspace-stage-toolbar'>
                            <div className='workspace-stage-toolbar-copy'>
                                {selectedAsset ? `已选中：${selectedAsset.prompt}` : '使用鼠标滚轮缩放，按住空白区域拖动视口，点击素材后可自由编辑'}
                            </div>
                            <div className='workspace-stage-toolbar-actions'>
                                <button
                                    className='workspace-button workspace-button-ghost workspace-button-small'
                                    disabled={!selectedAsset || selectedAsset.type !== 'image'}
                                    onClick={() => selectedAsset && insertReferenceFromAsset(selectedAsset)}
                                    type='button'
                                >
                                    @ 添加引用
                                </button>
                                <button
                                    className='workspace-button workspace-button-primary workspace-button-small'
                                    disabled={!selectedAsset}
                                    onClick={() => selectedAsset && downloadAsset(selectedAsset)}
                                    type='button'
                                >
                                    下载素材
                                </button>
                            </div>
                        </div>
                        <div className='workspace-stage-frame workspace-stage-frame-canvas'>
                            <div className='workspace-tldraw-shell'>
                                <Tldraw
                                    autoFocus={false}
                                    hideUi
                                    onMount={bindEditor}
                                />
                            </div>
                            {activeConversation.assets.length === 0 ? (
                                <div className='workspace-stage-empty workspace-stage-empty-overlay'>
                                    左侧画布区暂时留白
                                    <span>从右侧输入一句文案，先生成第一张图片开始。</span>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </section>
                <div className='workspace-divider' role='separator' aria-orientation='vertical'>
                    <button
                        aria-label='调整画布与侧边栏宽度'
                        className='workspace-divider-handle'
                        onPointerDown={startDividerDragging}
                        type='button'
                    />
                </div>
                <section className='workspace-panel workspace-chat'>
                    <header className='workspace-chat-header'>
                        <div className='workspace-chat-topbar'>
                            <div>
                                <div className='workspace-panel-kicker'>Sidebar</div>
                                <h2 className='workspace-chat-title'>AI Sidebar</h2>
                                <div className='workspace-chat-subtitle'>
                                    侧边栏当前聚焦在两个 MVP 能力：文生图，以及基于被引用图片生成视频。
                                </div>
                            </div>
                            <button className='workspace-button workspace-button-ghost workspace-button-small' onClick={resetConversation} type='button'>
                                新会话
                            </button>
                        </div>
                        <div className='workspace-chat-status'>
                            <div className={`workspace-status-pill ${config?.imageConfigured ? 'workspace-status-ready' : ''}`}>
                                <span className='workspace-status-dot' />
                                Image {config?.imageConfigured ? 'Ready' : 'Not Ready'}
                            </div>
                            <div className={`workspace-status-pill ${config?.videoConfigured ? 'workspace-status-ready' : ''}`}>
                                <span className='workspace-status-dot' />
                                Video {config?.videoConfigured ? 'Ready' : 'Not Ready'}
                            </div>
                            <div className='workspace-status-pill'>
                                <span className='workspace-status-dot' />
                                Model {config?.imageModel || config?.videoModel || 'Not Set'}
                            </div>
                        </div>
                        <div className='workspace-conversation-list'>
                            {conversations.slice(0, 6).map((conversation) => (
                                <button
                                    className={`workspace-conversation-card ${conversation.id === activeConversationId ? 'workspace-conversation-card-active' : ''}`}
                                    key={conversation.id}
                                    onClick={() => openConversation(conversation.id)}
                                    type='button'
                                >
                                    <span className='workspace-conversation-title'>{conversation.title}</span>
                                    <span className='workspace-conversation-time'>{conversation.updatedAt}</span>
                                </button>
                            ))}
                        </div>
                        {activeConversation.messages.length <= 1 ? (
                            <div className='workspace-starter-grid'>
                                {starterPrompts.map((prompt) => (
                                    <button
                                        className='workspace-starter-card'
                                        key={prompt}
                                        onClick={() => usePrompt(prompt)}
                                        type='button'
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </header>
                    <div className='workspace-messages' ref={messagesRef}>
                        {activeConversation.messages.map((item) => (
                            <div className={`workspace-message-row workspace-message-row-${item.role}`} key={item.id}>
                                <div className='workspace-message-meta'>
                                    <span className='workspace-message-role'>
                                        {item.role === 'user' ? 'You' : 'AI'}
                                    </span>
                                    <span className='workspace-message-time'>{item.createdAt}</span>
                                </div>
                                <div className={`workspace-message workspace-message-${item.role} ${item.status === 'failed' ? 'workspace-message-failed' : ''}`}>
                                    {item.content}
                                </div>
                                <button
                                    className='workspace-message-action'
                                    onClick={() => copyMessage(item.content)}
                                    type='button'
                                >
                                    复制
                                </button>
                            </div>
                        ))}
                    </div>
                    <footer className='workspace-composer'>
                        <div className='workspace-composer-reference-row'>
                            {activeConversation.composerReference ? (
                                <div className='workspace-reference-token'>
                                    <span className='workspace-reference-token-label'>@ {activeConversation.composerReference.name}</span>
                                    <button
                                        className='workspace-reference-token-remove'
                                        onClick={() => setComposerReference(null)}
                                        type='button'
                                    >
                                        清除
                                    </button>
                                </div>
                            ) : (
                                <div className='workspace-composer-reference-empty'>未引用图片时默认执行文生图。</div>
                            )}
                        </div>
                        <textarea
                            className='workspace-textarea'
                            onChange={(event) => setComposerText(event.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder={activeConversation.composerReference ? '描述你想基于这张图生成什么样的视频...' : '输入你的图片创作需求，Enter 直接发送。'}
                            value={activeConversation.composerText}
                        />
                        <div className='workspace-composer-row'>
                            <div className='workspace-composer-actions'>
                                <button
                                    className='workspace-button workspace-button-primary'
                                    disabled={loading}
                                    onClick={submit}
                                    type='button'
                                >
                                    {loading ? '生成中...' : activeConversation.composerReference ? '生成视频' : '生成图片'}
                                </button>
                            </div>
                            <div className='workspace-composer-tip'>
                                Enter 发送，Shift + Enter 换行。双击已选中的图片可加入 `@` 引用。
                            </div>
                        </div>
                    </footer>
                </section>
            </div>
            {notice ? <div className='workspace-toast'>{notice}</div> : null}
        </div>
    );
};
