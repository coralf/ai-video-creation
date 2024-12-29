import { Layout, Breadcrumb, Image, Button, Flex } from "antd"
import { log } from "console"
import { Outlet, useLocation, useNavigate, useRouteLoaderData } from "react-router"
import { useRouterMenus } from "../../routers/config/hooks"
import { MemoryRouter as Router, Link, Route, Routes } from "react-router-dom"
import { matchPath } from "react-router"
import { useEffect, useMemo, useRef, useState } from "react"
import { IRouterMenu } from "../../routers/config/router-menu-config"
import { RightOutlined } from '@ant-design/icons'
import { useController } from "../../context/dependency-injection-context"
import { RouterController } from "../../controllers/router-controller"



export interface ICreationLayoutProps {
    path: string;
}


export const CreationLayout = (props: ICreationLayoutProps) => {

    const routers = useRouterMenus()
    const navigate = useNavigate();
    const routerController = useController<RouterController>(RouterController.name)
    const location = useLocation()


    const subRouters = useMemo(() => {
        const subRouters = routers.find(item => matchPath(item.path, props.path))?.children || [];
        const nextSubRouters = subRouters.filter(item => {
            const historyPath = routerController.routerStack.find(realPath => matchPath(item.path, realPath))
            return !!historyPath || item.defaultRouter
        })
        return nextSubRouters
    }, [location.pathname])

    const defaultRouter = useMemo(() => {
        const historyRouter = subRouters.find(item => matchPath(item.path, location.pathname!))
        const matchRouter = historyRouter || subRouters.find(item => item.defaultRouter)
        return matchRouter
    }, [subRouters, location])

    const [currentSelectRouter, setCurrentSelectRouter] = useState<IRouterMenu>(defaultRouter!)

    const handleClick = (item: IRouterMenu) => {
        setCurrentSelectRouter(item);
        const realPath = routerController?.getRealPath(item.path)
        realPath && navigate(realPath);
    }



    const getColor = (item: IRouterMenu) => {
        return matchPath(item.path, currentSelectRouter?.path) ? '#1890ff' : 'rgba(255, 255, 255, 0.85)';
    }


    const renderItems = (item: IRouterMenu) => {
        const color = getColor(item);
        return {
            title: <div style={{ color, cursor: 'pointer' }} onClick={() => handleClick(item)}>{item.label}</div>,
        }
    }


    useEffect(() => {
        const router = subRouters.find(item => matchPath(item.path, location.pathname!))
        setCurrentSelectRouter(router!)
    }, [location.pathname]);


    return <div>
        {/* <Image src={'http://localhost:8085/text-to-image/images/testimg.png'} width={300} /> */}
        <Flex vertical gap={12}>
            <Breadcrumb
                separator={<div><RightOutlined /></div>}
                items={subRouters.map(renderItems)}
            />
            <Outlet />
        </Flex>
    </div>
}