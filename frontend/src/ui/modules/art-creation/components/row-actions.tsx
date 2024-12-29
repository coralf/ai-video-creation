import { Button, Flex, Popconfirm, Tooltip } from 'antd';
import React from 'react';
import { observer } from 'mobx-react-lite';
import { useArtCreationController } from '../hooks';
import { IEditTableDataItem } from '../art-creation-store';

export interface IRowActionsProps {
    record: IEditTableDataItem;
}


export const RowActions = observer((props: IRowActionsProps) => {
    const { record } = props;

    const controller = useArtCreationController();

    const handleDel = () => {
        controller.delRow(record);
    };

    const textToImage = () => {
        controller.textToImage(record);
    };


    return <Flex vertical gap="middle" style={{ padding: '0 8px' }}>
        <Button onClick={textToImage} disabled={record.loading}>{record.loading ? '排队中' : '生图'}</Button>
        {/* <Tooltip title={record.image?.isHrImage ? '已经是高清画质' : ''}>
            <Button onClick={highImage} disabled={record.image?.loading || record.image?.isHrImage}>高清</Button>
        </Tooltip> */}
        <Popconfirm
            title="确定删除？"
            onConfirm={handleDel}
            okText="是"
            cancelText="否"
        >
            <Button danger disabled={record.loading}>删除</Button>
        </Popconfirm>
    </Flex>

});
