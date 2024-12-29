

export interface IImageModel {
    id: string;
    name: string;
    url: string;
}


export interface IStoryboardModel {
    id: string;
    image?: IImageModel;
    subtitle: string;
    prompts: string;
    seed: number;
}

export interface IProjectModel {
    id: string;
    name: string;
    storyboards: IStoryboardModel[];
    video: {
        id: string;
        name: string;
        url: string;
    }
}
