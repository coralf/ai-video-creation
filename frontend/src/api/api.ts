import { request } from "../common/request"
import type {
    IWorkspaceGenerationRequest,
    IWorkspaceGenerationResponse,
    IWorkspaceMessage,
} from "../types/workspace";

const API_BASE_URL = 'http://localhost:8085';

export interface IWorkspaceConfigResponse {
    chatConfigured: boolean;
    imageConfigured: boolean;
    videoConfigured: boolean;
    chatModel?: string;
    imageModel?: string;
    imageEndpoint?: string;
    videoModel?: string;
    videoEndpoint?: string;
}

export interface IChatResponse {
    message: IWorkspaceMessage;
}

export interface IGenerateImageResponse {
    assetId: string;
    prompt: string;
    imageUrl?: string;
    imageDataUrl?: string;
    raw?: Record<string, unknown>;
}

export const getWorkspaceConfig = async () => {
    const { data } = await request.get<IWorkspaceConfigResponse>('/workspace/config');
    return data;
}

export const sendChatMessage = async (messages: IWorkspaceMessage[]) => {
    const { data } = await request.post<IChatResponse>('/workspace/chat', { messages });
    return data;
}

export const streamChatMessage = async (
    messages: IWorkspaceMessage[],
    options: { onDelta: (delta: string) => void }
) => {
    const response = await fetch(`${API_BASE_URL}/workspace/chat/stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
    });

    if (!response.ok || !response.body) {
        let detail = '流式对话请求失败';
        try {
            const error = await response.json();
            detail = error?.detail || detail;
        } catch {
            // noop
        }
        throw new Error(detail);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';

    while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        events.forEach((event) => {
            const line = event
                .split('\n')
                .find((item) => item.startsWith('data: '));

            if (!line) {
                return;
            }

            const payload = JSON.parse(line.slice(6));
            if (payload.delta) {
                content += payload.delta;
                options.onDelta(payload.delta);
            }
        });

        if (done) {
            break;
        }
    }

    return content;
}

export const generateWorkspaceImage = async (prompt: string) => {
    const { data } = await request.post<IGenerateImageResponse>('/workspace/images', { prompt });
    return data;
}

export const generateWorkspaceAsset = async (payload: IWorkspaceGenerationRequest) => {
    const { data } = await request.post<IWorkspaceGenerationResponse>('/workspace/generate', payload);
    return data;
}
