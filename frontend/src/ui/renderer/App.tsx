import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ConfigProvider, message, Result, theme, App as AntApp } from 'antd';
import './App.css';
import { MainLayout } from '../routers/layout';
import { useRouterMenus } from '../routers/config/hooks';
import { AppContext, AppContextProvider } from './app-context';
import { AppHeader } from './app-header';
import React from 'react';
import { AppProvider, DependencyInjectionProvider } from '../context/dependency-injection-context';


export default function App() {
    const routers = useRouterMenus();

    return (
        <ConfigProvider
            theme={{
                algorithm: [theme.darkAlgorithm, theme.compactAlgorithm],
            }}
        >

            <AntApp>
                <AppProvider>
                    <AppHeader />
                    <BrowserRouter>
                        <Routes>
                            <Route path="/" element={<MainLayout />}>
                                {routers.map((item) => {
                                    return <Route key={item.path} path={item.path} element={item.routerElement} >
                                        {item.children?.map(sub => {
                                            return <Route key={sub.path} path={sub.path} index={sub.defaultRouter} element={sub.routerElement} />
                                        })}
                                    </Route>;
                                })}
                                <Route path="*" element={
                                    <Result
                                        status="404"
                                        title="页面未找到"
                                    />
                                } />
                            </Route>
                        </Routes>
                    </BrowserRouter>
                </AppProvider>
            </AntApp>
        </ConfigProvider>
    );
}
