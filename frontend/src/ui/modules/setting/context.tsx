import { createContext, useContext } from 'react';
import { SettingController } from './setting-controller';

export const SettingContext = createContext(null);


export const SettingProvider = (props: { children: any; value: any; }) => {
    const { children, value } = props;
    return <SettingContext.Provider value={value}>
        {children}
    </SettingContext.Provider>;
};

export const useSettingController = () => {
    return useContext(SettingContext) as unknown as SettingController
}
