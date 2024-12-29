import React from 'react';

import { AppstoreAddOutlined, SettingOutlined } from '@ant-design/icons';

import { ArtCreationPage } from '../../modules/art-creation';
import { SettingPage } from '../../modules/setting';
import { StartCreation } from '../../modules/art-creation/start-creation';
import { CreationLayout } from '../../modules/art-creation/creation-layout';

export interface IRouterMenu {
    path: string;
    icon: React.ReactNode;
    label: string;
    key?: string;
    // 是否是默认路由
    defaultRouter?: boolean;
    routerElement?: React.ReactNode;
    hidden?: boolean;
    children?: IRouterMenu[]
}

export enum ERouterPath {
    Setting = '/setting',
    Creation = '/creation',
    CreationStart = ERouterPath.Creation + '/creation-start',
    ArtCreation = ERouterPath.Creation + '/art-creation/:id',
}

export const routes: IRouterMenu[] = [
    {
        path: ERouterPath.Creation,
        icon: <AppstoreAddOutlined />,
        label: '创作',
        defaultRouter: true,
        routerElement: <CreationLayout path={ERouterPath.Creation} />,
        children: [
            {
                path: ERouterPath.CreationStart,
                icon: <AppstoreAddOutlined />,
                label: '开始',
                defaultRouter: true,
                routerElement: <StartCreation />
            },
            {
                path: ERouterPath.ArtCreation,
                icon: <AppstoreAddOutlined />,
                label: '创作',
                routerElement: <ArtCreationPage />
            },
        ]
    },
    {
        path: ERouterPath.Setting,
        icon: <SettingOutlined />,
        label: '设置',
        routerElement: <SettingPage />
    }
];


