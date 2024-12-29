import { IRouterMenu, routes } from './router-menu-config';

export const useRouterMenus = () => {
    return routes.map(item => {
        return { ...item, key: item.path };
    });
};


const fineDefaultRouter = (routerMenus: IRouterMenu[]) => {
    for (const item of routerMenus) {
        if (item.defaultRouter) {
            return item;
        }

        if (item.children) {
            const subItem = fineDefaultRouter(item.children) as IRouterMenu | null
            if (subItem) {
                return subItem;
            }
        }
    }
}

export const useDefaultRouterMenu = () => {
    const routerMenus = useRouterMenus();
    return routerMenus.find(item => item.defaultRouter);
};



