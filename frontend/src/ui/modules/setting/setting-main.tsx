import { Button, Form, Input, Card } from 'antd';
import { useSettingController } from './context';
import { observer } from 'mobx-react-lite';
import { AudioSetting } from './audio-setting';


export const SettingMain = observer(() => {

    return <div>
        <AudioSetting />
    </div>
})
