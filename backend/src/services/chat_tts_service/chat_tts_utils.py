


from backend.src.services.project_service.model import ChatTTSSettingModel
from backend.src.tools.file_tools import getProjectMeta, getProjectMetaPath, write_json_to_file


def getChatTTSSetting():
    projectMeta = getProjectMeta()
    if projectMeta.chatttsSetting is None:
        projectMeta.chatttsSetting = ChatTTSSettingModel(
            testText="四川美食确实以辣闻名，但也有不辣的选择。", audioSeed=1, speed=5
        )
        write_json_to_file(projectMeta, getProjectMetaPath())
    newProjectMeta = getProjectMeta()
    return newProjectMeta.chatttsSetting


def saveChatTTSSetting(chatttsSetting:ChatTTSSettingModel):
    projectMeta = getProjectMeta()
    projectMeta.chatttsSetting = chatttsSetting
    write_json_to_file(projectMeta, getProjectMetaPath())