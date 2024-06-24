// channel represents a user or group or broadcast channel
export enum WebRTCChannelType {
    USER = "user",
    GROUP = "group",
    BROADCAST = "broadcast"
}

export interface Channel {
    id: string;
    channelType?: WebRTCChannelType;
    name: string;
    userpicture: string;
}