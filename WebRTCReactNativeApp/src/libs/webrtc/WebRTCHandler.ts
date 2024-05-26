//import { ChangeDetectorRef } from '@angular/core';

import WebRTCCallServiceFacade from './core/WebRTCCallServiceFacade';
import { WebRTCChannelsCollection } from './core/WebRTCChannelsCollection';

import WebRTCSendTextMessage from './WebRTCSendTextMessage';
import WebRTCSendVideoMessage from './WebRTCSendVideoMessage';
import WebRTCSendAudioMessage from './WebRTCSendAudioMessage';

import { Channel } from './models/Channel';
import { ChannelMessage } from './models/ChannelMessage';
import getDummyMessages from '../../store/dummyMessages';

class WebRTCHandler {
	// global collection of Web RTC call services
	private static webRTCHandler: WebRTCHandler | null = null;
	private callServicesCollection: WebRTCChannelsCollection | null = null;
	private currentCallServiceFacade: WebRTCCallServiceFacade | null = null;

	currentDataChannelName: string = '';
	channelsAndMessages: Map<string, ChannelMessage[]> | null = null;

	sendTextMessageHandler: WebRTCSendTextMessage | null = null;
	sendVideoMessageHandler: WebRTCSendVideoMessage | null = null;
	sendAudioMessageHandler: WebRTCSendAudioMessage | null = null;

	// callbacks
	receiveChannelMessageCallback: (channelName: string, type: string, message: string) => void = () => { };

	constructor() {
	}

	public static getInstance(callback: (channelName: string, type: string, message: string) => void) {
		if (WebRTCHandler.webRTCHandler === null || WebRTCHandler.webRTCHandler === undefined) {
			WebRTCHandler.webRTCHandler = new WebRTCHandler();

			if (WebRTCHandler.webRTCHandler.callServicesCollection === null || WebRTCHandler.webRTCHandler.callServicesCollection === undefined) {
				WebRTCHandler.webRTCHandler.callServicesCollection = new WebRTCChannelsCollection(WebRTCHandler.webRTCHandler.onReceiveMessage.bind(this));
			}

			WebRTCHandler.webRTCHandler.receiveChannelMessageCallback = callback;
			WebRTCHandler.webRTCHandler.channelsAndMessages = new Map<string, ChannelMessage[]>();
		}

		return WebRTCHandler.webRTCHandler;
	}

	async ConnectDataChannel(fromChannelId: number, toChannelId: number) {
		console.log('Connecting data channel: ', fromChannelId, toChannelId);
		if (fromChannelId === null || fromChannelId === undefined || toChannelId === null || toChannelId === undefined) {
			console.error('Invalid channel ids');
			return;
		}

		let callServiceFacade = this.callServicesCollection!.getCallServiceFacade(fromChannelId, toChannelId);
		if (callServiceFacade === null || callServiceFacade === undefined) {
			console.log('callServiceFacade is null, creating one');
			callServiceFacade = await this.callServicesCollection!.Connect(fromChannelId, toChannelId);
		}

		if (callServiceFacade!.IsConnected() === false) {
			console.error('Call service facade not connected');
			return;
		}

		this.currentCallServiceFacade = callServiceFacade;
		this.currentDataChannelName = callServiceFacade!.GetChannelId();

		this.setMessageHandlers(callServiceFacade!);
	}

	setMessageHandlers(callServiceFacade: WebRTCCallServiceFacade) {
		console.log('Setting message handlers');
		if (callServiceFacade === null || callServiceFacade === undefined) {
			console.error('Call service facade not found');
			return;
		}

		console.log('Setting message handlers 2');

		this.sendTextMessageHandler = new WebRTCSendTextMessage(callServiceFacade);
		console.log('sendTextMessageHandler set');
		this.sendVideoMessageHandler = new WebRTCSendVideoMessage(callServiceFacade);
		console.log('sendVideoMessageHandler set');
		this.sendAudioMessageHandler = new WebRTCSendAudioMessage(callServiceFacade);
		console.log('sendAudioMessageHandler set');

		console.log("message handlers set");
		this.currentDataChannelName = callServiceFacade.GetChannelId();
	}

	getCurrentDataChannelName() {
		return this.currentDataChannelName;
	}

	getChannelMessages(channelName: string) {
		if (channelName === null || channelName === undefined) {
			console.error('Invalid channel name');
			return null;
		}

		let messages = this.channelsAndMessages!.get(channelName);
		if (messages === null || messages === undefined) {
			messages = getDummyMessages();
			this.channelsAndMessages!.set(channelName, messages);
		}

		return messages;
	}

	addChannelMessage(channelName: string, message: ChannelMessage) {
		console.log('Adding message:', message);
		if (message === null || message === undefined) {
			console.error('Message is null');
			return null;
		}

		if (message.timestamp === null || message.timestamp === undefined || message.timestamp === '') {
			message.timestamp = new Date().toLocaleTimeString();
		}

		let messages: ChannelMessage[] = this.channelsAndMessages!.get(channelName) || [];
		console.log('Adding Message 2', messages);
		if (messages === null || messages === undefined || messages.length === 0) {
			this.channelsAndMessages!.set(channelName, messages);
		}

		console.log('Adding message 3:', message);
		messages.push(message);

		this.channelsAndMessages!.set(channelName, messages);

		return message;
	}

	// ----------------------------------------------------------------------------------------
	// receive any message
	onReceiveMessage(channelName: string, type: string, message: string) {
		message = message.trim();
		console.log('--------------> Received message in WebRTCHandler:', message);
		console.log('--------------> Received message type in WebRTCHandler:', type);

		const messageObj: ChannelMessage = { type: type, channelmessage: message, timestamp: new Date().toLocaleTimeString(), direction: 'in' };
		const msg: ChannelMessage | null = WebRTCHandler.webRTCHandler!.addChannelMessage(channelName, messageObj);

		if (msg !== null && msg !== undefined) {
			console.log('--------------> Received message in component:', msg);
			WebRTCHandler.webRTCHandler!.receiveChannelMessageCallback(channelName, type, msg.channelmessage);
		}

		return msg;
	}

	// ----------------------------------------------------------------------------------------
	// text messaging
	async SendTextMessage(channelName: string, newTextMessage: string) {
		if (newTextMessage === null || newTextMessage === undefined) {
			console.error('Invalid message');
			return;
		}

		newTextMessage = newTextMessage.trim();
		console.log('-------------> Sending message:', newTextMessage);
		let sentMsg: ChannelMessage | null = null;

		if (newTextMessage != null && newTextMessage !== '') {
			if (this.sendTextMessageHandler !== null && this.sendTextMessageHandler !== undefined) {
				sentMsg = await this.sendTextMessageHandler.SendMessage(newTextMessage);
			}
		}

		if (sentMsg === null || sentMsg === undefined) {
			console.error('Failed to send message');
			return;
		}

		return this.addChannelMessage(channelName, sentMsg);
	}

	// ----------------------------------------------------------------------------------------
	// video & audio messaging
	async StartVideo(videoElement: any) {
		if (this.sendVideoMessageHandler !== null && this.sendVideoMessageHandler !== undefined) {
			return await this.sendVideoMessageHandler.StartVideoMessaging(videoElement);
		}

		console.error('Send video message handler not found');
		return '';
	}

	async StopVideo() {
		if (this.sendVideoMessageHandler !== null && this.sendVideoMessageHandler !== undefined) {
			return await this.sendVideoMessageHandler.StopVideo();
		}

		console.error('Send video message handler not found');
		return '';
	}

	async SendVideoMessage() {
		let sentMsg: ChannelMessage | undefined = undefined;
		if (this.sendVideoMessageHandler !== null && this.sendVideoMessageHandler !== undefined) {
			sentMsg = await this.sendVideoMessageHandler.SendVideoMessage();
		}

		if (sentMsg === null || sentMsg === undefined) {
			console.error('Failed to send video message');
			return;
		}

		return this.addChannelMessage(this.currentDataChannelName, sentMsg);
	}

	async StartAudio(audioElement: any) {
		if (this.sendAudioMessageHandler !== null && this.sendAudioMessageHandler !== undefined) {
			return await this.sendAudioMessageHandler.StartAudioMessaging(audioElement);
		}

		console.error('Send audio message handler not found');
		return '';
	}

	async StopAudio() {
		if (this.sendAudioMessageHandler !== null && this.sendAudioMessageHandler !== undefined) {
			return await this.sendAudioMessageHandler.StopAudio();
		}

		console.error('Send audio message handler not found');
		return '';
	}

	async SendAudioMessage() {
		let sentMsg: ChannelMessage | undefined = undefined;
		if (this.sendAudioMessageHandler !== null && this.sendAudioMessageHandler !== undefined) {
			sentMsg = await this.sendAudioMessageHandler.SendAudioMessage();
		}

		if (sentMsg === null || sentMsg === undefined) {
			console.error('Failed to send audio message');
			return;
		}

		return this.addChannelMessage(this.currentDataChannelName, sentMsg);
	}

	// ----------------------------------------------------------------------------------------
	// video & audio streaming
	async StartVideoStreaming(localVideoElement: any, remoteVideoElement: any) {
		if (this.sendVideoMessageHandler !== null && this.sendVideoMessageHandler !== undefined) {
			//	return await this.sendVideoMessageHandler.StartVideoStreaming(localVideoElement, remoteVideoElement);
		}

		console.error('Send video message handler not found');
		return '';
	}

	async StartAudioStreaming(localAudioElement: any, remoteAudioElement: any) {
		if (this.sendAudioMessageHandler !== null && this.sendAudioMessageHandler !== undefined) {
			//	return await this.sendAudioMessageHandler.StartAudioStreaming(localAudioElement, remoteAudioElement);
		}

		console.error('Send audio message handler not found');
		return '';
	}
}

export default WebRTCHandler;