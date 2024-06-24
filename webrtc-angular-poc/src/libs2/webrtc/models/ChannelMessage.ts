import { WebRTCDataChannelLabel } from "./DataChannelLabel";

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

export interface ChannelMessage {
    dataChannel: WebRTCDataChannelLabel;
    type: ChannelMessageType;
    direction: string;
    channelmessage: string;
    userName?: string;
    timestamp?: string;
}