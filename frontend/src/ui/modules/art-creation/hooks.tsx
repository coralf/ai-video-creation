import { ColumnType } from 'antd/es/table';
import React, { useContext } from 'react';

import { ArtCreationController } from './art-creation-controller';
import { IEditTableDataItem } from './art-creation-store';
import { HeadActions } from './components/head-actions';
import { RowActions } from './components/row-actions';
import { ArtCreationContext } from './context';
import { InputType } from './edit-table-cell';
import { AppBeanManager, AppProvider, useController, useDependencyInjectionContext } from '../../context/dependency-injection-context';

export const useArtCreationController = () => {
    return useController<ArtCreationController>(ArtCreationController.name);
};

export const getTableColumnsConfig = () => {
    return [
        {
            key: 'sort',
            width: 18,
            fixed: 'left',
        },
        {
            dataIndex: 'headActions',
            width: 36,
            fixed: 'left',
            render: (_: any, record: IEditTableDataItem) => {
                return <HeadActions data={record} />;
            }
        },
        {
            title: '分镜',
            dataIndex: 'writingText',
            width: 150,
            editing: true,
            inputType: InputType.TextArea
        },
        {
            title: '提示词',
            dataIndex: 'prompts',
            width: 200,
            editing: true,
            inputType: InputType.TextArea
        },
        {
            title: '随机种子',
            dataIndex: 'randomSeed',
            width: 50,
            editing: true,
            inputType: InputType.InputNumber,
            align: 'center',
        },
        {
            title: '画面',
            dataIndex: 'image',
            width: 100,
            editing: true,
            inputType: InputType.Img,
            align: 'center',
        },
        {
            title: '',
            width: 50,
            dataIndex: 'operation',
            align: 'center',
            render: (_: any, record: IEditTableDataItem) => {
                return <RowActions record={record} />;
            }
        },
    ] as ColumnType<IEditTableDataItem>[];
};


export const useTableColumns = () => {
    const configColumns = getTableColumnsConfig();
    return configColumns.map((col: ColumnType<IEditTableDataItem>) => {
        return {
            ...col,
            onCell: (record: IEditTableDataItem) => ({
                ...col,
                record,
                value: record[col.dataIndex as keyof IEditTableDataItem]
            }),
        } as ColumnType<IEditTableDataItem>;
    });

};
