import { io, Socket } from 'socket.io-client'

import { ChangeDetectorRef } from '@angular/core';

import WebRTCCallServiceFacade from './core/WebRTCCallServiceFacade';
import { WebRTCChannelsCollection } from './core/WebRTCChannelsCollection';

import WebRTCSendSystemCommandMessage from './WebRTCSendSystemCommandMessage';
import WebRTCSendTextMessage from './WebRTCSendTextMessage';
import WebRTCSendVideoMessage from './WebRTCSendVideoMessage';
import WebRTCSendAudioMessage from './WebRTCSendAudioMessage';
import { WebRTCVideoStreaming } from './WebRTCVideoStreaming';
import { WebRTCAudioStreaming } from './WebRTCAudioStreaming';

import SignalingMessage from './models/SignalingMessage';
import { Channel } from './models/Channel';
import { WebRTCDataChannelLabel, WebRTCDataChannelType, WebRTCDataChannelStreamType } from './models/DataChannelLabel';
import { ChannelMessage, ChannelMessageType } from './models/ChannelMessage';
import { SystemCommand } from './models/SystemCommand';

class WebRTCHandler {
	// global user id (this is the user id of the current user)
	currentUserId?: string;

	// global collection of Web RTC call services
	private static webRTCHandler: WebRTCHandler | null = null;
	private callServicesCollection: WebRTCChannelsCollection | null = null;

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
	receiveMediaStreamCallback: (stream: any) => void = () => { };

	// global socket connections
	socket: Socket | null = null;
	signalingServerUrl: string = 'http://192.168.100.8:3030/';
	//signalingServerUrl: string = 'http://13.232.40.67:3030/';

	cdr: ChangeDetectorRef | null = null;

	constructor(currentUserId?: string) {
		this.currentUserId = currentUserId;
		//this.socketConnection();
	}

	public static getInstance(currentUserId: string, callback: (channelmessage: ChannelMessage) => void,
		commandcallback: (channelmessage: ChannelMessage) => void,
		streamcallback: (stream: any) => void, cdr: ChangeDetectorRef) {
		if (WebRTCHandler.webRTCHandler === null || WebRTCHandler.webRTCHandler === undefined) {
			WebRTCHandler.webRTCHandler = new WebRTCHandler(currentUserId);

			if (WebRTCHandler.webRTCHandler.callServicesCollection === null || WebRTCHandler.webRTCHandler.callServicesCollection === undefined) {
				WebRTCHandler.webRTCHandler.callServicesCollection = new WebRTCChannelsCollection(WebRTCHandler.webRTCHandler.onReceiveMessage.bind(this),
					WebRTCHandler.webRTCHandler.onReceiveSystemCommand.bind(this), WebRTCHandler.webRTCHandler.OnReceiveStream.bind(this));
			}

			WebRTCHandler.webRTCHandler.receiveChannelMessageCallback = callback;
			WebRTCHandler.webRTCHandler.receiveSystemCommandCallback = commandcallback;
			WebRTCHandler.webRTCHandler.receiveMediaStreamCallback = streamcallback;

			WebRTCHandler.webRTCHandler.channelsAndMessages = new Map<string, ChannelMessage[]>();
		}

		return WebRTCHandler.webRTCHandler;
	}

	socketConnection() {
		try {
			this.socket = io(this.signalingServerUrl);

			if (this.socket === null || this.socket === undefined) {
				console.error(' WebRTCHandler: Socket is null');
			}
		}
		catch (error) {
			console.error('WebRTCHandler: Error creating socket:', error);
		}

		console.log("WebRTCHandler: socket created");
		console.log('WebRTCHandler: Socket is not null:', this.socket);

		// Set up signaling server event handlers
		this.socket!.on('connect', () => {
			console.log('WebRTCHandler: Connected to signaling server');
		});

		this.socket!.on('disconnect', () => {
			console.log('WebRTCHandler: Disconnected from signaling server');
		});

		// the main signaling message handler
		this.socket!.on('message', async (message: SignalingMessage) => {
			if (message === null || message === undefined) {
				console.error('WebRTCHandler: Invalid signaling message');
				return;
			}

			console.debug('WebRTCHandler:Received signaling message type:', message.type);

			if (message.dataChannelLabel === null || message.dataChannelLabel === undefined) {
				console.error('WebRTCHandler: Invalid data channel label');
				return;
			}

			if (message.dataChannelLabel!.dataChannelName === null || message.dataChannelLabel!.dataChannelName === undefined) {
				console.error('WebRTCHandler: Invalid data channel name');
				return;
			}

			console.debug('WebRTCHandler: socket message dataChannelLabel:', message.dataChannelLabel!);

			if (message.dataChannelLabel.toChannel === null || message.dataChannelLabel.toChannel === undefined) {
				console.error('WebRTCHandler: Invalid toChannel');
				return;
			}

			if (this.currentUserId === message.dataChannelLabel.toChannel.id) {
				console.log("--------> WebRTCHandler: Correct user id targeted", message.dataChannelLabel.toChannel?.name);
			}
			else {
				console.log('--------> WebRTCHandler: Received message for wrong user:', message.dataChannelLabel.toChannel?.name);
				return;
			}

			switch (message.type) {
				case 'initiate-call':
					await this.initiateCall(message);
					break;
				default:
					console.log('WebRTCCallService: Unhandled message:', message);
					break;
			}
		});

		console.log('WebRTCCallService: Socket event handlers set');
	}

	async initiateCall(message: SignalingMessage) {
		return;

		if (message === null || message === undefined) {
			console.error('WebRTCHandler: Invalid signaling message');
			return;
		}

		if (message.dataChannelLabel === null || message.dataChannelLabel === undefined) {
			console.error('WebRTCHandler: Invalid data channel label');
			return;
		}

		const dataChannel = new WebRTCDataChannelLabel(message.dataChannelLabel!.dataChannelType!, message.dataChannelLabel!.tenantId!, message.dataChannelLabel!.toChannel!, message.dataChannelLabel!.fromChannel!, message.dataChannelLabel!.streamType!);

		let callServiceFacade = this.callServicesCollection?.GetCallServiceFacade(dataChannel);

		if (callServiceFacade === null || callServiceFacade === undefined) {
			// connect the data channel
			await this.ConnectDataChannel(message.dataChannelLabel!.dataChannelType!, message.dataChannelLabel!.tenantId!,
				message.dataChannelLabel!.toChannel!, message.dataChannelLabel!.fromChannel!, message.dataChannelLabel!.streamType!);
		}
	}

	async ConnectDataChannel(dataChannelType: WebRTCDataChannelType, tenantId: number, fromChannel: Channel, toChannel: Channel, streamType: WebRTCDataChannelStreamType = WebRTCDataChannelStreamType.NONE) {
		console.log('ConnectDataChannel: Connecting data channel: ', fromChannel, toChannel);

		if (fromChannel === null || fromChannel === undefined || toChannel === null || toChannel === undefined) {
			console.error('ConnectDataChannel: Invalid channels');
			return null;
		}

		// get WebRTCDataChannelLabel
		const dataChannel = new WebRTCDataChannelLabel(dataChannelType, tenantId, fromChannel, toChannel, streamType);
		console.log('ConnectDataChannel: Data channel created:', dataChannel);

		// check if a callService is already existing
		let callServiceFacade = this.callServicesCollection!.GetCallServiceFacade(dataChannel);

		if (callServiceFacade === null || callServiceFacade === undefined) {
			console.log('ConnectDataChannel: callServiceFacade is null, creating one');
			callServiceFacade = await this.callServicesCollection!.Connect(dataChannel);

			if (this.channelsAndMessages?.has(dataChannel.dataChannelName!))
				this.channelsAndMessages?.delete(dataChannel.dataChannelName!);

			this.channelsAndMessages?.set(dataChannel.dataChannelName!, []);
		}

		this.setMessageHandlers(callServiceFacade!.GetChannel()!);

		return dataChannel;
	}

	GetDataChannelName(dataChannelType: WebRTCDataChannelType, streamType: WebRTCDataChannelStreamType, tenantId: number, fromChannel: Channel, toChannel: Channel) {
		if (fromChannel === null || fromChannel === undefined || toChannel === null || toChannel === undefined) {
			console.error('GetDataChannelName: Invalid channels');
			return null;
		}

		const dataChannelLabel = new WebRTCDataChannelLabel(dataChannelType, tenantId, fromChannel, toChannel, streamType);
		console.log('GetDataChannelName: Data channel created:', dataChannelLabel);

		return dataChannelLabel.dataChannelName;
	}

	initMessageHandlers(callServiceFacade: WebRTCCallServiceFacade) {
		console.log('init message handlers');

		if (callServiceFacade === null || callServiceFacade === undefined) {
			console.error('Call service facade not found');
			return;
		}

		this.newMessageHandlers(callServiceFacade);
	}

	setMessageHandlers(dataChannel: WebRTCDataChannelLabel) {
		console.log('Setting message handlers');
		if (dataChannel === null || dataChannel === undefined) {
			console.error('Invalid data channel');
			return;
		}

		let callServiceFacade = this.callServicesCollection!.GetCallServiceFacade(dataChannel);
		if (callServiceFacade === null || callServiceFacade === undefined) {
			console.error('Call service facade not found');
			return;
		}

		if (this.sendSystemCommandMessageHandler !== null && this.sendSystemCommandMessageHandler !== undefined) {
			const existingFacade = this.sendSystemCommandMessageHandler.webRTCCallServiceFacade;
			const exisitingDataChannel = existingFacade.GetChannel();

			if (exisitingDataChannel!.dataChannelName === dataChannel.dataChannelName) {
				console.log('messsage handlers already set');
				return;
			}
		}

		this.newMessageHandlers(callServiceFacade);
	}

	newMessageHandlers(callServiceFacade: WebRTCCallServiceFacade) {
		console.log('Setting new message handlers');
		if (callServiceFacade === null || callServiceFacade === undefined) {
			console.error('Invalid call service facade');
			return;
		}

		this.sendSystemCommandMessageHandler = new WebRTCSendSystemCommandMessage(callServiceFacade);
		console.log('sendSystemCommandMessageHandler set');
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
	}

	getChannelMessages(channelName: string) {
		if (channelName === null || channelName === undefined) {
			console.error('Invalid channel name');
			return null;
		}

		let messages = this.channelsAndMessages!.get(channelName);
		if (messages === null || messages === undefined) {
			messages = [];
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
		this.cdr?.detectChanges();

		this.channelsAndMessages!.set(channelName, messages);
		this.cdr?.detectChanges();
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

	OnReceiveStream(stream: any) {
		console.log('OnReceivedMediaStream: remote media stream received', stream);

		WebRTCHandler.webRTCHandler!.receiveMediaStreamCallback(stream);
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

		this.setMessageHandlers(channelName);

		console.log('SendSystemCommandMessage: Sending command:', command);

		let sentMsg: ChannelMessage | null = null;

		if (command != null && command !== undefined) {
			if (this.sendTextMessageHandler !== null && this.sendTextMessageHandler !== undefined) {
				const sent = await this.sendSystemCommandMessageHandler?.SendSystemCommand(command);
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

		this.setMessageHandlers(channelName);

		newTextMessage = newTextMessage.trim();
		console.log('SendTextMessage: Sending message:', newTextMessage);

		let sentMsg: ChannelMessage | null = null;

		if (newTextMessage !== null && newTextMessage !== '') {
			if (this.sendTextMessageHandler !== null && this.sendTextMessageHandler !== undefined) {
				sentMsg = await this.sendTextMessageHandler.SendMessage(newTextMessage);
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
	async StartVideo(channelName: WebRTCDataChannelLabel, videoElement: any) {
		if (channelName === null || channelName === undefined) {
			console.error('SendTextMessage: Invalid channel name');
			return;
		}

		this.setMessageHandlers(channelName);

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

	async SendVideoMessage(channelName: WebRTCDataChannelLabel) {
		if (channelName === null || channelName === undefined) {
			console.error('SendTextMessage: Invalid channel name');
			return;
		}

		this.setMessageHandlers(channelName);

		let sentMsg: ChannelMessage | undefined = undefined;
		if (this.sendVideoMessageHandler !== null && this.sendVideoMessageHandler !== undefined) {
			sentMsg = await this.sendVideoMessageHandler.SendVideoMessage();
		}

		if (sentMsg === null || sentMsg === undefined) {
			console.error('Failed to send video message');
			return;
		}

		return this.addChannelMessage(channelName.dataChannelName!, sentMsg);
	}

	async StartAudio(channelName: WebRTCDataChannelLabel, audioElement: any) {
		if (channelName === null || channelName === undefined) {
			console.error('SendTextMessage: Invalid channel name');
			return;
		}

		this.setMessageHandlers(channelName);


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

		this.setMessageHandlers(dataChannel);

		let sentMsg: ChannelMessage | undefined = undefined;
		if (this.sendAudioMessageHandler !== null && this.sendAudioMessageHandler !== undefined) {
			sentMsg = await this.sendAudioMessageHandler.SendAudioMessage();
		}

		if (sentMsg === null || sentMsg === undefined) {
			console.error('Failed to send audio message');
			return;
		}

		return this.addChannelMessage(dataChannel!.dataChannelName!, sentMsg);
	}

	// ----------------------------------------------------------------------------------------
	// video & audio streaming
	async StartVideoStreaming(dataChannel: WebRTCDataChannelLabel, localStreamObj: any) {
		if (dataChannel === null || dataChannel === undefined) {
			console.error('SendVideoMessage: Invalid channel name');
			return null;
		}

		if (localStreamObj === null || localStreamObj === undefined) {
			console.error('SendVideoMessage: Invalid local stream object');
			return null;
		}

		this.setMessageHandlers(dataChannel);

		if (this.videoStreamHandler !== null && this.videoStreamHandler !== undefined) {
			console.log('StartVideoStreaming: Starting video streaming');
			return await this.videoStreamHandler.StartVideoStreaming(localStreamObj);
		}

		console.error('Send video message handler not found');
		return null;
	}

	async StartAudioStreaming(dataChannel: WebRTCDataChannelLabel, localStreamObj: any) {
		if (dataChannel === null || dataChannel === undefined) {
			console.error('SendAudioMessage: Invalid channel name');
			return null;
		}

		if (localStreamObj === null || localStreamObj === undefined) {
			console.error('SendAudioMessage: Invalid local stream object');
			return null;
		}

		this.setMessageHandlers(dataChannel);

		if (this.audioStreamHandler !== null && this.audioStreamHandler !== undefined) {
			console.log('StartAudioStreaming: Starting audio streaming');
			return await this.audioStreamHandler.StartAudioStreaming(localStreamObj);
		}

		console.error('Send audio message handler not found');
		return null;
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