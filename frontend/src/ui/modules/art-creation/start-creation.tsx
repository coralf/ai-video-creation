import { Button, Flex, App, Row, Col, Space, Image, Popconfirm } from 'antd'
import { PlusOutlined } from '@ant-design/icons';
import React, { useEffect, useMemo, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom';
import { ERouterPath } from '../../routers/config/router-menu-config';
import { IProject } from '../../../common/declare';
import './style.css'
import { createProject, getProjects, deleteProject, getProjectById } from '../../../api';

interface IStartCreationProps {

}



export const StartCreation = (props: IStartCreationProps) => {
    const { message, modal, notification } = App.useApp();
    const navigate = useNavigate();
    const [projects, setProjects] = useState<IProject[]>([]);


    const init = async () => {
        const { data } = await getProjects();
        setProjects(data);
    }


    const handleSelectProject = async (item: IProject) => {
        navigate(ERouterPath.ArtCreation.replace(':id', '') + `${item.id}`);
    }


    const handleDelProject = async (item: IProject) => {
        await deleteProject(item)
        init();
    }


    useEffect(() => {
        init();
    }, [])




    const handleCreateProject = async () => {
        // const result = await ipcRender.invoke('createProject');
        const { data } = await createProject();
        navigate(ERouterPath.ArtCreation.replace(':id', '') + `${data.id}`, {
            state: {}
        });
    }

    return <Flex gap={20} style={{ padding: 100 }}>
        <Flex gap='large' wrap='wrap'  >
            <div style={{ width: 167 }}>
                <Flex vertical justify='center' align='center' className={'create-action'} onClick={handleCreateProject}>
                    <div >
                        <PlusOutlined style={{ fontSize: 60 }} />
                    </div>
                    <div>开始创作</div>
                </Flex>
            </div>
            {projects.map(item => {
                return <div key={item.id}>
                    <Space direction='vertical'>
                        <div className='project-preview-image' onClick={() => handleSelectProject(item)}>
                            {item.preViewImageUrl && <Image width={150} src={item.preViewImageUrl} preview={false} />}
                        </div>
                        <div >
                            <Space>
                                <div>
                                    {item.name}
                                </div>
                                <Popconfirm
                                    title="确定删除？"
                                    onConfirm={() => handleDelProject(item)}
                                    okText="确定"
                                    cancelText="取消"
                                >
                                    <Button danger type="text" >删除</Button>
                                </Popconfirm>
                            </Space>
                        </div>
                    </Space>
                </div>
            })}
        </Flex>
    </Flex>
}