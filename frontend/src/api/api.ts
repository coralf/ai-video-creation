import { IProject } from "../common/declare"
import { request } from "../common/request"
import { IChatTTSSetting } from "../ui/modules/setting/audio-setting"





export const getProjects = () => {
    return request.get('/project/getProjects')
}


export const createProject = () => {
    return request.post('/project/createProject')
}



export const deleteProject = (item: IProject) => {
    return request.post('/project/deleteById', item);
}


export const getProjectById = (id: string) => {
    return request.get('/project/getById', { params: { id } })
}

export const saveStoryboards = (params: any) => {
    return request.post('/project/saveStoryboards', params)
}


export const requestGenerateVideo = (params: any) => {
    return request.post('/project/generateVideo', params)
}


export const getChatTTSSetting = () => {
    return request.get<IChatTTSSetting>('/chat-tts/getSetting')
}

export const saveChatTTSSetting = (params: IChatTTSSetting) => {
    return request.post('/chat-tts/saveSetting', params)
}