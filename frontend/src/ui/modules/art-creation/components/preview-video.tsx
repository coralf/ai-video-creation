
import { Button, Flex, Typography } from 'antd';
import { observer } from 'mobx-react-lite';

import ReactPlayer, { ReactPlayerProps } from 'react-player';
import { ArrowDownOutlined } from '@ant-design/icons';
import { useArtCreationController } from '../hooks';
import { useEffect, useRef, useState } from 'react';
import { log } from 'console';

const { Title } = Typography;


export const PreviewVideoObservered = observer(() => {
    const controller = useArtCreationController();
    const eleRef = useRef<HTMLDivElement | null>(null)
    const [height, setHeight] = useState(0)
    const [borderRadius, setBorderRadius] = useState(0);
    const reactPlayerProps = {
        url: controller.project?.video?.url,
        playing: true,
        controls: true,
        volume: 0.5,
        width: '100%',
        // height: '100%'
    }

    const extractFilenameFromUrl = (url: string) => {
        return url.split('/').pop();
    }

    const triggerFileDownload = async (url: string) => {
        try {
            // Validate input parameters
            if (!url) {
                throw new Error('Invalid URL provided.');
            }

            // Extract filename from URL
            const filename = extractFilenameFromUrl(url);

            // Fetch the file content
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch the file: ${response.statusText}`);
            }

            const blob = await response.blob();

            // Create a temporary <a> element for downloading
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename!;

            // Append the link to the body (required for Firefox)
            document.body.appendChild(link);

            // Programmatically click the link to trigger the download
            link.click();

            // Clean up
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

        } catch (error) {
            console.error('Error during file download:', error);
            throw error; // Re-throw the error so it can be handled by the caller
        }
    }

    const generateVideo = () => {
        controller.generateVideo()
    }





    useEffect(() => {
        if (eleRef.current) {
            const containerWidth = eleRef.current?.offsetWidth
            setHeight(containerWidth * (16 / 9))
            const phonePhysicalBorderRadius = 100; // 物理圆角半径（像素）
            const phoneScreenWidth = 1170;
            const calculatedBorderRadius = (phonePhysicalBorderRadius / phoneScreenWidth) * containerWidth;
            setBorderRadius(calculatedBorderRadius);
        }
    }, [eleRef.current])

    return <div ref={ele => eleRef.current = ele}>
        <Title level={3}>
            预览视频
        </Title>
        <Flex vertical gap={'middle'} justify='center' align='center' >
            <Flex gap={'middle'}>
                <Button onClick={generateVideo} type='primary'>生成视频</Button>
                <Button icon={<ArrowDownOutlined />} onClick={() => triggerFileDownload(reactPlayerProps.url!)}>下载视频</Button>
            </Flex>
            <Flex style={{ width: '100%' }} >
                <Flex style={{ width: '100%', backgroundColor: '#000000', border: '1px solid #FFFFFFD9', borderRadius: borderRadius, height }} justify='center' align='center'>
                    <div style={{ marginTop: '-20%' }}>
                        <ReactPlayer {...reactPlayerProps} />
                    </div>
                </Flex>
            </Flex>
        </Flex>
    </div>
})