import { Flex } from 'antd';
import './sider-menu.css';
import classNames from 'classnames';
import { IRouterMenu } from '../config/router-menu-config';


interface IMenuItem extends IRouterMenu {
}

interface ISiderMenuProps {
    onMenuItemClick: (item: any) => void;
    selectedItemKey: string;
    menuItems: IMenuItem[];
}

export const SiderMenu = (props: ISiderMenuProps) => {

    return <div>
        {props.menuItems.filter(item => !item.hidden).map(item => {
            const isSelectedItem = item.key === props.selectedItemKey;
            return <div
                key={item.key}
                className={classNames(isSelectedItem ? 'sider-menu-item-selected' : '', 'sider-menu-item')}
                onClick={() => props.onMenuItemClick(item)}>
                <Flex vertical align="center" gap='small' justify={'center'} >
                    <div style={{ fontSize: 18 }}>
                        {item.icon}
                    </div>
                    <div>
                        {item.label}
                    </div>
                </Flex>
            </div>
        })}
    </div>;

}
