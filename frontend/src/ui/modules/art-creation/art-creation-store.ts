import { ProgressProps, SpinProps } from 'antd';
import { makeAutoObservable } from 'mobx';

import { Bean } from '../../../common/ioc-manager';
import { IMultiGridSelectValue } from '../../components/multi-grid-select';
import { deepMerge } from '../../utils/utils';
import { IImageModel } from '../../../declare/project';

export interface ISdModel {
    label: string;
    key: string;
    value: string;
}

export interface ILoraModel { }

export interface IImage extends IImageModel {
    loading?: boolean;
}

export interface IMultiGridSelect extends IMultiGridSelectValue {
    selectedImage?: string;
    selectedImagePath?: string;
}

export interface ILora {
    key: string;
    weight: number;
    name: string;
    imageUrl: string;
    isSelected?: boolean;
}

export interface IEditTableDataItem {
    id: string;
    // 文案
    writingText?: string;
    // 提示词中文描述
    promptsCn?: string;
    // 上一次的中文描述词
    promptsPreCn?: string;
    // 提示词
    prompts?: string;
    // 图片
    image?: IImage;
    // 四宫格图片
    multiGridSelect?: IMultiGridSelect;
    // 整行加载状态
    loading?: boolean;
    // sd
    sdGenImageData?: any;
    // 反向提示词
    negativePrompts?: string;
    // lora
    loras?: ILora[];
    // 随机种子
    randomSeed: number;
}

export enum EAiPaintingEngine {
    SD = 'sd',
    MJ = 'mj',
}

export interface IDefinePrompt {
    id: string;
    value: string;
    prompts: string;
}

export interface IStore {
    // 页面loading组件
    spinProps: SpinProps;
    // 选中sd模型时加载状态
    editTableDataSource: IEditTableDataItem[];
    progressProps?: ProgressProps;
}

export class ArtCreationStore {
    private store!: IStore;

    public constructor() {
        makeAutoObservable(this);
        this.initStore();
    }

    private initStore() {
        this.store = {
            spinProps: {
                spinning: false,
                tip: '',
            },
            editTableDataSource: [],
        };
    }

    public getStore() {
        return this.store;
    }

    public setStore(partialStore: Partial<IStore>) {
        this.store = deepMerge(this.store, partialStore);
        // console.log('===>nextStore', toJSON(this.store));
    }
}
