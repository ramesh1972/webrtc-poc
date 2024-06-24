export enum WebRTCChannelType {
    USER = "user",
    GROUP = "group",
    BROADCAST = "broadcast"
}

export interface Channel {
    id: string;
    channelType?: WebRTCChannelType;
    name: string;
    //userpicture: string;
}