import { WebRTCDataChannelLabel } from './DataChannelLabel';

// message used for signaling between peers via signaling server
interface SignalingMessage {
    type: string;
    dataChannelLabel: WebRTCDataChannelLabel;
    data: any;
}

export default SignalingMessage;
