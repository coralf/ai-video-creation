import { Button, Form, Input, Card, Spin, InputNumber, Switch, Space, Flex } from 'antd';
import { useSettingController } from './context';
import { observer } from 'mobx-react-lite';
import { useRect } from '@dnd-kit/core/dist/hooks/utilities';
import { useEffect, useRef, useState } from 'react';
import { request } from '../../../common/request';
import { DEFAULT_AUDIO_SETTNG } from '../../../common/constants';
import TextArea from 'antd/es/input/TextArea';
import { set } from 'lodash'
import { log } from 'console';
import initCollapseMotion from 'antd/es/_util/motion';
import { getChatTTSSetting, saveChatTTSSetting } from '../../../api';

export interface IAudioSetting {



}



export interface IParamsRefineText {
    prompt: string;
    top_P: number;
    top_K: number;
    temperature: number;
    repetition_penalty: number;
    max_new_token: number;
    min_new_token: number;
    show_tqdm: boolean;
    ensure_non_empty: boolean;
    stream_batch: number;
}

export interface IParamsInferCode {
    prompt: string;
    top_P: number;
    top_K: number;
    temperature: number;
    repetition_penalty: number;
    max_new_token: number;
    min_new_token: number;
    show_tqdm: boolean;
    ensure_non_empty: boolean;
    stream_batch: boolean;
    spk_emb?: number[] | null; // 使用 ? 表示可选, 并指定可能的类型
    manual_seed?: number; // 使用 ? 表示可选
}

export interface IChatTTSParams {
    text?: string[];
    stream: boolean;
    lang?: string | null; // 使用 ? 表示可选, 并指定可能的类型
    skip_refine_text: boolean;
    refine_text_only: boolean;
    use_decoder: boolean;
    audio_seed: number;
    text_seed: number;
    do_text_normalization: boolean;
    do_homophone_replacement: boolean;
    params_refine_text?: IParamsRefineText;
    params_infer_code: IParamsInferCode;
}



export interface IChatTTSSetting {
    audioSeed: number;
    testText: string;
    speed: number;
}

export const AudioSetting = (props: IAudioSetting) => {


    const audioRef = useRef<HTMLAudioElement>(null)
    const [chatTTSSetting, setChatTTSSetting] = useState<IChatTTSSetting>({} as IChatTTSSetting)
    const controller = useSettingController()
    const [loading, setLoading] = useState(false);


    const init = async () => {
        const { data } = await getChatTTSSetting()
        setChatTTSSetting(data)
    }
    useEffect(() => {
        init()
    }, [])


    const handleBlur = () => {
        saveChatTTSSetting(chatTTSSetting)
    }


    const handleTestAudio = async () => {

        try {
            setLoading(true);

            setLoading(true);
            const response = await request.post('/chat-tts/text-to-audio', {
                "text": [
                    chatTTSSetting.testText
                ],
                ...DEFAULT_AUDIO_SETTNG,
                params_infer_code: {
                    ...DEFAULT_AUDIO_SETTNG.params_infer_code,
                    prompt: `[speed_${chatTTSSetting.speed}]`,
                    manual_seed: chatTTSSetting.audioSeed
                }
            }, { responseType: 'blob' })

            // 创建 Blob 对象
            const blob = new Blob([response.data], { type: 'audio/mpeg' });
            // 创建对象 URL
            const url = URL.createObjectURL(blob);
            setAudio(url);
            setLoading(false);
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }

    }



    const setAudio = (url: string, autoPlay: boolean = true) => {
        if (url && audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.load();
            autoPlay && audioRef.current.play();
        }
    }

    return <Card title="音频设置" bordered={false}>
        <Form
            labelCol={{ span: 8 }}
            wrapperCol={{ span: 12 }}
        >
            <Form.Item label="测试文本"
                required
                rules={[{ required: true, message: '请输入 测试文本' }]}>
                <TextArea value={chatTTSSetting.testText} placeholder="测试文本"
                    onBlur={handleBlur}
                    onChange={v => setChatTTSSetting({ ...chatTTSSetting, testText: v.target.value || '' })} />
            </Form.Item>
            <Form.Item label="随机种子">
                <InputNumber
                    value={chatTTSSetting.audioSeed}
                    onBlur={handleBlur}
                    onChange={value => {
                        setChatTTSSetting({ ...chatTTSSetting, audioSeed: value || 1 })
                    }} />
            </Form.Item>
            <Form.Item label="播放速度">
                <InputNumber
                    min={1}
                    max={9}
                    value={chatTTSSetting.speed}
                    onBlur={handleBlur}
                    onChange={value => setChatTTSSetting({ ...chatTTSSetting, speed: value || 1 })} />
            </Form.Item>
        </Form>
        <Flex justify='center'>
            <Space>
                <Button size='large' type='primary' onClick={handleTestAudio} loading={loading}>试听语音</Button>
                <div>
                    <audio ref={audioRef} controls>
                        <source type="audio/mpeg" />
                        Your browser does not support the audio element.
                    </audio>
                </div>
            </Space>
        </Flex>

    </Card>
}


