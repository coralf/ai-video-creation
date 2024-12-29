import { ArtCreationProvider } from './context';
import { ArtCreationMain } from './art-creation-main';
import { useEffect, useMemo } from 'react';
import { ArtCreationController } from './art-creation-controller';
import { useNavigate, useParams } from 'react-router-dom';
import { App, notification, Spin } from 'antd';
import { useArtCreationController } from './hooks';
import { observer } from 'mobx-react-lite';

export const ArtCreationPage = observer(() => {

    const controller = useArtCreationController()
    const params = useParams()
    const [api, contextHolder] = notification.useNotification();

    useEffect(() => {
        controller?.init({ params })
    }, [])

    return (
        <Spin {...controller.store?.spinProps}>
            <ArtCreationMain />
            {contextHolder}
        </Spin>
    );

});
