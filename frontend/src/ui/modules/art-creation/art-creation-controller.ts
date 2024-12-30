import { useAppProps } from 'antd/es/app/context';
import { omit } from 'lodash';
import { IReactionDisposer, makeAutoObservable, observable } from 'mobx';
import { v4 } from 'uuid';

import { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

import { Autowired, Bean, CreateBeanManager, IocContainer } from '../../../common/ioc-manager';
import { copyToClipboard, isAvailableString, toJSON } from '../../utils/utils';
import { ArtCreationStore, IEditTableDataItem, IImage } from './art-creation-store';
import { DEFAULT_RANDOM_SEED } from '../../../common/constants';
import { getProjectById, requestGenerateVideo, saveStoryboards } from '../../../api';
import { IImageModel, IProjectModel } from '../../../declare/project';
import { request } from '../../../common/request';
import { IOptions } from '../../context/dependency-injection-context';

export interface IArtCreationOptions {
    params?: any
}

@Bean
export class ArtCreationController {
    public disposers: IReactionDisposer[] = [];


    public project?: IProjectModel;


    private artCreationStore = new ArtCreationStore()

    @Autowired
    public options!: IOptions;

    private selfOptions: IArtCreationOptions = {}

    public get notificationApi() {
        return this.options?.antApi.notification;
    }



    public constructor() {
        makeAutoObservable(this);
    }



    private get antApi() {
        return this.options?.antApi;
    }



    public async init(options: IArtCreationOptions) {
        try {
            this.selfOptions = options
            const id = options.params.id;
            const { data } = await getProjectById(id)
            this.project = data
            const editTableDataSource = this.project?.storyboards.map(item => {
                return {
                    id: item.id,
                    prompts: item.prompts,
                    image: item.image,
                    randomSeed: item.seed,
                    writingText: item.subtitle
                }
            })
            this.artCreationStore.setStore({
                editTableDataSource
            })
        } catch (e) {
            console.error(e);
        }
    }


    public refresh() {
        return this.init(this.selfOptions)
    }


    public get store() {
        return this.artCreationStore.getStore();
    }



    public saveSlient = async () => {
        const storyboards = this.store.editTableDataSource.map(item => {
            return {
                id: item.id,
                image: item.image?.id && {
                    id: item.image?.id,
                    name: item.image.name,
                    url: item.image?.url
                },
                subtitle: item.writingText,
                prompts: item.prompts,
                seed: item.randomSeed
            }
        })
        await saveStoryboards({
            projectId: this.project?.id,
            storyboards
        })
    }


    public save = async () => {
        this.showLoading(true, '正在保存');
        await this.saveSlient();
        this.showLoading(false);
        this.antApi.message.success('保存成功');
    };

    public addRow() {
        const nextData = this.store.editTableDataSource.slice();
        nextData.push({ id: v4(), randomSeed: DEFAULT_RANDOM_SEED });
        this.artCreationStore.setStore({
            editTableDataSource: nextData,
        });
        setTimeout(() => {
            const tableBody =
                document.getElementsByClassName('ant-table-body')[0];
            tableBody.scrollTo({
                top: tableBody.scrollHeight,
                behavior: 'smooth',
            });
        });
    }

    public addRowTo(rowData: IEditTableDataItem) {
        const nextData = this.store.editTableDataSource.slice();
        const index = nextData.findIndex((item) => item.id === rowData.id);
        if (index !== -1) {
            nextData.splice(index + 1, 0, {
                id: v4(),
                randomSeed: DEFAULT_RANDOM_SEED,
            });
            this.artCreationStore.setStore({
                editTableDataSource: nextData,
            });
        }
    }

    public handleCellValueChange(
        changedValue: IEditTableDataItem[keyof IEditTableDataItem],
        rowData: IEditTableDataItem,
        dataIndex: keyof IEditTableDataItem,
    ) {
        const nextData = this.store.editTableDataSource.slice();
        const changeIndex = nextData.findIndex(
            (item) => item.id === rowData.id,
        );
        if (changeIndex === -1) return;
        const changeRowItem = { ...nextData[changeIndex], [dataIndex]: changedValue };
        nextData.splice(changeIndex, 1, changeRowItem);
        this.artCreationStore.setStore({
            editTableDataSource: nextData,
        });
    }

    public delRow = (record: IEditTableDataItem) => {
        const nextData = this.store.editTableDataSource.slice();
        const delIndex = nextData.findIndex((item) => item.id === record.id);
        if (delIndex !== -1) {
            nextData.splice(delIndex, 1);
            this.artCreationStore.setStore({
                editTableDataSource: nextData,
            });
        }
    };






    /**
     * update the view with the given data, can be batch or single
     *
     * @param {IEditTableDataItem[]} data - The data to update the view with.
     */
    public updateView(data: IEditTableDataItem[]) {
        // 批量
        if (data?.length > 1) {
            this.artCreationStore.setStore({
                editTableDataSource: data,
            });
        } else if (data?.length === 1) {
            // 单个
            const newData = this.store.editTableDataSource.slice();
            const rowItem = data[0];
            const index = newData.findIndex((item) => item.id === rowItem.id);
            newData[index] = rowItem;
            this.artCreationStore.setStore({
                editTableDataSource: newData,
            });
        }
    }



    public exportJianYingProject = async (mediaPaths: object) => {
        // this.showLoading(true, '正在导出剪映项目');
        // this.showLoading(false);
        // this.antApi.message.success('导出剪映项目成功');
    };

    public showLoading(loading: boolean, text: string = '正在加载') {
        const spinning = loading;
        const options = {
            spinning,
            tip: spinning ? text : '',
        };
        this.artCreationStore.setStore({
            spinProps: options,
        });
    }

    public handleDragEnd = (options: DragEndEvent) => {
        const { active, over } = options;
        if (active.id !== over?.id) {
            const previousData = this.store.editTableDataSource.slice();
            const activeIndex = previousData.findIndex(
                (i) => i.id === active.id,
            );
            const overIndex = previousData.findIndex((i) => i.id === over?.id);
            const nextData = arrayMove(previousData, activeIndex, overIndex);
            this.artCreationStore.setStore({
                editTableDataSource: nextData,
            });
        }
    };

    public delRowBy = (data: IEditTableDataItem) => {
        this.delRow(data);
    };

    public setRowItemLoraPrompts = (loraModels: any[], rowData: any) => {
        const editTableDataSource =
            this.store.editTableDataSource?.slice() || [];
        const rowIndex = editTableDataSource.findIndex(
            (item) => item.id === rowData.id,
        );
        if (rowIndex !== -1) {
            editTableDataSource[rowIndex].loras = loraModels;
            this.artCreationStore.setStore({
                editTableDataSource,
            });
        }
    };

    public copyText = () => {
        const text = this.store.editTableDataSource
            ?.map((item) => item.writingText?.trim())
            .join('\n');
        copyToClipboard(text || '');
        this.antApi.message.success('已将文案复制到剪贴板');
    };

    public importText = () => {
        navigator.clipboard
            .readText()
            .then((text) => {
                const nextData = this.store.editTableDataSource.slice();
                text.split('\n').forEach((segmentText) => {
                    const multiTextInOneSegment = segmentText
                        ?.replaceAll(',', '\n')
                        .replaceAll('，', '\n')
                        .trim();
                    nextData.push({
                        id: v4(),
                        writingText: multiTextInOneSegment || segmentText,
                        loras: [],
                        prompts: '',
                        negativePrompts: '',
                        randomSeed: DEFAULT_RANDOM_SEED,
                    });
                });
                this.artCreationStore.setStore({
                    editTableDataSource: nextData,
                });
            })
            .catch((err) => {
                console.error('Unable to read text from clipboard', err);
                this.antApi.message.warning('请复制文案');
            });
    };


    public generateVideo = async () => {
        try {
            this.showLoading(true, '正在生成视频');
            await requestGenerateVideo({
                projectId: this.project?.id
            })
            await this.refresh()
            this.notificationApi.success({ message: '生成视频成功' });
        } catch (e: any) {
            console.error(e);
            this.antApi.message.error(e.message);
        } finally {
            this.showLoading(false);
        }
    }

    public textToImage = async (record: IEditTableDataItem) => {

        try {
            const storyboard = toJSON(record) as IEditTableDataItem;
            if (!isAvailableString(storyboard.prompts)) {
                this.antApi.message.error('请输入提示词');
                return;
            }
            await this.generateImage(toJSON(record));
            await this.saveSlient();
        } catch (e) {
            console.error(e);
        }

    };





    private validateBatchToImage = (storyboards: IEditTableDataItem[]) => {
        storyboards.forEach((storyboard, index) => {
            if (!isAvailableString(storyboard.prompts)) {
                throw new Error(`第${index + 1}行，请输入提示词`);
            }
        })
    };

    public batchToImage = async () => {
        const progressKey = '1';
        try {
            this.validateBatchToImage(this.store.editTableDataSource);
            await this.batchTextToImage(
                toJSON(this.store.editTableDataSource),
            );
            this.notificationApi.success({
                message: '批量生成图片成功',
                description: '批量生成图片成功',
                duration: null
            })
        } catch (err: unknown) {
            console.error(err);
            if (err instanceof Error) {
                this.antApi.message.error(err.message);
            }
        } finally {
            this.notificationApi.destroy(progressKey);
        }


    };

    public async generateImage(data: IEditTableDataItem) {
        const nextEditTableDataItem = data;
        const nextImage: IImage = {
            ...nextEditTableDataItem.image!,
            loading: true,
        };
        nextEditTableDataItem.image = nextImage;
        this.updateView([nextEditTableDataItem]);
        const image = await this.requestTextToImage(nextEditTableDataItem);
        nextImage.id = image.id;
        nextImage.name = image.name;
        nextImage.url = image.url;
        nextImage.loading = false;
        nextEditTableDataItem.image = nextImage;
        this.updateView([nextEditTableDataItem]);
    }


    public upscaleImage = async (options: { imageData: any }) => {
        const formData = new FormData();
        formData.append('file', options.imageData);
        const { data } = await request.post("/text-to-image/upscale", formData, { responseType: 'arraybuffer' });
        return new Uint8Array(data)
    };

    private async requestTextToImage(item: IEditTableDataItem) {
        const { data } = await request.post<IImageModel>("/text-to-image/generate", {
            prompt: item.prompts,
            width: 1024,
            height: 1024,
            num_inference_steps: 32,
            guidance_scale: 5.0,
            num_images_per_prompt: 1,
            seed: item.randomSeed || 50,
        })
        return data
    }


    public async batchTextToImage(dataSource: IEditTableDataItem[]) {
        for (const item of dataSource) {
            await this.generateImage(item);
        }
        return this.saveSlient();
    }


    public handleCellBlur = (options: any, record: IEditTableDataItem, fieldName: string) => {
        this.saveSlient();
    }
}
