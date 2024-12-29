import { Button, Flex, Typography } from 'antd';
import { observer } from 'mobx-react-lite';

import { ArtCreationTable } from './art-creation-table';
import { Actions } from './components/actions';
import { RowControl } from './components/row-control';
import { PreviewVideoObservered } from './components/preview-video';


export const ArtCreationMain = observer(() => {
    return <Flex gap={'large'}>
        <Flex vertical gap={'large'} flex={4}>
            <Actions />
            <ArtCreationTable />
            <RowControl />
        </Flex>
        <Flex vertical flex={1} >
            <PreviewVideoObservered />
        </Flex>
    </Flex>
});
