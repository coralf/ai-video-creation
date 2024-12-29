import { Button, Space } from 'antd';
import { useArtCreationController } from '../hooks';

export const RowControl = () => {
    const controller = useArtCreationController();
    return <Space style={{ width: '100%' }} direction={'vertical'} align={'center'}>
        <Button onClick={() => controller.addRow()}>添加一行</Button>
    </Space>;
};
