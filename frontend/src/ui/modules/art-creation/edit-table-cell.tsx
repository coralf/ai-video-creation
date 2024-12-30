import { Flex, Image, Input, Select, Spin, InputNumber } from 'antd';
import { observer } from 'mobx-react';
import React from 'react';

import { MultiGridSelect } from '../../components/multi-grid-select';
import { IEditTableDataItem } from './art-creation-store';
import { useArtCreationController } from './hooks';
import { DEFAULT_RANDOM_SEED } from '../../../common/constants';

export const enum InputType {
    TextArea = 'textArea',
    Input = 'input',
    Img = 'img',
    MultiGridSelect = 'multiGridSelect',
    TagSelect = 'tagSelect',
    InputNumber = 'inputNumber',
}


export interface EditableCellProps {
    editing: boolean;
    dataIndex: keyof IEditTableDataItem;
    title: any;
    inputType: InputType,
    record: IEditTableDataItem;
    index: number;
    value: IEditTableDataItem[keyof IEditTableDataItem];
    children: React.ReactNode;
    onCellValueChange: (value: any) => void;
    componentProps?: any;
    onCellBlur?: (options: any) => void;
}

const renderCellItem = (options: EditableCellProps) => {
    const componentMapper = {
        [InputType.TextArea]: () => {
            return <Input.TextArea
                // showCount
                // maxLength={100}
                // defaultValue={options.value || ''}
                value={options.value || ''}
                style={{
                    ...options.componentProps?.style,
                    height: options.componentProps?.style?.height || 150,
                    resize: 'none'
                }}
                onBlur={options.onCellBlur}
                onChange={(v) => options.onCellValueChange(v.target.value || '')}
            />;
        },
        [InputType.Input]: () => {
            return <Input value={options.value || ''}
                onBlur={options.onCellBlur}
                onChange={(v) => options.onCellValueChange(v.target.value || '')}
            />;
        },
        [InputType.InputNumber]: () => {
            return <InputNumber min={1} max={1000000} value={options.value}
                onBlur={options.onCellBlur}
                onChange={(value) => options.onCellValueChange(value)}
            />;
        },
        [InputType.Img]: () => {
            return <Flex justify={'center'}>
                <Spin spinning={options.value?.loading || false}>
                    {options.value?.url ? <Image
                        src={options.value.url}
                        onChange={(v) => options.onCellValueChange(options.value)}
                        width={150}
                        height={150}
                    /> : <div style={{ width: 150, height: 150 }}></div>}
                </Spin>
            </Flex>;
        },
        [InputType.MultiGridSelect]: () => {
            return <Flex justify={'center'}>
                <Spin spinning={options.value?.loading || false}>
                    <MultiGridSelect  {...options} onSelect={options.onCellValueChange} />
                </Spin>
            </Flex>;
        },
        [InputType.TagSelect]: () => {
            return <Select
                allowClear
                mode="tags"
                maxTagCount={100}
                style={{ width: '100%', maxHeight: 150 }}
                placeholder={'请输入或选择画面描述词'}
                onChange={(v) => {
                }}
            />;
        }
    };
    return componentMapper[options.inputType]() || null;
};

export const EditableCell: React.FC<EditableCellProps & { [key: string]: any }> = observer((props) => {

    const {
        editing,
        dataIndex,
        title,
        inputType,
        record,
        index,
        children,
        ...restProps
    } = props;

    const controller = useArtCreationController();

    const handleChange = (value: any) => {
        controller.handleCellValueChange(value, record, dataIndex);
    };

    const handleCellBlur = (options: any) => {
        controller.handleCellBlur(options, record, dataIndex);
    };

    const renderProps: EditableCellProps = {
        ...props,
        ...restProps,
        onCellBlur: handleCellBlur,
        onCellValueChange: handleChange
    };

    if (!props.editing) {
        const { render, ...restCellProps } = restProps
        return (
            <td {...restCellProps} >
                {children}
            </td>
        );
    }

    return (
        <td {...restProps} style={{ padding: 0 }}>
            {renderCellItem(renderProps)}
        </td>
    );
});


