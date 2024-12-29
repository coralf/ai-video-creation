import { useMemo } from 'react';
import { SettingProvider } from './context';
import { SettingController } from './setting-controller';
import { SettingMain } from './setting-main';
import { useController } from '../../context/dependency-injection-context';



export const SettingPage = () => {

    const controller = useController<SettingController>(SettingController.name);


    return <div>
        <SettingMain />
    </div>
}
