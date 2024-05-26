// message used for signaling between peers via signaling server
interface SignalingMessage {
    type: string;
    channelName: string;
    data: any;
}

export default SignalingMessage;
