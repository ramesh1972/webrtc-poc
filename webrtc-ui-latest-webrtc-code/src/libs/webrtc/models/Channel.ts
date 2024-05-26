export enum ChannelType {
    USER = "user",
    GROUP = "group",
    BROADCAST = "broadcast"
}

export interface Channel {
    id: number;
    channelType?: ChannelType;
    name: string;
}