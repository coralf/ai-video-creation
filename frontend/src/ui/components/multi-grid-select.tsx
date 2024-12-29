import React from 'react';
import { Flex, Image } from 'antd';
import classNames from 'classnames';
import './multi-grid-select.css';
import { useState } from 'react';
import { FullscreenOutlined } from '@ant-design/icons';
import { observer } from 'mobx-react-lite';

export interface IMultiGridSelectProps {
    onSelect?: (value: IMultiGridSelectValue) => void;
    value?: IMultiGridSelectValue;
}


const itemCount = 4;

export interface IMultiGridSelectValue {
    imgSrc?: string;
    imgUri?: string;
    path?: string;
    currentSelectedIndex?: number;
    loading?: boolean;
    // mj 相关字段
    msgId?: string;
    hash?: string;
    flags?: number;
    content?: string;
}

export const MultiGridSelect = observer((props: IMultiGridSelectProps) => {
    const { value, onSelect } = props;

    const [preview, setPreview] = useState<boolean>(false);
    const handleSelect = (key: number) => {
        if (key === value?.currentSelectedIndex) {
            const { currentSelectedIndex, ...rest } = value;
            onSelect?.(rest);
        } else {
            onSelect?.({
                ...value,
                currentSelectedIndex: key
            });
        }
    };

    const handlePreview = () => {
        setPreview(!preview);
    };

    if (!value?.imgSrc) {
        return <div className={classNames('multi-grid')}>
        </div>;
    }

    return <div>
        <div className={classNames('multi-grid')}>
            <div className={classNames('multi-grid-image')}>
                <Image width={150} height={150} src={value.imgSrc} preview={false} />
                <Image
                    width={150}
                    style={{ display: 'none' }}
                    src={value.imgSrc}
                    preview={{
                        visible: preview,
                        scaleStep: 1,
                        src: value.imgSrc,
                        onVisibleChange: (value) => {
                            setPreview(value);
                        },
                    }}
                />
            </div>
            <div className={classNames('multi-grid-selector')}>
                <Flex wrap={'wrap'}>
                    {Array.from({ length: itemCount }, (_, index) => index).map(item =>
                        <div
                            key={`${item + 1}`}
                            className={classNames(
                                'multi-grid-selector-item',
                                value?.currentSelectedIndex === item ? 'multi-grid-selector-item-selected ' : ''
                            )}
                            onClick={() => handleSelect(item)}></div>
                    )}
                </Flex>
            </div>
            <span className={classNames('multi-grid-zoom')}>
                <FullscreenOutlined onClick={handlePreview} className={classNames('multi-grid-zoom-icon')} />
            </span>
        </div>
    </div>;
});
