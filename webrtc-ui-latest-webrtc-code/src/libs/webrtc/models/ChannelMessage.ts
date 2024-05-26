import { WebRTCDataChannelLabel } from "./DataChannelLabel";

export enum ChannelMessageType {
    Unknown = 'unknown',
    SystemCommand = 'system-command',
    Text = 'text',
    Audio = 'audio',
    Video = 'video',
    Image = 'image',
    File = 'file',
}

export interface ChannelMessage {
    dataChannel: WebRTCDataChannelLabel;
    type: ChannelMessageType;
    direction: string;
    channelmessage: string;
    userName?: string;
    timestamp?: string;
}