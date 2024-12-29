import { Layout, theme } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { matchPath, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useDefaultRouterMenu, useRouterMenus } from '../config/hooks';
import { SiderMenu } from './sider-menu';
import { log } from 'console';
import { IRouterMenu } from '../config/router-menu-config';
import { useRouterController } from '../../controllers/router-controller';

const { Header, Sider, Content } = Layout;

export const MainLayout = (props: any) => {
    const [collapsed, setCollapsed] = useState(false);
    const {
        token: { colorBgContainer },
    } = theme.useToken();
    const navigate = useNavigate();
    const defaultRouterMenu = useDefaultRouterMenu();
    const location = useLocation();
    const routerMenus = useRouterMenus();
    const path = useMemo(() => routerMenus.find(item => matchPath(item.path, location.pathname))?.path || defaultRouterMenu?.path, [location])
    const [currentSelectMenuKey, setCurrentSelectMenuKey] = useState(path);
    const routerController = useRouterController()
    const toLink = (path: string) => {
        navigate(path);
    };

    const handleMenuClick = (item: IRouterMenu) => {
        const router = item.children?.find(router => router.defaultRouter)
        toLink(router?.path || item.path);
        setCurrentSelectMenuKey(item.key);
    };

    useEffect(() => {
        if (location.pathname?.length > 1) {
            routerController?.push(location.pathname)
        }
    }, [location])


    useEffect(() => {
        routerController.setLocaltion(location);
        if (location.pathname === '/') {
            const router = defaultRouterMenu?.children?.find(item => item.defaultRouter);
            toLink(router?.path!)
        }
    }, [])


    return (
        <Layout style={{ height: 'calc(100vh - 26px)' }}>
            <Sider
                // breakpoint="lg"
                // collapsedWidth="0"
                trigger={null}
                collapsible
                width={'3%'}
                style={{ backgroundColor: '#1f1f1f' }}
                collapsed={collapsed}>
                <SiderMenu
                    menuItems={routerMenus}
                    selectedItemKey={currentSelectMenuKey!}
                    onMenuItemClick={handleMenuClick}
                />
            </Sider>
            <Layout>
                <Content
                    style={{
                        padding: '12px 8px 8px 8px',
                        minHeight: 280,
                        overflow: 'hidden',
                        background: colorBgContainer,
                    }}
                >
                    <Outlet />
                </Content>
            </Layout>
        </Layout>

    );
};

