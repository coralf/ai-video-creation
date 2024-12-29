import { Button, Flex, Form, message, Modal, Upload } from 'antd';
import { UploadFile } from 'antd/es/upload/interface';
import React, { useState } from 'react';

import { InboxOutlined } from '@ant-design/icons';

import { useArtCreationController } from '../hooks';

import type { UploadProps } from 'antd';
const { Dragger } = Upload;
export interface IDragUpload {
    text: string;
    value?: any;
    onChange?: (value: any) => void;
    accept: string;
    supportFileDescription: string;
}

export const DragUpload = (props: IDragUpload) => {
    const { text, value, accept, supportFileDescription } = props;
    const draggerUpdaloadProps: UploadProps = {
        accept,
        name: 'file',
        multiple: false,
        maxCount: 1,
        fileList: value && [value] || [],
        beforeUpload() {
            return false;
        },
        onChange: (info) => {
            props.onChange?.(info.fileList?.[0]?.originFileObj);
        },
        onDrop(e) {
            const file = e.dataTransfer.files[0];
            props.onChange?.(file);
        },
        onRemove(file: UploadFile) {
            props.onChange?.(null);
        }
    };

    return <Flex gap={'large'} align={'center'} justify={'center'}>
        <div style={{ width: '100%' }}>
            <Dragger {...draggerUpdaloadProps}>
                <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽{text}文件到这里</p>
                <p className="ant-upload-hint">
                    支持 {supportFileDescription} 文件
        </p>
            </Dragger>
        </div>
    </Flex>;
};



export const ExportJianyingProject = () => {
    const controller = useArtCreationController();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();


    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            await controller.exportJianYingProject({
                audio: values['audio'].path,
                srt: values['srt'].path,
            });
            setIsModalVisible(false);
            form.resetFields();
        } catch (e) {
            console.error(e);
        }
    };

    const handleCancel = () => {
        setIsModalVisible(false);
    };

    const handleClick = async () => {
        await controller.exportJianYingProject({
            // audio: values['audio'].path,
            // srt: values['srt'].path,
        });
        // setIsModalVisible(true);
    };

    return <div>
        <Button onClick={handleClick}>导出剪映项目</Button>
        <Modal
            centered
            width={600}
            maskClosable={false}
            title="导出剪映项目"
            open={isModalVisible}
            onOk={handleOk}
            okText={'导出'}
            onCancel={handleCancel}
            cancelText={'取消'}
        >
            <div style={{ padding: 12 }}>
                <Form
                    form={form}
                    labelCol={{ span: 4 }}
                    wrapperCol={{ span: 18 }}
                    layout="horizontal"
                >
                    <Form.Item label="字幕" name="srt" rules={[{ required: true, message: '请选择字幕文件' }]}>
                        <DragUpload text={'字幕'} supportFileDescription={'.srt'} accept={'.srt'} />
                    </Form.Item>
                    <Form.Item label="音频" name="audio" rules={[{ required: true, message: '请选择音频文件' }]}>
                        <DragUpload text={'音频'} supportFileDescription={'.wav .mp3'} accept={'audio/wav,audio/mpeg'} />
                    </Form.Item>
                </Form>
            </div>
        </Modal>
    </div>;
};
