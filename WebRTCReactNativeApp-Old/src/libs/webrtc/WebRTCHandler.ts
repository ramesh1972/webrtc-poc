import { io, Socket } from 'socket.io-client'

import colabLog from './utils/colabLog';

import WebRTCCallServiceFacade from './core/WebRTCCallServiceFacade';
import { WebRTCChannelsCollection } from './core/WebRTCChannelsCollection';

import SignalingMessage from './models/SignalingMessage';

import { Channel } from './models/Channel';
import { WebRTCDataChannelLabel, WebRTCDataChannelType, WebRTCDataChannelStreamType } from './models/DataChannelLabel';
import { ChannelMessage, ChannelMessageType } from './models/ChannelMessage';
import { SystemCommand } from './models/SystemCommand';

import WebRTCSendSystemCommandMessage from './WebRTCSendSystemCommandMessage';
import WebRTCSendTextMessage from './WebRTCSendTextMessage';
import WebRTCSendVideoMessage from './WebRTCSendVideoMessage';
import WebRTCSendAudioMessage from './WebRTCSendAudioMessage';
import WebRTCVideoStreaming from './WebRTCVideoStreaming';
import WebRTCAudioStreaming from './WebRTCAudioStreaming';

// IMPORTANT: 
// It is a singleton class and should be created only once in the entire application lifecycle.
// It is responsible for creating and managing all the WebRTC call services, data channels and their messages.
// It also handles all the socket communication with the signaling server.
// It is the main entry point for all the WebRTC operations in the application.
// the developer building webrtc use cases should use ONLY this class and need to worry about the internal implementation details of webRTC
class WebRTCHandler {

	// note private static modiier which implies this is a singleton class adn neet to be created by the calling app only once via getInstance() method
	private static webRTCHandler: WebRTCHandler | null = null;

	// global collection of Web RTC call services
	private callServicesCollection: WebRTCChannelsCollection | null = null;

	// global collection of channels and messages
	channelsAndMessages: Map<string, ChannelMessage[]> | null = null;

	// global handlers
	sendSystemCommandMessageHandler: WebRTCSendSystemCommandMessage | null = null;
	sendTextMessageHandler: WebRTCSendTextMessage | null = null;
	sendVideoMessageHandler: WebRTCSendVideoMessage | null = null;
	sendAudioMessageHandler: WebRTCSendAudioMessage | null = null;
	videoStreamHandler: WebRTCVideoStreaming | null = null;
	audioStreamHandler: WebRTCAudioStreaming | null = null;

	// callbacks
	receiveChannelMessageCallback: (channelmessage: ChannelMessage) => void = () => { };
	receiveSystemCommandCallback: (channelmessage: ChannelMessage) => void = () => { };

	// use case specific callbacks
	startCallCallBack: (dataChannel: WebRTCDataChannelLabel) => void = async () => { };
	stopCallCallBack: (force: boolean) => void = async () => { };
	callReceivedCallBack: (dataChannel: WebRTCDataChannelLabel) => void = async () => { };

	// global socket connections
	socket: Socket | null = null;

	// TODO: move to config file
	//signalingServerUrl: string = 'http://192.168.0.124:3030/';
	signalingServerUrl: string = 'http://13.232.40.67:3030/';

	// ----------------------------------------------------------------------------------------
	// singleton pattern: private constructor
	private constructor() {
		this.socketConnection();
	}

	// IMPORTANT: create the singleton instance of the class by calling this method
	public static getInstance(callback: (channelmessage: ChannelMessage) => void, commandcallback: (channelmessage: ChannelMessage) => void) {
		if (WebRTCHandler.webRTCHandler === null || WebRTCHandler.webRTCHandler === undefined) {
			WebRTCHandler.webRTCHandler = new WebRTCHandler();

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

	// ----------------------------------------------------------------------------------------
	// handle socket connection and messages received via socket
	private socketConnection() {
		try {
			// TODO move to config file
			console.debug = () => { };

			// !!! IMP: single global socket connection for the entire life of qpp
			this.socket = io(this.signalingServerUrl);

			if (this.socket === null || this.socket === undefined) {
				console.error(' WebRTCHandler: Socket is null');
				throw new Error('WebRTCHandler: Socket is null');
			}
		}
		catch (error) {
			console.error('WebRTCHandler: Error creating socket:', error);
			throw error;
		}

		console.log("WebRTCHandler: socket created");
		console.debug('WebRTCHandler: Socket is not null:', this.socket);

		// Set up signaling server event handlers
		this.socket!.on('connect', () => {
			console.log('WebRTCHandler: Connected to signaling server');
		});

		this.socket!.on('disconnect', () => {
			console.log('WebRTCHandler: Disconnected from signaling server');
			this.handleBye(null);
		});

		// the main signaling message handler
		this.socket!.on('message', (message: SignalingMessage, callback: (response: string) => void) => {

			if (message === null || message === undefined) {
				console.error('WebRTCHandler: Invalid signaling message');
				return;
			}

			if (message.dataChannelLabel === null || message.dataChannelLabel === undefined) {
				console.error('WebRTCHandler: Invalid data channel label');
				return;
			}

			console.log(message.dataChannelLabel?.toChannel.name, ' --> WebRTCHandler:Received signaling message type:', message.type);

			if (message.dataChannelLabel!.dataChannelName === null || message.dataChannelLabel!.dataChannelName === undefined) {
				console.error('WebRTCHandler: Invalid data channel name');
				return;
			}

			console.debug('WebRTCHandler: socket message dataChannelLabel:', message.dataChannelLabel!);

			// the reveiver info is in the toChannel of the dataChannelLabel and must be valid
			if (message.dataChannelLabel.toChannel === null || message.dataChannelLabel.toChannel === undefined) {
				console.error('WebRTCHandler: Invalid toChannel');
				return;
			}

			if (message.dataChannelLabel.dataChannelType !== WebRTCDataChannelType.P2P) {
				console.error('WebRTCHandler: Invalid data channel type', message.dataChannelLabel.dataChannelType);
				return;
			}

			switch (message.type) {
				case 'system-command':
					this.handleSystemCommand(message);
					break;
				case 'offer':
					this.handleOffer(message);
					break;
				case 'answer':
					this.handleAnswer(message);
					break;
				case 'candidate':
					this.handleCandidate(message);
					break;
				case 'ready':
					this.handleReady(message);
					break;
				case 'bye':
					this.handleBye(message);
					break;
				default:
					console.log('WebRTCHandler: Unhandled message:', message);
					break;
			}
		});

		console.log('WebRTCCallService: Socket event handlers set');
	}

	// ----------------------------------------------------------------------------------------
	// main socket message handlers
	private handleSystemCommand(message: SignalingMessage) {
		console.log(message.dataChannelLabel.toChannel?.name, 'handleSystemCommand: Received system command message:', message.data);
		console.debug('handleSystemCommand: Received system command message:', message);

		switch (message.data) {
			case SystemCommand.SYS_CMD_INITIATE_CALL_CONNECTION:
				this.handleInitiateCall(message);
				break;
			case SystemCommand.SYS_CMD_INITIATED_CALL_CONNECTION:
				this.handleCallInitated(message);
				break;
			case SystemCommand.SYS_CMD_CALL_CONNECTION_STARTED:
				this.handleConnectionStarted(message);
				break;
			case SystemCommand.SYS_CMD_CALL_CONNECTION_STOPPED:
				this.handleCallStopped(message);
				break;
		}
	}

	private async handleOffer(message: SignalingMessage) {
		const callServiceFacade = this.callServicesCollection?.GetCallServiceFacade(message.dataChannelLabel!);
		if (callServiceFacade === null || callServiceFacade === undefined) {
			console.error('handleOffer: Call service facade not found');
			return;
		}

		await callServiceFacade.handleOffer(message);
	}

	private async handleAnswer(message: SignalingMessage) {
		const callServiceFacade = this.callServicesCollection?.GetCallServiceFacade(message.dataChannelLabel!);
		if (callServiceFacade === null || callServiceFacade === undefined) {
			console.error('handleAnswer: Call service facade not found');
			return;
		}

		await callServiceFacade.handleAnswer(message);
	}

	private async handleCandidate(message: SignalingMessage) {
		const callServiceFacade = this.callServicesCollection?.GetCallServiceFacade(message.dataChannelLabel!);
		if (callServiceFacade === null || callServiceFacade === undefined) {
			console.error('handleCandidate: Call service facade not found');
			return;
		}

		await callServiceFacade.handleCandidate(message);
	}

	private async handleReady(message: SignalingMessage) {
		if (message === null || message === undefined) {
			return;
		}

		const callServiceFacade = this.callServicesCollection?.GetCallServiceFacade(message.dataChannelLabel!);
		if (callServiceFacade === null || callServiceFacade === undefined) {
			console.error('handleReady: Call service facade not found');
			return;
		}

		await callServiceFacade.handleReady(message);
	}

	private async handleBye(message: SignalingMessage) {

		if (message === null || message === undefined) {
			return;
		}

		const callServiceFacade = this.callServicesCollection?.GetCallServiceFacade(message.dataChannelLabel!);
		if (callServiceFacade === null || callServiceFacade === undefined) {
			console.error('handleBye: Call service facade not found');
			return;
		}

		await callServiceFacade.handleBye(message);
	}

	private async handleAck(message: any) {
	}

	// ----------------------------------------------------------------------------------------

	// ----------------------------------------------------------------------------------------
	// handle use case specific system command messages received via socket
	// sent from this side of the peer connection to the other side of the peer connection
	public SendInitiateCallMessage(dataChannelLabel: WebRTCDataChannelLabel) {
		if (dataChannelLabel === null || dataChannelLabel === undefined) {
			console.error('SendInitiateCallMessage: Invalid data channel label');
			return;
		}

		if (dataChannelLabel.dataChannelName === null || dataChannelLabel.dataChannelName === undefined) {
			console.error('SendInitiateCallMessage: Invalid data channel name');
			return;
		}

		if (this.socket === null || this.socket === undefined) {
			console.error('SendInitiateCallMessage: Socket is null');
			return;
		}

		const callServiceFacade = this.callServicesCollection?.GetCallServiceFacade(dataChannelLabel);
		if (callServiceFacade !== null && callServiceFacade !== undefined) {
			if (callServiceFacade.SendSystemCommandViaSocket(SystemCommand.SYS_CMD_INITIATE_CALL_CONNECTION)) {
				console.log('SendInitiateCallMessage: sent initiate message to peer');
				return true;
			}
			else {
				console.error('SendInitiateCallMessage: failed to send initiate message to peer');
				return false;
			}
		}
		else {
			console.error('IMP: -----> SendInitiateCallMessage: Call service facade not found');
			return false;
		}
	}

	public SendCallInitiatedlMessage(dataChannelLabel: WebRTCDataChannelLabel) {
		if (dataChannelLabel === null || dataChannelLabel === undefined) {
			console.error('SendCallInitiatedlMessage: Invalid data channel label');
			return;
		}

		if (dataChannelLabel.dataChannelName === null || dataChannelLabel.dataChannelName === undefined) {
			console.error('SendCallInitiatedlMessage: Invalid data channel name');
			return;
		}

		if (this.socket === null || this.socket === undefined) {
			console.error('SendCallInitiatedlMessage: Socket is null');
			return;
		}

		const callServiceFacade = this.callServicesCollection?.GetCallServiceFacade(dataChannelLabel);
		if (callServiceFacade !== null && callServiceFacade !== undefined) {
			if (callServiceFacade.SendSystemCommandViaSocket(SystemCommand.SYS_CMD_INITIATED_CALL_CONNECTION)) {
				console.log('SendCallInitiatedlMessage: sent call initiated message to peer');
				return true;
			}
			else {
				console.error('SendCallInitiatedlMessage: failed to send initiate message to peer');
				return false;
			}
		}
		else {
			console.error('IMP: -----> SendCallInitiatedlMessage: Call service facade not found');
			return false;
		}
	}

	public SendCallStartedMessage(dataChannelLabel: WebRTCDataChannelLabel) {
		if (dataChannelLabel === null || dataChannelLabel === undefined) {
			console.error('SendCallStartedMessage: Invalid data channel label');
			return;
		}

		if (dataChannelLabel.dataChannelName === null || dataChannelLabel.dataChannelName === undefined) {
			console.error('SendCallStartedMessage: Invalid data channel name');
			return;
		}

		if (this.socket === null || this.socket === undefined) {
			console.error('SendCallStartedMessage: Socket is null');
			return;
		}

		const callServiceFacade = this.callServicesCollection?.GetCallServiceFacade(dataChannelLabel);
		if (callServiceFacade !== null && callServiceFacade !== undefined) {
			if (callServiceFacade.SendSystemCommandViaSocket(SystemCommand.SYS_CMD_CALL_CONNECTION_STARTED)) {
				console.log('SendCallStartedMessage: sent call started message to peer');
				return true;
			}
			else {
				console.error('SendCallStartedMessage: failed to send call started message to peer');
				return false;
			}
		}
		else {
			console.error('IMP: -----> SendCallStartedMessage: Call service facade not found');
			return false;
		}
	}

	public SendCallStoppedMessage(dataChannelLabel: WebRTCDataChannelLabel) {
		if (dataChannelLabel === null || dataChannelLabel === undefined) {
			console.error('SendCallStoppedMessage: Invalid data channel label');
			return;
		}

		if (dataChannelLabel.dataChannelName === null || dataChannelLabel.dataChannelName === undefined) {
			console.error('SendCallStoppedMessage: Invalid data channel name');
			return;
		}

		if (this.socket === null || this.socket === undefined) {
			console.error('SendCallStoppedMessage: Socket is null');
			return;
		}

		const callServiceFacade = this.callServicesCollection?.GetCallServiceFacade(dataChannelLabel);
		if (callServiceFacade !== null && callServiceFacade !== undefined) {
			if (callServiceFacade.SendSystemCommandViaSocket(SystemCommand.SYS_CMD_CALL_CONNECTION_STOPPED)) {
				console.log('SendCallStoppedMessage: sent call stopped message to peer');
				return true;
			}
			else {
				console.error('SendCallStoppedMessage: failed to send call stopped message to peer');
				return false;
			}
		}
		else {
			console.error('IMP: -----> SendCallStoppedMessage: Call service facade not found');
			return false;
		}
	}
	// received on the other side of the peer connection
	private handleInitiateCall(message: SignalingMessage) {
		console.log(message.dataChannelLabel?.toChannel?.name, '--> handleInitiateCall: received initiate call message');

		if (message === null || message === undefined) {
			console.error('WebRTCHandler: Invalid signaling message');
			return;
		}

		if (message.dataChannelLabel === null || message.dataChannelLabel === undefined) {
			console.error('WebRTCHandler: Invalid data channel label');
			return;
		}

		if (this.callReceivedCallBack !== null && this.callReceivedCallBack !== undefined) {
			this.callReceivedCallBack(message.dataChannelLabel!);
		}
		else
			console.error('handleInitiateCall: received initiate call message, and callback is null');
	}

	// the other peer has setup the connection and now both ends are ready to handshake
	private handleCallInitated(message: SignalingMessage) {
		console.log(message.dataChannelLabel?.toChannel?.name, ' --> handleCallInitated: received call initiated message');

		if (message === null || message === undefined) {
			console.error('WebRTCHandler: Invalid signaling message');
			return;
		}

		if (message.dataChannelLabel === null || message.dataChannelLabel === undefined) {
			console.error('WebRTCHandler: Invalid data channel label');
			return;
		}

		if (this.startCallCallBack !== null && this.startCallCallBack !== undefined) {
			console.log(message.dataChannelLabel, 'handleCallInitated: received call initiated message, initiating video streaming');
			this.startCallCallBack(message.dataChannelLabel);

			return;
		}

		console.error('IMPORTANT: handleCallInitated: startCallCallBack not found');
	}

	private handleConnectionStarted(message: SignalingMessage) {
		console.log(message.dataChannelLabel?.toChannel?.name, '--> handleConnectionStarted: received start call message');

		if (message === null || message === undefined) {
			console.error('WebRTCHandler: Invalid signaling message');
			return;
		}

		if (message.dataChannelLabel === null || message.dataChannelLabel === undefined) {
			console.error('WebRTCHandler: Invalid data channel label');
			return;
		}

		if (this.startCallCallBack !== null && this.startCallCallBack !== undefined) {
			console.log(message.dataChannelLabel, 'handleCallInitated: received call initiated message, initiating video streaming');
			this.startCallCallBack(message.dataChannelLabel);
		}
		else {
			console.log('IMPORTANT: handleConnectionStarted: startCallCallBack not found');
		}
	}

	private handleCallStopped(message: SignalingMessage) {
		console.log(message.dataChannelLabel?.toChannel?.name, '--> handleCallStopped: received call stopped message');

		if (this.stopCallCallBack !== null && this.stopCallCallBack !== undefined) {
			console.log(message.dataChannelLabel, 'handleCallStopped: received call stopped message');
			this.stopCallCallBack(true);
		}
		else {
			console.log('IMPORTANT: handleCallStopped: startCallCallBack not found');
		}
	}
	// ----------------------------------------------------------------------------------------

	// ----------------------------------------------------------------------------------------
	// IMP: create the peer connection, start handshake and connect the data channel and make peers ready for comunication
	public async ConnectDataChannel(dataChannelType: WebRTCDataChannelType, tenantId: number, fromChannel: Channel, toChannel: Channel, streamType: WebRTCDataChannelStreamType = WebRTCDataChannelStreamType.NONE) {
		console.log(fromChannel?.name, '--> ConnectDataChannel: Connecting data channel');
		console.debug('ConnectDataChannel: Connecting data channel: ', fromChannel, toChannel);

		if (fromChannel === null || fromChannel === undefined || toChannel === null || toChannel === undefined) {
			console.error('ConnectDataChannel: Invalid channels');
			return null;
		}

		// get WebRTCDataChannelLabel
		const dataChannel = new WebRTCDataChannelLabel(dataChannelType, tenantId, fromChannel, toChannel, streamType);
		colabLog(dataChannel, 'ConnectDataChannel: Data channel created:', dataChannel.dataChannelName);

		// check if a callService is already existing
		let callServiceFacade = this.callServicesCollection!.GetCallServiceFacade(dataChannel);

		if (callServiceFacade !== null && callServiceFacade !== undefined) {
			const streamType = dataChannel.streamType;

			if (streamType === WebRTCDataChannelStreamType.AUDIO || streamType === WebRTCDataChannelStreamType.VIDEO) {
				console.debug('createFacade: Removing existing facade for channel:', dataChannel.dataChannelName);
				this.callServicesCollection.removeFacade(dataChannel);

				callServiceFacade = null;

			}
			else
				return dataChannel;
		}

		// IMP: create the call service facade object and start the handshake, peer connection etc.
		if (callServiceFacade === null || callServiceFacade === undefined) {
			colabLog(dataChannel, 'ConnectDataChannel: callServiceFacade is null, creating one');

			await this.callServicesCollection!.Connect(this.socket, dataChannel).then(facade => {
				console.debug('ConnectDataChannel: callServiceFacade created:', facade);
				callServiceFacade = facade;

				this.setMessageHandlers(dataChannel);

				if (this.channelsAndMessages?.has(dataChannel.dataChannelName))
					this.channelsAndMessages?.delete(dataChannel.dataChannelName);

				this.channelsAndMessages?.set(dataChannel.dataChannelName!, []);

			}).catch(error => {
				console.error('ConnectDataChannel: Error creating call service facade:', error);
				return null;
			});

			return dataChannel;
		}
	}

	public IsConnected(dataChannel: WebRTCDataChannelLabel) {
		if (dataChannel === null || dataChannel === undefined) {
			console.log('IsConnected: Invalid data channel');
			return true;
		}

		const callServiceFacade = this.callServicesCollection!.GetCallServiceFacade(dataChannel);
		if (callServiceFacade === null || callServiceFacade === undefined) {
			console.log('IsConnected: Call service facade not found');
			return true;
		}

		return callServiceFacade.IsConnected();

	}

	public async Init(isInitiator: boolean, dataChannel: WebRTCDataChannelLabel, localStreamObj?: any) {
		if (dataChannel === null || dataChannel === undefined) {
			console.error('Init: Data channel not found');
			return null;
		}

		return await this.callServicesCollection.Init(isInitiator, dataChannel, localStreamObj);
	}

	public GetDataChannelName(dataChannelType: WebRTCDataChannelType, streamType: WebRTCDataChannelStreamType, tenantId: number, fromChannel: Channel, toChannel: Channel) {
		if (fromChannel === null || fromChannel === undefined || toChannel === null || toChannel === undefined) {
			console.error('GetDataChannelName: Invalid channels');
			return null;
		}

		const dataChannelLabel = new WebRTCDataChannelLabel(dataChannelType, tenantId, fromChannel, toChannel, streamType);
		colabLog(dataChannelLabel, 'GetDataChannelName: Data channel label created:', dataChannelLabel);

		return dataChannelLabel.dataChannelName;
	}

	public IsDataChannelCreated(dataChannel: WebRTCDataChannelLabel) {
		colabLog(dataChannel, 'IsDataChannelCreated: Checking if data channel is valid');
		if (dataChannel === null || dataChannel === undefined) {
			console.error('IsValidDataChannel: Invalid data channel');
			return false;
		}

		if (dataChannel.dataChannelName === null || dataChannel.dataChannelName === undefined) {
			console.error('IsValidDataChannel: Invalid data channel name');
			return false;
		}

		const callServiceFacade = this.callServicesCollection!.GetCallServiceFacade(dataChannel);
		if (callServiceFacade === null || callServiceFacade === undefined) {
			console.log('IsValidDataChannel: Call service facade not found');
			return false;
		}

		return true;
	}
	// ----------------------------------------------------------------------------------------

	// ----------------------------------------------------------------------------------------
	// setup use case specific message handlers
	private initMessageHandlers(callServiceFacade: WebRTCCallServiceFacade) {
		console.log('init message handlers');

		if (callServiceFacade === null || callServiceFacade === undefined) {
			console.error('Call service facade not found');
			return;
		}

		this.newMessageHandlers(callServiceFacade);
	}

	private setMessageHandlers(dataChannel: WebRTCDataChannelLabel) {
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
			if (existingFacade === null || existingFacade === undefined) {
				console.debug('Existing facade not found');
				this.newMessageHandlers(callServiceFacade);
				return;
			}

			const exisitingDataChannel = existingFacade.GetCallService() ? existingFacade.GetChannel() : null;
			if (exisitingDataChannel === null || exisitingDataChannel === undefined) {
				console.log('Existing data channel not found');
			}
			else if (exisitingDataChannel!.dataChannelName === dataChannel.dataChannelName) {
				console.log('messsage handlers already set');
				return;
			}
		}

		this.newMessageHandlers(callServiceFacade);
	}

	private unSetMessageHandlers() {
		console.log('Unsetting message handlers');

		this.sendSystemCommandMessageHandler = null;
		this.sendTextMessageHandler = null;
		this.sendVideoMessageHandler = null;
		this.sendAudioMessageHandler = null;
		this.videoStreamHandler = null;
		this.audioStreamHandler = null;
	}

	private newMessageHandlers(callServiceFacade: WebRTCCallServiceFacade) {
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
	// ----------------------------------------------------------------------------------------

	// ----------------------------------------------------------------------------------------
	// handle messages globaly for all active data channels
	public getChannelMessages(channelName: string) {
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

	private addChannelMessage(channelName: string, message: ChannelMessage) {
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
		//this.cdr.detectChanges();
		return message;
	}
	// ----------------------------------------------------------------------------------------

	// ----------------------------------------------------------------------------------------
	// receive any message
	private onReceiveMessage(channelmessage: ChannelMessage) {
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
	private onReceiveSystemCommand(channelCommandMessage: ChannelMessage) {
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

		WebRTCHandler.webRTCHandler!.receiveSystemCommandCallback(channelCommandMessage);
		return channelCommandMessage;
	}

	// send system command message
	private SendSystemCommandMessage(channelName: WebRTCDataChannelLabel, command: SystemCommand) {
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
				const sent = this.sendSystemCommandMessageHandler?.SendSystemCommand(command);
				if (!sent) {
					console.error('Failed to send command');
					return;
				}
			}
		}

		return true;
	}
	// ----------------------------------------------------------------------------------------

	// ----------------------------------------------------------------------------------------
	// text messaging
	public SendTextMessage(channelName: WebRTCDataChannelLabel, newTextMessage: string) {
		if (channelName === null || channelName === undefined) {
			console.error('SendTextMessage: Invalid channel name');
			return null;
		}

		if (newTextMessage === null || newTextMessage === undefined) {
			console.error('SendTextMessage: Invalid message');
			return null;
		}

		this.setMessageHandlers(channelName);

		newTextMessage = newTextMessage.trim();
		console.log('SendTextMessage: Sending message:', newTextMessage);

		let sentMsg: ChannelMessage | null = null;

		if (newTextMessage !== null && newTextMessage !== '') {
			if (this.sendTextMessageHandler !== null && this.sendTextMessageHandler !== undefined) {
				sentMsg = this.sendTextMessageHandler.SendMessage(newTextMessage);
			}
		}

		if (sentMsg === null || sentMsg === undefined) {
			console.error('Failed to send message');
			return null;
		}

		return this.addChannelMessage(channelName.dataChannelName!, sentMsg);
	}
	// ----------------------------------------------------------------------------------------

	// ----------------------------------------------------------------------------------------
	// video & audio messaging
	public async StartVideo(channelName: WebRTCDataChannelLabel, videoElement: any) {
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

	public async StopVideo() {
		if (this.sendVideoMessageHandler !== null && this.sendVideoMessageHandler !== undefined) {
			return await this.sendVideoMessageHandler.StopVideo();
		}

		console.error('Send video message handler not found');
		return '';
	}

	public async SendVideoMessage(channelName: WebRTCDataChannelLabel) {
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

	public async StartAudio(channelName: WebRTCDataChannelLabel, audioElement: any) {
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

	public async StopAudio() {
		if (this.sendAudioMessageHandler !== null && this.sendAudioMessageHandler !== undefined) {
			return await this.sendAudioMessageHandler.StopAudio();
		}

		console.error('Send audio message handler not found');
		return '';
	}

	public async SendAudioMessage(dataChannel: WebRTCDataChannelLabel) {
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

	// ----------------------------------------------------------------------------------------
	// video & audio streaming
	public async StartVideoStreaming(dataChannel: WebRTCDataChannelLabel) {
		if (dataChannel === null || dataChannel === undefined) {
			console.error('SendVideoMessage: Invalid channel name');
			return false;
		}

		this.setMessageHandlers(dataChannel);

		if (this.videoStreamHandler !== null && this.videoStreamHandler !== undefined) {
			colabLog(dataChannel, 'StartVideoStreaming: Starting video streaming');
			return await this.videoStreamHandler.StartVideoStreaming();
		}

		console.error('Send video message handler not found');
		return false;
	}

	public async StartAudioStreaming(dataChannel: WebRTCDataChannelLabel, localStreamObj: any) {
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
			colabLog(dataChannel, 'StartAudioStreaming: Starting audio streaming');
			return await this.audioStreamHandler.StartAudioStreaming(localStreamObj);
		}

		console.error('Send audio message handler not found');
		return null;
	}

	public StopVideoStreaming() {
		if (this.videoStreamHandler !== null && this.videoStreamHandler !== undefined) {
			const isStopped = this.videoStreamHandler.StopStreaming();

			this.unSetMessageHandlers();

			return isStopped;
		}

		console.log('Send video message handler not found');
		return true;
	}

	public async StopAudioStreaming() {
		if (this.audioStreamHandler !== null && this.audioStreamHandler !== undefined) {
			return await this.audioStreamHandler.StopStreaming();
		}

		console.error('Send audio message handler not found');
		return '';
	}

	// set streaming related callbacks, called from client code passing function to be called back
	public SetStartCallCallBack(dataChannel: WebRTCDataChannelLabel, callback: (dataChannel: WebRTCDataChannelLabel) => void) {

		if (dataChannel === null || dataChannel === undefined) {
			console.error('SetStartCallCallBack: Invalid data channel label');
			return;
		}

		this.startCallCallBack = callback;
	}

	public SetStopCallCallBack(dataChannel: WebRTCDataChannelLabel, callback: (force: boolean) => void) {
		if (dataChannel === null || dataChannel === undefined) {
			console.error('SetStopCallCallBack: Invalid data channel label');
			return;
		}

		this.stopCallCallBack = callback;
	}

	public SetCallReceivedCallBack(callback: (dataChannel: WebRTCDataChannelLabel) => void) {
		console.log('SetCallReceivedCallBack: Setting call received callback');

		this.callReceivedCallBack = callback;
	}

	// IMPORTANT: set the callback to receive remote stream if you are streaming
	public SetMediaStreamReceiveCallback(dataChannel: WebRTCDataChannelLabel, callback: (stream: any) => void) {
		colabLog(dataChannel, 'setMediaStreamReceiveCallback: Setting media stream receive callback');

		if (WebRTCChannelsCollection !== null && WebRTCChannelsCollection !== undefined) {
			const callServiceFacade = this.callServicesCollection!.GetCallServiceFacade(dataChannel);

			if (callServiceFacade !== null && callServiceFacade !== undefined) {
				callServiceFacade.SetMediaStreamReceiveCallback(callback);
				return;
			}
		}

		console.error('setMediaStreamReceiveCallback: Call service facade not found');
	}
	// ----------------------------------------------------------------------------------------
}

export default WebRTCHandler;