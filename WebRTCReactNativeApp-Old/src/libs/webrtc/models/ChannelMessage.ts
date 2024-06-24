import { WebRTCDataChannelLabel } from "./DataChannelLabel";

// formats of messaging supported
export enum ChannelMessageType {
    Unknown = 'unknown',
    SystemCommand = 'system-command',
    Text = 'text',
    URL = 'url',
    Audio = 'audio',
    Video = 'video',
    Image = 'image',
    File = 'file',
    JSON = 'json',
    Binary = 'binary',
    BLOB = 'blob',
    XML = 'xml',
    CODE = 'code',
    ZIP = 'zip',
    PDF = 'pdf',
}

// message exchanged over webRTC data channels
export interface ChannelMessage {
    dataChannel: WebRTCDataChannelLabel;
    type: ChannelMessageType;
    direction: string;
    channelmessage: string;
    userName?: string;
    timestamp?: string;
}