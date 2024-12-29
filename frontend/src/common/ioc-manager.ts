import 'reflect-metadata';



// 定义注解的元数据键
export const METADATA_KEY = {
    bean: 'ioc:bean',
    autowired: 'ioc:autowired',
    afterConstruct: 'ioc:afterConstruct',
    beforeDestroy: 'ioc:beforeDestroy',
};


export interface ICreateBeansOptions {
    instances?: Record<string, any>;
    beans: any[];
}

/**
 * 一个实现轻量化依赖注入容器管理的类。
 */
export class IocContainer {
    private instances: Map<string, any> = new Map();

    /**
     * Initializes a new instance of the class.
     *
     * @param {ICreateBeansOptions} options - The options for creating beans.
     */
    constructor(options: ICreateBeansOptions) {
        const { instances, beans } = options;
        Object.keys(instances || {}).forEach((instanceKey: string) => {
            this.instances.set(getFirstLowerCasedPropertyKey(instanceKey), instances?.[instanceKey]);
        });
        beans.forEach(bean => this.registerBean(bean));
        this.dependenciesInjection();
        this.executeAfterConstruct();

    }

    private executeAfterConstruct() {

        this.instances.forEach((instance, key, map) => {
            // 处理@AfterConstruct
            const afterConstructMethod = Reflect.getMetadata(METADATA_KEY.afterConstruct, instance.constructor.prototype);
            if (afterConstructMethod) {
                afterConstructMethod.call(this.instances.get(key));
            }
        });

    }


    /**
     * Performs dependency injection for all instances in the map.
     *
     * @private
     * @return {void} - Does not return a value.
     */
    private dependenciesInjection() {
        this.instances.forEach((instance: any, key: string, map: Map<string, any>) => {
            Object.keys(instance || {}).forEach((propertyKey: string) => {
                if (Reflect.hasMetadata(METADATA_KEY.autowired, instance, propertyKey)) {
                    instance[propertyKey] = this.instances.get(propertyKey);
                }
            });
        });
    }


    /**
     * Registers a bean by creating an instance of the target class and adding it to the container.
     * It also handles the @AfterConstruct decorator if present.
     *
     * @param {any} target - The target class to create an instance of.
     */
    private registerBean(target: any) {
        const beanName = Reflect.getMetadata(METADATA_KEY.bean, target);
        const instance = new target();
        // 将实例加入容器
        this.instances.set(getFirstLowerCasedPropertyKey(beanName), instance);
    }

    /**
     * Retrieves a bean with the given name.
     *
     * @param {string} beanName - The name of the bean to retrieve.
     * @return {any} The instance of the bean.
     */
    getBean<T>(beanName: string): T {
        const beanNameKey = getFirstLowerCasedPropertyKey(beanName);
        if (!this.instances.has(beanNameKey)) {
            throw new Error(`Bean with name ${beanNameKey} not found.`);
        }
        return this.instances.get(beanNameKey);
    }

    /**
     * Destroy the beans.
     *
     * @param {type} paramName - description of parameter
     * @return {type} description of return value
     */
    destroyBeans() {
        this.instances.forEach((instance, beanName) => {
            // 处理@BeforeDestroy
            const beforeDestroyMethod = Reflect.getMetadata(METADATA_KEY.beforeDestroy, instance);
            if (beforeDestroyMethod) {
                beforeDestroyMethod.call(instance);
            }

            // 销毁实例
            delete (this.instances as any)[beanName];
        });
    }
}

// 装饰器工厂函数，用于创建@Bean装饰器
export function Bean(target: any) {
    Reflect.defineMetadata(METADATA_KEY.bean, target.name, target);
}

// 装饰器工厂函数，用于创建@Autowired装饰器
export function Autowired(target: any, propertyKey: string) {
    Reflect.defineMetadata(METADATA_KEY.autowired, getFirstLowerCasedPropertyKey(target.constructor.name), target, propertyKey);
}

// 装饰器工厂函数，用于创建@AfterConstruct装饰器
export function AfterConstruct(target: any, propertyKey: string) {
    Reflect.defineMetadata(METADATA_KEY.afterConstruct, target[propertyKey], target);
}

// 装饰器工厂函数，用于创建@BeforeDestroy装饰器
export function BeforeDestroy(target: any, propertyKey: string) {
    Reflect.defineMetadata(METADATA_KEY.beforeDestroy, target[propertyKey], target);
}

// 创建IOC容器管理类的工厂函数
export function CreateBeanManager(options: ICreateBeansOptions) {
    const container = new IocContainer(options);
    return container;
}


/**
 * Returns the first character of the given propertyKey in lower case, followed by the rest of the propertyKey.
 *
 * @param {string} propertyKey - The property key to modify.
 * @return {string} The modified property key.
 */
function getFirstLowerCasedPropertyKey(propertyKey: string) {
    return propertyKey.charAt(0).toLocaleLowerCase() + propertyKey.slice(1);
}


