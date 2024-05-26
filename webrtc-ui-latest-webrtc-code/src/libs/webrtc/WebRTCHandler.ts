import { ChangeDetectorRef } from '@angular/core';

import WebRTCCallServiceFacade from './core/WebRTCCallServiceFacade';
import { WebRTCChannelsCollection } from './core/WebRTCChannelsCollection';

import WebRTCSendSystemCommandMessage from './WebRTCSendSystemCommandMessage';
import WebRTCSendTextMessage from './WebRTCSendTextMessage';
import WebRTCSendVideoMessage from './WebRTCSendVideoMessage';
import WebRTCSendAudioMessage from './WebRTCSendAudioMessage';
import { WebRTCVideoStreaming } from './WebRTCVideoStreaming';
import { WebRTCAudioStreaming } from './WebRTCAudioStreaming';

import { Channel } from './models/Channel';
import { WebRTCDataChannelLabel, WebRTCDataChannelType } from './models/DataChannelLabel';
import { ChannelMessage, ChannelMessageType } from './models/ChannelMessage';
import { SystemCommand } from './models/SystemCommand';

import getDummyMessages from '../../store/dummyMessages';

class WebRTCHandler {
	// global collection of Web RTC call services
	private static webRTCHandler: WebRTCHandler | null = null;
	private callServicesCollection: WebRTCChannelsCollection | null = null;
	private currentCallServiceFacade: WebRTCCallServiceFacade | null = null;

	currentDataChannel?: WebRTCDataChannelLabel;
	channelsAndMessages: Map<string, ChannelMessage[]> | null = null;

	sendSystemCommandMessageHandler: WebRTCSendSystemCommandMessage | null = null;
	sendTextMessageHandler: WebRTCSendTextMessage | null = null;
	sendVideoMessageHandler: WebRTCSendVideoMessage | null = null;
	sendAudioMessageHandler: WebRTCSendAudioMessage | null = null;
	videoStreamHandler: WebRTCVideoStreaming | null = null;
	audioStreamHandler: WebRTCAudioStreaming | null = null;

	// callbacks
	receiveChannelMessageCallback: (channelmessage: ChannelMessage) => void = () => { };
	receiveSystemCommandCallback: (channelmessage: ChannelMessage) => void = () => { };

	constructor(private cdr: ChangeDetectorRef) {
	}

	public static getInstance(callback: (channelmessage: ChannelMessage) => void, commandcallback: (channelmessage: ChannelMessage) => void, changeDetectorRef: ChangeDetectorRef) {
		if (WebRTCHandler.webRTCHandler === null || WebRTCHandler.webRTCHandler === undefined) {
			WebRTCHandler.webRTCHandler = new WebRTCHandler(changeDetectorRef);

			if (WebRTCHandler.webRTCHandler.callServicesCollection === null || WebRTCHandler.webRTCHandler.callServicesCollection === undefined) {
				WebRTCHandler.webRTCHandler.callServicesCollection = new WebRTCChannelsCollection(WebRTCHandler.webRTCHandler.onReceiveMessage.bind(this), 
																		 						  WebRTCHandler.webRTCHandler.onReceiveSystemCommand.bind(this));
			}

			WebRTCHandler.webRTCHandler.receiveChannelMessageCallback = callback;
			WebRTCHandler.webRTCHandler.receiveSystemCommandCallback = commandcallback;

			WebRTCHandler.webRTCHandler.channelsAndMessages = new Map<string, ChannelMessage[]>();
		}

		return WebRTCHandler.webRTCHandler;
	}

	async ConnectDataChannel(tenantId: number, fromChannel: Channel, toChannel: Channel) {
		console.log('ConnectDataChannel: Connecting data channel: ', fromChannel, toChannel);

		if (fromChannel === null || fromChannel === undefined || toChannel === null || toChannel === undefined) {
			console.error('ConnectDataChannel: Invalid channels');
			return;
		}

		// get WebRTCDataChannelLabel
		this.currentDataChannel = new WebRTCDataChannelLabel(WebRTCDataChannelType.P2P, tenantId, fromChannel, toChannel);
		console.log('ConnectDataChannel: Data channel created:', this.currentDataChannel);

		let callServiceFacade = this.callServicesCollection!.getCallServiceFacade(this.currentDataChannel);
		if (callServiceFacade === null || callServiceFacade === undefined) {
			console.log('ConnectDataChannel: callServiceFacade is null, creating one');
			callServiceFacade = await this.callServicesCollection!.Connect(this.currentDataChannel);

			if (this.channelsAndMessages?.has(this.currentDataChannel.dataChannelName!))
				this.channelsAndMessages?.delete(this.currentDataChannel.dataChannelName!);
			
			this.channelsAndMessages?.set(this.currentDataChannel.dataChannelName!, []);
		}

		if (callServiceFacade!.IsConnected() === false) {
			console.error('ConnectDataChannel: Call service facade not connected');
			return;
		}

		this.currentCallServiceFacade = callServiceFacade;

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
		this.videoStreamHandler = new WebRTCVideoStreaming(callServiceFacade);
		console.log('videoStreamHandler set');
		this.audioStreamHandler = new WebRTCAudioStreaming(callServiceFacade);
		console.log('audioStreamHandler set');

		console.log("message handlers set");
	}

	getcurrentDataChannel() {
		return this.currentDataChannel;
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
		this.cdr.detectChanges();
		return message;
	}

	// ----------------------------------------------------------------------------------------
	// receive any message
	onReceiveMessage(channelmessage: ChannelMessage) {
		if (channelmessage === null || channelmessage === undefined) {
			console.error('onReceiveMessage: null message received');
			return null;
		}

		if (channelmessage.channelmessage === null || channelmessage.channelmessage === undefined) {
			console.error('onReceiveMessage: Invalid message');
			return null;
		}

		const message = channelmessage.channelmessage.trim();
		console.log('onReceiveMessage: Received message in WebRTCHandler:', message);
		console.log('onReceiveMessage: Received message type in WebRTCHandler:', channelmessage.type);
		console.log('onReceiveMessage: Received message on data channel in WebRTCHandler:', channelmessage.dataChannel);

		WebRTCHandler.webRTCHandler!.addChannelMessage(channelmessage.dataChannel.dataChannelName!, channelmessage);

		console.log('--------------> Received message in component:', channelmessage);
		WebRTCHandler.webRTCHandler!.receiveChannelMessageCallback(channelmessage);

		return channelmessage;
	}

	// receive system command message
	onReceiveSystemCommand(channelCommandMessage: ChannelMessage) {
		if (channelCommandMessage === null || channelCommandMessage === undefined) {
			console.error('onReceiveSystemCommand: null message received');
			return null;
		}

		if (channelCommandMessage.type !== ChannelMessageType.SystemCommand) {
			console.error('onReceiveSystemCommand: Invalid message type');
			return null;
		}

		if (channelCommandMessage.channelmessage === null || channelCommandMessage.channelmessage === undefined) {
			console.error('onReceiveSystemCommand: Invalid command');
			return null;
		}

		console.log('onReceiveMessage: Received command in WebRTCHandler:', channelCommandMessage.channelmessage);

		WebRTCHandler.webRTCHandler!.receiveChannelMessageCallback(channelCommandMessage);
		return channelCommandMessage;
	}

	// send system command message
	async SendSystemCommandMessage(channelName: WebRTCDataChannelLabel, command: SystemCommand) {
		if (channelName === null || channelName === undefined) {
			console.error('SendSystemCommandMessage: Invalid channel name');
			return;
		}

		if (command === null || command === undefined) {
			console.error('SendSystemCommandMessage: Invalid command');
			return;
		}

		console.log('SendSystemCommandMessage: Sending command:', command);

		let sentMsg: ChannelMessage | null = null;

		if (command != null && command !== undefined) {
			if (this.sendTextMessageHandler !== null && this.sendTextMessageHandler !== undefined) {
				const sent = await this.sendSystemCommandMessageHandler?.SendSystemCommand(channelName, command);
				if (!sent) {
					console.error('Failed to send command');
					return;
				}
			}
		}

		return true;
	}
	
	// ----------------------------------------------------------------------------------------
	// text messaging
	async SendTextMessage(channelName: WebRTCDataChannelLabel, newTextMessage: string) {
		if (channelName === null || channelName === undefined) {
			console.error('SendTextMessage: Invalid channel name');
			return;
		}

		if (newTextMessage === null || newTextMessage === undefined) {
			console.error('SendTextMessage: Invalid message');
			return;
		}

		newTextMessage = newTextMessage.trim();
		console.log('SendTextMessage: Sending message:', newTextMessage);
		
		let sentMsg: ChannelMessage | null = null;

		if (newTextMessage != null && newTextMessage !== '') {
			if (this.sendTextMessageHandler !== null && this.sendTextMessageHandler !== undefined) {
				sentMsg = await this.sendTextMessageHandler.SendMessage(channelName, newTextMessage);
			}
		}

		if (sentMsg === null || sentMsg === undefined) {
			console.error('Failed to send message');
			return;
		}

		return this.addChannelMessage(channelName.dataChannelName!, sentMsg);
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

	async SendVideoMessage(dataChannel: WebRTCDataChannelLabel) {
		if (dataChannel === null || dataChannel === undefined) {
			console.error('SendVideoMessage: Invalid channel name');
			return;
		}

		if (dataChannel.dataChannelName === null || dataChannel.dataChannelName === undefined) {
			console.error('SendVideoMessage: Invalid channel name');
			return;
		}

		let sentMsg: ChannelMessage | undefined = undefined;
		if (this.sendVideoMessageHandler !== null && this.sendVideoMessageHandler !== undefined) {
			sentMsg = await this.sendVideoMessageHandler.SendVideoMessage(dataChannel!);
		}

		if (sentMsg === null || sentMsg === undefined) {
			console.error('Failed to send video message');
			return;
		}

		return this.addChannelMessage(this.currentDataChannel!.dataChannelName!, sentMsg);
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

	async SendAudioMessage(dataChannel: WebRTCDataChannelLabel) {
		if (dataChannel === null || dataChannel === undefined) {
			console.error('SendAudioMessage: Invalid channel name');
			return;
		}

		if (dataChannel.dataChannelName === null || dataChannel.dataChannelName === undefined) {
			console.error('SendAudioMessage: Invalid channel name');
			return;
		}

		let sentMsg: ChannelMessage | undefined = undefined;
		if (this.sendAudioMessageHandler !== null && this.sendAudioMessageHandler !== undefined) {
			sentMsg = await this.sendAudioMessageHandler.SendAudioMessage(dataChannel!);
		}

		if (sentMsg === null || sentMsg === undefined) {
			console.error('Failed to send audio message');
			return;
		}

		return this.addChannelMessage(this.currentDataChannel!.dataChannelName!, sentMsg);
	}

	// ----------------------------------------------------------------------------------------
	// video & audio streaming
	async StartVideoStreaming(dataChannel: WebRTCDataChannelLabel, localVideoElement: any, remoteVideoElement: any) {
		if (this.videoStreamHandler !== null && this.videoStreamHandler !== undefined) {
			return await this.videoStreamHandler.StartVideoStreaming(dataChannel, localVideoElement, remoteVideoElement);
		}

		console.error('Send video message handler not found');
		return '';
	}

	async StartAudioStreaming(dataChannel: WebRTCDataChannelLabel, localAudioElement: any, remoteAudioElement: any) {
		if (this.audioStreamHandler !== null && this.audioStreamHandler !== undefined) {
			return await this.audioStreamHandler.StartAudioStreaming(dataChannel, localAudioElement, remoteAudioElement);
		}

		console.error('Send audio message handler not found');
		return '';
	}

	async StopVideoStreaming() {
		if (this.videoStreamHandler !== null && this.videoStreamHandler !== undefined) {
			return await this.videoStreamHandler.StopStreaming();
		}

		console.error('Send video message handler not found');
		return '';
	}

	async StopAudioStreaming() {
		if (this.audioStreamHandler !== null && this.audioStreamHandler !== undefined) {
			return await this.audioStreamHandler.StopStreaming();
		}

		console.error('Send audio message handler not found');
		return '';
	}
}

export default WebRTCHandler;