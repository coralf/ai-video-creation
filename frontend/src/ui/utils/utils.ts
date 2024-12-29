import { isArray, mergeWith } from 'lodash';

export function copyToClipboard(text: string) {
    // 创建一个虚拟的 textarea 元素
    const textarea = document.createElement('textarea');
    textarea.value = text;

    // 将 textarea 元素添加到文档中
    document.body.appendChild(textarea);

    // 选择 textarea 中的文本
    textarea.select();

    try {
        // 尝试执行复制命令
        document.execCommand('copy');
        console.log('Text copied to clipboard:', text);
    } catch (err) {
        console.error('Unable to copy text to clipboard', err);
    } finally {
        // 移除虚拟 textarea 元素
        document.body.removeChild(textarea);
    }
}

export const toJSON = (value: any) => {
    if (!value) return value;
    return JSON.parse(JSON.stringify(value));
};

export const getBase64Image = (currentImage: string) => {
    return `data:image/png;base64,${currentImage}`;
};


export const deepMerge = (srcValue: any, value: any) => {
    return mergeWith(srcValue, value, (src, target) => {
        if (isArray(src) && isArray(target)) {
            return target.slice();
        }
        return target;
    });
};


export const getRandomInteger = (min: number, max: number) => {
    // 确保 min 和 max 是整数
    min = Math.ceil(min);
    max = Math.floor(max);
    // 生成随机整数
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

