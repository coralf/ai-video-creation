import { App, AppProps, notification } from 'antd';
import React, { createContext, useContext, useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { ArtCreationController } from '../modules/art-creation/art-creation-controller';
import { CreateBeanManager, IocContainer } from '../../common/ioc-manager';
import { SettingController } from '../modules/setting/setting-controller';
import { RouterController } from '../controllers/router-controller';
import { useAppProps } from 'antd/es/app/context';
import { NotificationInstance } from 'antd/es/notification/interface';


export interface IOptions {
    antApi: useAppProps;
}


export const DependencyInjectionContext = createContext(null);


export const DependencyInjectionProvider = (props: { children: any; value: any; }) => {
    const { children, value } = props;
    return <DependencyInjectionContext.Provider value={value}>
        {children}
    </DependencyInjectionContext.Provider>;
};

export const useDependencyInjectionContext = () => {
    return useContext(DependencyInjectionContext)
}

export const useController = <T extends object>(name: string): T => {
    const context = useDependencyInjectionContext() as unknown as AppBeanManager;
    return context.context?.getBean<T>(name)!;
};

export class AppBeanManager {

    public context?: IocContainer;


    public constructor(options: IOptions) {
        this.init(options);
    }


    private init(options: IOptions) {
        this.context = CreateBeanManager({
            instances: {
                [AppBeanManager.name]: this,
                options
            },
            beans: [
                ArtCreationController,
                RouterController,
                SettingController
            ],
        });
    }


}

export const AppProvider = (props: { children: any; }) => {
    const { children } = props;

    const antApi = App.useApp();
    const [api, contextHolder] = notification.useNotification();


    const options: IOptions = {
        antApi,
    }

    const controller = useMemo(() => new AppBeanManager(options), []);


    return <DependencyInjectionProvider value={controller}>{children}{contextHolder}</DependencyInjectionProvider>
}
