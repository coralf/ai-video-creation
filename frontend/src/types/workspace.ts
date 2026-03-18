export type TWorkspaceRole = 'system' | 'user' | 'assistant';

export type TWorkspaceGenerateMode = 'text_to_image' | 'image_to_video';

export type TWorkspaceAssetType = 'image' | 'video';

export type TWorkspaceAssetStatus = 'generating' | 'ready' | 'failed';

export type TWorkspaceMessageStatus = 'pending' | 'done' | 'failed';

export interface IWorkspaceMessage {
    role: TWorkspaceRole;
    content: string;
}

export interface IWorkspaceComposerReference {
    assetId: string;
    type: 'image';
    name: string;
    previewUrl?: string;
    downloadUrl?: string;
}

export interface IWorkspaceViewport {
    x: number;
    y: number;
    scale: number;
}

export interface IWorkspaceAsset {
    id: string;
    type: TWorkspaceAssetType;
    prompt: string;
    status: TWorkspaceAssetStatus;
    createdAt: string;
    previewUrl?: string;
    downloadUrl?: string;
    sourceAssetId?: string;
    width: number;
    height: number;
    x: number;
    y: number;
    errorMessage?: string;
    raw?: Record<string, unknown>;
}

export interface IWorkspaceConversationMessage extends IWorkspaceMessage {
    id: string;
    createdAt: string;
    status?: TWorkspaceMessageStatus;
}

export interface IWorkspaceConversation {
    id: string;
    title: string;
    updatedAt: string;
    messages: IWorkspaceConversationMessage[];
    assets: IWorkspaceAsset[];
    selectedAssetId: string | null;
    viewport: IWorkspaceViewport;
    composerText: string;
    composerReference: IWorkspaceComposerReference | null;
}

export interface IWorkspaceReferencedAsset {
    assetId: string;
    type: TWorkspaceAssetType;
    name?: string;
    previewUrl?: string;
    downloadUrl?: string;
}

export interface IWorkspaceGenerationRequest {
    mode: TWorkspaceGenerateMode;
    text: string;
    referencedAssets: IWorkspaceReferencedAsset[];
    size?: string;
}

export interface IWorkspaceGenerationResult {
    assetId: string;
    type: TWorkspaceAssetType;
    prompt: string;
    status: TWorkspaceAssetStatus;
    createdAt: string;
    previewUrl?: string;
    downloadUrl?: string;
    sourceAssetId?: string;
    raw?: Record<string, unknown>;
}

export interface IWorkspaceGenerationResponse {
    message: IWorkspaceMessage;
    asset: IWorkspaceGenerationResult;
}
