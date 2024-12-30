import { Button, message, Modal, notification, Popconfirm, Progress, Space, Tooltip } from 'antd';
import { useAppProps } from 'antd/es/app/context';
import { observer } from 'mobx-react-lite';

import { useArtCreationController } from '../hooks';
import { ExportJianyingProject } from './export-jianying-project';
import { useState } from 'react';
import ReactPlayer, { ReactPlayerProps } from 'react-player';
import { url } from 'inspector';
import { CaretRightOutlined } from '@ant-design/icons';

export const ProgressFormat = observer(() => {
    const controller = useArtCreationController();
    return <Progress {...controller?.store?.progressProps} />
})

export const useBatchTextToImage = () => {
    const controller = useArtCreationController();

    const handleBatchImage = () => {
       
        controller.batchToImage()
            
        // api.info({
        //     key: progressKey,
        //     message: `批量生成图片中`,
        //     description: <ProgressFormat />,
        //     placement: 'topRight',
        //     closeIcon: false,
        //     duration: null
        // });
    };

    return handleBatchImage;
};
export const Actions = observer(() => {
    const controller = useArtCreationController();
    const batchTextToImage = useBatchTextToImage();
    const handleSave = () => {
        controller.save();
    };

    const importTextDesc = (
        <div style={{ color: '#ff7875', zIndex: 2 }}>
            <p>
                一键导入文案会根据剪切板上复制的文本
            </p>
            <p>
                按每一行创建一条分镜
            </p>
            <p>
                以逗号分隔文案会展示在一个分镜里面
            </p>
        </div>
    );

    return <Space>
        <Popconfirm
            placement={'right'}
            title="一键导入文案？"
            description={importTextDesc}
            onConfirm={controller.importText}
            okText="确定导入"
            cancelText="取消"
        >
            <Button>导入文案</Button>
        </Popconfirm>
        <Tooltip title={'复制文案到剪贴板,用于生成音频和字幕'}>
            <Button onClick={controller.copyText}>复制配音文案</Button>
        </Tooltip>
        <Button onClick={batchTextToImage}>批量生图</Button>
        {/* <Button type={'primary'} onClick={handleSave}>保存</Button> */}
    </Space>;
});
