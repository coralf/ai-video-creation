import { Flex } from 'antd';
import React, { SyntheticEvent } from 'react';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import classNames from 'classnames';
import './head-actions.css';
import { useArtCreationController } from '../hooks';
import { IEditTableDataItem } from '../art-creation-store';

export interface IHeadActionsProps {
  data: IEditTableDataItem;
}

export const HeadActions = (props: IHeadActionsProps) => {
  const { data } = props;
  const controller = useArtCreationController();


  const handlePlusClick = (e: SyntheticEvent) => {
    controller.addRowTo(data);
  }


  const handleDelClick = (e: SyntheticEvent) => {
    controller.delRowBy(data);
  }



  return <Flex vertical gap="small" justify='center' align='center'>
    <Flex vertical={false} gap='large'>
      <div className={classNames('add-row')}>
        <PlusOutlined onClick={handlePlusClick} />
      </div>
      <div className={classNames('del-row')}>
        <CloseOutlined onClick={handleDelClick} />
      </div>

    </Flex>
  </Flex >
}
