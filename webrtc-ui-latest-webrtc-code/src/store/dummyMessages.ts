import { WebRTCDataChannelLabel, WebRTCDataChannelType } from '../libs/webrtc/models/DataChannelLabel';
import { ChannelMessage, ChannelMessageType } from '../libs/webrtc/models/ChannelMessage';

function getDummyMessages(): ChannelMessage[] {
	const messages: ChannelMessage[] = [
		{
			type: ChannelMessageType.Text,
			direction: 'in',
			channelmessage: 'Hello, how can I help you?',
			timestamp: '10:00 AM',
			dataChannel: new WebRTCDataChannelLabel(WebRTCDataChannelType.P2P, 1, undefined, undefined),
			userName: '',

		},
		{
			type: ChannelMessageType.Text,
			direction: 'out',
			channelmessage: 'I need help with my account',
			timestamp: '10:01 AM',
			dataChannel: new WebRTCDataChannelLabel(WebRTCDataChannelType.P2P, 1,undefined, undefined),
			userName: '',
		},
		{
			type: ChannelMessageType.Text,
			direction: 'in',
			channelmessage: 'Sure, what do you need help with?',
			timestamp: '10:02 AM',
			dataChannel: new WebRTCDataChannelLabel(WebRTCDataChannelType.P2P, 1, undefined, undefined),
			userName: '',
		},
	];

	return messages;
}

export default getDummyMessages;