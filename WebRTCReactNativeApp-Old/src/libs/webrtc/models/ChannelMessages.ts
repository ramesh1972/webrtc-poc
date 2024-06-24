import { ChannelMessage } from './ChannelMessage';

// collection of messages sent/received over a channel
export interface ChannelMessages {
    channelId: string;
    channelMessages: ChannelMessage[];
}
