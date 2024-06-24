import { WebRTCDataChannelLabel } from './DataChannelLabel';
import {Channel} from './Channel'

// message used for signaling between peers via signaling server
interface SignalingMessage {
    type: string;
    dataChannelLabel: WebRTCDataChannelLabel;
    data: any;
    groupMember?: Channel
}

export default SignalingMessage;
