import { ChannelMessage } from '../libs/webrtc/models/ChannelMessage';

function getDummyMessages() : ChannelMessage[] {
			const messages: ChannelMessage[] = [
				{
						type: 'text',
						direction: 'in',
						channelmessage: 'Hello, how can I help you?',
						timestamp: '10:00 AM',
				},
				{
						type: 'text',
						direction: 'out',
						channelmessage: 'I need help with my account',
						timestamp: '10:01 AM',
				}
		];

		return messages;
}

export default getDummyMessages;