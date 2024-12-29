import { Location, matchPath, useLocation } from "react-router";
import { Autowired, Bean } from "../../common/ioc-manager";
import { IOptions, useController } from "../context/dependency-injection-context";



@Bean
export class RouterController {



    @Autowired
    private options!: IOptions;

    private localtion?: Location;


    private _routerStack: string[] = []

    public constructor() {
        this._routerStack = JSON.parse(sessionStorage.getItem('routerHistory') || '[]')
    }


    public get routerStack() {
        return this._routerStack
    }

    public push(pathName: string) {
        const nextRouterStack = this._routerStack.filter(path => path !== pathName)
        nextRouterStack.push(pathName)
        this._routerStack = nextRouterStack
        sessionStorage.setItem('routerHistory', JSON.stringify(this._routerStack))
        return this.routerStack
    }


    public pop() {
        return this._routerStack.pop()
    }

    public top() {
        if (this._routerStack.length === 0) {
            return this.localtion?.pathname;
        }
        return this._routerStack[this._routerStack.length - 1]
    }


    public getRealPath(path: string) {
        return this._routerStack.find(realPath => matchPath(path, realPath))
    }

    public setLocaltion(localtion: Location) {
        this.localtion = localtion
    }
}

export const useRouterController = () => {
    return useController<RouterController>(RouterController.name)
}