export enum ChannelType {
    P2P,
    GROUP,
    BROADCAST
}

export interface Channel {
    id: number;
    channelType: ChannelType;
    name: string;
}