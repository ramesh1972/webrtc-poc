// message used for signaling between peers via signaling server
export interface SignalingMessage {
    type: string;
    channelName: string;
    data: any;
}