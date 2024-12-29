import { makeAutoObservable } from 'mobx';
import { Bean, CreateBeanManager, IocContainer } from '../../../common/ioc-manager';

@Bean
export class SettingController {




    public constructor() {
        makeAutoObservable(this);
    }


    public async initialize() {
    }



}
