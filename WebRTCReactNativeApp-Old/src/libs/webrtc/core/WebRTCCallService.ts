import {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    mediaDevices

} from 'react-native-webrtc';

import { io, Socket } from 'socket.io-client'

import colabLog from '../utils/colabLog';
import getICEServers from '../utils/turnServerList'

import { SystemCommand } from '../models/SystemCommand';
import SignalingMessage from '../models/SignalingMessage';
import { ChannelMessage, ChannelMessageType } from '../models/ChannelMessage';
import { WebRTCDataChannelLabel, WebRTCDataChannelType } from '../models/DataChannelLabel';

// TODO
// exception handling/error handling
// peer connections error handling
// adapter.js
// TURN server

// WebRTC call service exported class that has
// for handling signaling messages between peers - offer, answer, candidate, ready, bye
// methods to establish WebRTC connection between peers
// establish data channel for sending/receiving data
// and send/receive data via the data channels
class WebRTCCallService {

    // connection properties
    private socket: Socket | null = null;
    private isConnected: boolean = false;
    private isPeerConnected: boolean = false;
    private pc: RTCPeerConnection | null = null;
    private offer: RTCSessionDescription | null = null;
    private isInitiator: boolean = false;

    private TURN_SERVER_URLS = {
        iceServers: [
            {
                urls: 'stun:stun.l.google.com:19302'
            }
        ]
    };

    private dataChannelLabel?: WebRTCDataChannelLabel;
    private sendChannel: any | null = null;
    private receiveChannel: any | null = null;

    // TODO Cleanup these
    // media messaging properties
    private CHUNK_SIZE = 16384; // Adjust the chunk size as needed
    private videoElement: any | null = null;
    private audioElement: any | null = null;
    private localStream: any | null = null;
    private remoteStream: any | null = null;
    private mediaRecorder: any | null = null;
    private recordedChunks: Blob[] = [];
    private isVideoMessage: boolean = false;
    private isAudioMessage: boolean = false;
    private receivedChunks: Uint8Array[] = [];

    // streaming properties
    isVideoStreaming: boolean = false;
    isAudioStreaming: boolean = false;

    localVideoElement: any | null = null;
    remoteVideoElement: any | null = null;

    localAudioElement: any | null = null;
    remoteAudioElement: any | null = null;

    // callbacks
    private receiveChannelMessageCallback: (dataChannel: WebRTCDataChannelLabel, channelMessage: ChannelMessage) => void = () => { };
    private receiveSystemCommandCallback: (dataChannel: WebRTCDataChannelLabel, channelMessage: ChannelMessage) => void = () => { };
    private remoteStreamCallback: (stream: any) => void = () => { };

    constructor(socket: Socket, dataChannelLabel: WebRTCDataChannelLabel | null = null) {

        if (dataChannelLabel !== null && dataChannelLabel !== undefined) {
            this.dataChannelLabel = dataChannelLabel;
        }
        else {
            console.error('WebRTCCallService: Invalid data channel label');
            return;
        }

        this.socket = socket;
        this.pc = null;
        this.sendChannel = null;
        this.receiveChannel = null;

        this.recordedChunks = new Array<Blob>();
    }

    // -----------------------------------------------------------------------------------
    // methods to set callbacks which will be called when data is received
    public SetMessageReceivedCallBack(callback: (dataChannel: WebRTCDataChannelLabel, channelMessage: ChannelMessage) => void) {
        this.receiveChannelMessageCallback = callback;
    }

    public SetSystemCommandCallBack(callback: (dataChannel: WebRTCDataChannelLabel, channelMessage: ChannelMessage) => void) {
        this.receiveSystemCommandCallback = callback;
    }

    public SetRemoteStreamCallBack(callback: (stream: any) => void) {
        this.remoteStreamCallback = callback;
    }
    // -----------------------------------------------------------------------------------

    // -----------------------------------------------------------------------------------
    // socket event handlers for handshake messages
    public async handleSystemCommand(command: SystemCommand) {
        // Nothing as of now, for future use
        return true;
    }

    public async handleOffer(offer: SignalingMessage) {
        if (!this.pc) {
            console.error('WebRTCCallService: handleOffer: No peer connection');
        }

        try {
            if (this.isInitiator === false) {
                colabLog(this.dataChannelLabel, ' ===================> WebRTCCallService: Received offer:');

                await this.pc!.setRemoteDescription(new RTCSessionDescription(offer.data)).then(async () => {

                    console.debug('WebRTCCallService: Creating answer');
                    const answer: any = await this.pc!.createAnswer().then(async (answer: any) => {
                        colabLog(this.dataChannelLabel, 'WebRTCCallService: Created answer:');

                        await this.pc!.setLocalDescription(answer).then(() => {
                            this.socket!.emit('message', { type: 'answer', dataChannelLabel: this.dataChannelLabel, data: { type: 'answer', sdp: answer.sdp }, datetime: new Date().toLocaleTimeString() });
                        });
                    });

                });
            }
        }
        catch (e) {
            console.error(offer.dataChannelLabel?.toChannel?.name, ' --> WebRTCCallService: Error in handleOffer', e);
        }
    }

    public async handleAnswer(answer: SignalingMessage) {
        if (!this.pc) {
            console.error(answer.dataChannelLabel?.toChannel?.name, ' --> WebRTCCallService: No peer connection');
            return;
        }

        if (this.isInitiator === true) {
            colabLog(this.dataChannelLabel, '===================> WebRTCCallService: Received answer:');
            colabLog(this.dataChannelLabel, 'WebRTCCallService: Signal state is ', this.pc!.signalingState);

            try {
                console.debug('WebRTCCallService: Setting remote description in handleAnswer');

                await this.pc!.setRemoteDescription(new RTCSessionDescription(answer.data)).then(() => {
                    colabLog(this.dataChannelLabel, 'WebRTCCallService: answer handled');
                });
            }
            catch (e) {
                console.error(answer.dataChannelLabel?.toChannel?.name, ' --> WebRTCCallService: Error in handleAnswer', e);
            }
        }
    }

    public async handleCandidate(candidate: SignalingMessage) {
        if (!this.pc) {
            console.error(candidate.dataChannelLabel?.toChannel?.name, ' --> WebRTCCallService: No peer connection');
            return;
        }

        try {

            colabLog(this.dataChannelLabel, ' ===================> WebRTCCallService: Received candidate:');
            console.debug('WebRTCCallService: Received candidate:', candidate);
            console.debug('WebRTCCallService: remoteDescription ', this.pc.remoteDescription);

            if (this.pc!.remoteDescription) {
                await this.pc!.addIceCandidate(new RTCIceCandidate(candidate.data)).then(() => {
                    console.debug(this.dataChannelLabel.fromChannel?.name, ' --> WebRTCCallService: candidate handled');

                    // if the connectio is ready, signal the peer that this side is ready
                    const msg = { type: 'ready', dataChannelLabel: this.dataChannelLabel, data: { type: 'ready', sdp: '' } };

                    this.handleReady(msg);
                });
            }

        }
        catch (e) {
            console.error(candidate.dataChannelLabel?.toChannel?.name, ' --> WebRTCCallService: Error in handleCandidate', e);
        }
    }

    public async handleReady(msg: SignalingMessage) {
        if (msg)
            console.debug('WebRTCCallService: Peer is ready. Singnaling Message is: ', msg);

        if (this.pc && !this.isConnected) {
            colabLog(this.dataChannelLabel, ' ===================> WebRTCCallService: handleReady');

            this.isConnected = true;

            if (this.isPeerConnected === false) {
                this.isPeerConnected = true;
                this.socket!.emit('message', { type: 'ready', dataChannelLabel: this.dataChannelLabel, data: { type: 'ready', sdp: '' }, datetime: new Date().toLocaleTimeString() });
            }
        }
    }

    public async handleBye(msg: SignalingMessage | null) {
        if (msg)
            console.debug('WebRTCCallService: GoodBye. Singnaling Message is: ', msg);

        colabLog(this.dataChannelLabel, ' ======================> WebRTCCallService: Closing call');

        const isClosed = this.CloseCall();
        if (!isClosed) {
            console.error('WebRTCCallService: Error closing call');
            return false;
        }

        if (this.isPeerConnected) {
            this.isPeerConnected = false;

            // signal peers to close the call on their side
            this.socket!.emit('message', { type: 'bye', dataChannelLabel: this.dataChannelLabel, data: { type: 'bye', sdp: '' }, datetime: new Date().toLocaleTimeString() });
        }

        return true;
    }
    // -----------------------------------------------------------------------------------

    // -----------------------------------------------------------------------------------
    sysCommandCallBack: (dataChannel: WebRTCDataChannelLabel) => void = () => { };

    // use case specific system command methods
    public SendSystemCommandViaSocket(command: SystemCommand, callback?: (dataChannel: WebRTCDataChannelLabel) => void) {
        try {
            if (command === null || command === undefined)
                return false;

            this.sysCommandCallBack = callback;

            colabLog(this.dataChannelLabel, 'WebRTCCallService: Sending command via socket:', command);
            colabLog(this.dataChannelLabel, 'WebRTCCallService: sent by:', this.dataChannelLabel.fromChannel.id);

            const msg: SignalingMessage = { type: 'system-command', dataChannelLabel: this.dataChannelLabel, data: command, datetime: new Date().toLocaleTimeString() };
            this.socket!.emit('message', msg);

            return true;
        }
        catch (error) {
            console.error('WebRTCCallService: Error sending system command via socket:', error);
            return false;
        }
    }

    public SocketCallback(response: string) {
        colabLog(this.dataChannelLabel, 'WebRTCCallService: System command send callback response:', response);

        if (this.sysCommandCallBack !== null && this.sysCommandCallBack !== undefined) {
            colabLog(this.dataChannelLabel, 'WebRTCCallService: System command calling back on ack on send');
            this.sysCommandCallBack(this.dataChannelLabel);
        }
    }

    public SendCallInitiatedMessage() {
        if (this.dataChannelLabel === null || this.dataChannelLabel === undefined) {
            console.error('WebRTCCallService: Invalid data channel label');
            return;
        }

        colabLog(this.dataChannelLabel, 'WebRTCCallService: Sending call initiated message');

        this.socket!.emit('message', { type: 'call-initiated', dataChannelLabel: this.dataChannelLabel, data: 'call-initiated', datetime: new Date().toLocaleTimeString() });
    }
    // -----------------------------------------------------------------------------------

    // -----------------------------------------------------------------------------------
    // IMPORTANT: ---------> ENTRY methods Init & Strat to establish peer connection, via handshakes and setup of send and receive data channels
    // on start call or on call initite callback - call InitCall
    // on call intiated callback - call StartCall
    // the send and receive data channels are the highest level webrtc artefacts to exchange text, data, media, stream media, screenshare etc. among peers
    public async InitCall(isInitiator: boolean, localStreamObj?: any) {
        colabLog(this.dataChannelLabel, 'WebRTCCallService: Initiating call');

        this.isInitiator = isInitiator;

        // start the peer connection
        await this.createPeerConnection();

        // handle candidate events
        this.pc!.addEventListener('icecandidate', (e: any) => this.handleIceCandidate(e));

        colabLog(this.dataChannelLabel, 'WebRTCCallService: Setting up receive channel callback');
        this.pc!.addEventListener('datachannel', (event: any) => this.receiveChannelCallback(event));

        // setup send channel
        this.sendChannel = this.pc!.createDataChannel(this.dataChannelLabel.dataChannelName!);
        colabLog(this.dataChannelLabel, 'WebRTCCallService: Created sendchannel with label:', this.sendChannel.label);

        // set up data channel event handlers
        this.setupDataChannel(this.sendChannel);

        // setup receive channel
        this.pc!.addEventListener('connectionstatechange', (event: any) => {
            if (this.pc === null || this.pc === undefined)
                return;

            colabLog(this.dataChannelLabel, 'WebRTCCallService: Connection state changed:', this.pc!.connectionState);
            if (this.pc!.connectionState === 'connected') {
                this.isConnected = true;
            }
        });

        if (localStreamObj === null || localStreamObj === undefined) {
            console.log('WebRTCCallService: No local stream object provided, hope it was intended');
            return false;
        }

        this.localStream = localStreamObj;

        if (this.localStream) {
            // this listener is called when the remote peer adds a stream to the peer connection
            this.pc!.addEventListener('addtrack', (event: any) => {
                colabLog(this.dataChannelLabel, 'WebRTCCallService: video streaming: setting up streams: track event');
            
                // Grab the remote track from the connected participant.
                if (this.remoteStreamCallback) {
                    colabLog(this.dataChannelLabel, 'WebRTCCallService: video streaming: setting up streams: remote stream');
                    this.remoteStreamCallback(event.streams[0]);
                }
            });

            colabLog(this.dataChannelLabel, 'WebRTCCallService: video streaming: setting up streams');
            console.debug('WebRTCCallService: dataChannelLabel in video stremaing:', this.dataChannelLabel);

            // !!! IMP:  this should setup the local stream first and then generate the remote stream
            colabLog(this.dataChannelLabel, 'WebRTCCallService: video streaming: setting up streams: localstream');

            // Add our stream to the peer connection.
            this.localStream.getTracks().forEach(
                (track: any) => this.pc!.addTrack(track, this.localStream)
            );
        }

        return true;
    }

    public async StartCall() {
        try {
            colabLog(this.dataChannelLabel, 'WebRTCCallService: Starting call');

            if (this.pc === null || this.pc === undefined) {
                console.error('WebRTCCallService: Start Call: Invalid peer connection');
                return false;
            }

            if (this.dataChannelLabel === null || this.dataChannelLabel === undefined) {
                console.error('!!!!!!!!! IMPORTANT: WebRTCCallService: Invalid data channel label');
                return false;
            }

            if (this.isInitiator) {
                // create offer for the peer
                console.debug('WebRTCCallService: Creating offer');
                let sessionConstraints = {
                    mandatory: {
                        OfferToReceiveAudio: true,
                        OfferToReceiveVideo: true,
                        VoiceActivityDetection: true
                    }
                };

                await this.pc!.createOffer(sessionConstraints).then(async (offer:any) => {
                    colabLog(this.dataChannelLabel, 'WebRTCCallService: created offer');

                    await this.pc!.setLocalDescription(offer).then(() => {
                        console.debug('WebRTCCallService: Set local description');

                        // send the offer to the peer
                        this.socket!.emit('message', { type: 'offer', dataChannelLabel: this.dataChannelLabel, data: { type: "offer", sdp: offer.sdp }, datetime: new Date().toLocaleTimeString() });
                        colabLog(this.dataChannelLabel, 'WebRTCCallService: Sent offer');
                    });
                });
            }

            colabLog(this.dataChannelLabel, "WebRTCCallService: Started call !!!!");

            return true;
        }
        catch (error) {
            console.error(this.dataChannelLabel.fromChannel.name, ' --> WebRTCCallService: Error starting CALL:', error);
            return false;
        }
    }

    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public CloseCall() {
        try {
            colabLog(this.dataChannelLabel, 'WebRTCCallService: in Closing call: ', this.dataChannelLabel!.dataChannelName!);

            if (!this.IsConnected()) {
                console.log('WARN: Already disconnected');
                return true;
            }

            if (this.sendChannel) {
                this.pc!.removeEventListener('open', (event: any) => this.onChannelStateChange(this.dataChannelLabel!.dataChannelName!, event));
                this.pc!.removeEventListener('close', (event: any) => this.onChannelStateChange(this.dataChannelLabel!.dataChannelName!, event));
                this.pc!.removeEventListener('message', (message: any) => this.onChannelMessage(this.dataChannelLabel!, message));
                this.pc!.removeEventListener('error', (error: any) => this.onChannelStateError(this.dataChannelLabel!.dataChannelName!, error));

                this.sendChannel?.close();
                this.sendChannel = null;
            }

            if (this.receiveChannel) {
                this.receiveChannel.removeEventListener('open', (event: any) => this.onChannelStateChange(this.dataChannelLabel!.dataChannelName!, event));
                this.receiveChannel.removeEventListener('close', (event: any) => this.onChannelStateChange(this.dataChannelLabel!.dataChannelName!, event));
                this.receiveChannel.removeEventListener('message', (message: any) => this.onChannelMessage(this.dataChannelLabel!, message));
                this.receiveChannel.removeEventListener('error', (error: any) => this.onChannelStateError(this.dataChannelLabel!.dataChannelName!, error));

                this.receiveChannel?.close();
                this.receiveChannel = null;
            }

            //this.StopRecording();
            this.StopStreaming();

            if (this.pc) {
                colabLog(this.dataChannelLabel, 'WebRTCCallService: Closing peer connection: setting pc to null');
                
                this.pc.removeEventListener('icecandidate', (e: any) => this.handleIceCandidate(e));
                this.pc.removeEventListener('datachannel', (event: any) => this.receiveChannelCallback(event));
                this.pc.close();
                this.pc = null;
            }

            colabLog(this.dataChannelLabel, 'WebRTCCallService: Closed peer connections');

            this.isConnected = false;
            this.offer = null;

            return true;
        }
        catch (error) {
            console.error('WebRTCCallService: Error closing CALL:', error);
            return false;''        }
    }

    // RTC Peer connection methods
    private async createPeerConnection() {
        try {
            colabLog(this.dataChannelLabel, 'WebRTCCallService: Creating peer connection');

            // get the TURN servers

            var peerConfiguration: RTCConfiguration = {
                iceServers: [
                    {
                        urls: ['stun:stun.l.google.com:19302'],
                    },
                    {
                        urls: "stun:stun.relay.metered.ca:80",
                    },
                    {
                        urls: "turn:global.relay.metered.ca:80",
                        username: "2ff778bdcdf9623965643700",
                        credential: "O6l64slS6+GzIyoD",
                    },
                    {
                        urls: "turn:global.relay.metered.ca:80?transport=tcp",
                        username: "2ff778bdcdf9623965643700",
                        credential: "O6l64slS6+GzIyoD",
                    },
                    {
                        urls: "turn:global.relay.metered.ca:443",
                        username: "2ff778bdcdf9623965643700",
                        credential: "O6l64slS6+GzIyoD",
                    },
                    {
                        urls: "turns:global.relay.metered.ca:443?transport=tcp",
                        username: "2ff778bdcdf9623965643700",
                        credential: "O6l64slS6+GzIyoD",
                    },
                ],
            };

            this.pc = new RTCPeerConnection(peerConfiguration);

            colabLog(this.dataChannelLabel, 'WebRTCCallService: Created peer connection');

            return this.pc;
        }
        catch (error) {
            console.error('WebRTCCallService: Error creating peer connection:', error);
            return null;
        }
    }

    private setupDataChannel(channel: any) {
        try {
            colabLog(this.dataChannelLabel, 'WebRTCCallService: Setting up data channel');

            channel.addEventListener('open', (event: any) => this.onChannelStateChange(this.dataChannelLabel!.dataChannelName!, event));
            channel.addEventListener('close', (event: any) => this.onChannelStateChange(this.dataChannelLabel!.dataChannelName!, event));
            channel.addEventListener('message', (message: any) => this.onChannelMessage(this.dataChannelLabel!, message));
            channel.addEventListener('error', (error: any) => this.onChannelStateError(this.dataChannelLabel!.dataChannelName!, error));

            colabLog(this.dataChannelLabel, 'WebRTCCallService: Data channel setup complete');
        }
        catch (error) {
            console.error('WebRTCCallService: Error setting up data channel:', error);
        }
    }

    // webrtc internal callbacks
    private handleIceCandidate(e: any) {
        try {
            let message = {
                type: 'candidate',
                dataChannelLabel: this.dataChannelLabel,
                data: {
                    type: 'candidate',
                    candidate: null as string | null,
                    sdpMid: null as string | null, // Add the sdpMid property
                    sdpMLineIndex: null as number | null, // Add the sdpMLineIndex property
                },
                datetime: new Date().toLocaleTimeString()
            };

            console.debug(this.dataChannelLabel.fromChannel?.name, ' --> WebRTCCallService: Received ICE candidate:');
            if (e.candidate) {
                message.data.candidate = e.candidate.candidate;
                message.data.sdpMid = e.candidate.sdpMid;
                message.data.sdpMLineIndex = e.candidate.sdpMLineIndex;
                this.socket!.emit('message', message);
            }

            console.debug(this.dataChannelLabel.fromChannel?.name, ' --> WebRTCCallService: ICE candidate handled');
        }
        catch (error) {
            console.error('WebRTCCallService: Error in handleIceCandidate', error);
        }
    }

    private receiveChannelCallback(event: any) {
        try {
            colabLog(this.dataChannelLabel, 'WebRTCCallService: ================> ReceiveChannel Callback');

            this.receiveChannel = event.channel;

            this.setupDataChannel(this.receiveChannel);
        }
        catch (error) {
            console.error('WebRTCCallService: Error in receiveChannelCallback:', error);
        }
    }

    private onChannelStateError(channelName: string, event: any): void {
        console.error('channel state is error:', event);
    }

    private onChannelStateChange(channelName: string, event: any): void {
        let datachannel: RTCDataChannel | null = null;
        colabLog(this.dataChannelLabel, '====================> WebRTCCallService: Channel state changed', event.channel);

        if (this.sendChannel) {
            datachannel = this.sendChannel;
            const readyState = this.sendChannel!.readyState;

            colabLog(this.dataChannelLabel, '====================> Send channel state is:', readyState);
        }

        if (this.receiveChannel && this.receiveChannel.label === channelName) {
            datachannel = this.receiveChannel;
            const readyState = this.receiveChannel.readyState;

            colabLog(this.dataChannelLabel, '====================> Receive channel state is:', readyState);
        }
    }

    // get/validate connections methods
    public GetChannel(): WebRTCDataChannelLabel {
        return this.dataChannelLabel!;
    }

    public IsConnected(): boolean {
        return this.isConnected;
    }

    public IsPeerConnected(): boolean {
        return this.isPeerConnected;
    }
    // -----------------------------------------------------------------------------------

    // -----------------------------------------------------------------------------------
    // methods to send and receive data via data channels
    private createChannelMessage(type: ChannelMessageType, direction: string, message: string): string {
        try {
            colabLog(this.dataChannelLabel, 'WebRTCCallService: Creating channel message:', message);
            const channelMessage: ChannelMessage = { dataChannel: this.dataChannelLabel!, type: type, direction: direction, channelmessage: message, userName: '', timestamp: new Date().toLocaleDateString() };
            const data = JSON.stringify(channelMessage);
            return data;
        }
        catch (error) {
            console.error('WebRTCCallService: Error creating channel message:', error);
            return '';
        }
    }

    public sendSystemCommand(command: SystemCommand) {
        try {
            if (command === null || command === undefined)
                return false;

            colabLog(this.dataChannelLabel, 'WebRTCCallService: Sending command:', command);

            this.sendData(command, ChannelMessageType.SystemCommand);

            return true;
        }
        catch (error) {
            console.error('WebRTCCallService: Error sending system command:', error);
            return false;
        }
    }

    public sendData(message: string, type: ChannelMessageType) {
        try {
            const channelMessage = this.createChannelMessage(type, 'out', message);

            colabLog(this.dataChannelLabel, 'WebRTCCallService: ---> Sending data:', message);
            colabLog(this.dataChannelLabel, 'WebRTCCallService: ---> Send channel state:', this.sendChannel?.readyState);

            if (this.sendChannel?.readyState === 'open') {
                colabLog(this.dataChannelLabel, "sendData 1", message);

                this.sendChannel.send(channelMessage);
                colabLog(this.dataChannelLabel, 'WebRTCCallService: ---> Sent data i send channel:', message);
            }
            else if (this.receiveChannel?.readyState === 'open') {
                colabLog(this.dataChannelLabel, "sendData 2", message);

                this.receiveChannel.send(channelMessage);
                colabLog(this.dataChannelLabel, 'WebRTCCallService: ---> Sent data in receive channel:', message);
            }
        }
        catch (error) {
            console.error('WebRTCCallService: Error sending data:', error);
        }
    }

    private blobToText(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText(blob);
        });
    }

    // receive data via data channels
    private onChannelMessage(dataChannelLabel: WebRTCDataChannelLabel, event: any) {
        try {
            colabLog(this.dataChannelLabel, 'WebRTCCallService: ----> Received message:', event.data);

            const messageData = event.data;

            // arrayBuffer can be received in chunks
            const handleArrayBuffer = (event: any) => {
                if (event.data instanceof ArrayBuffer) {
                    const arrayBuffer = event.data;
                    const chunk = new Uint8Array(event.data);
                    this.receivedChunks.push(chunk);
                    return true;
                }

                return false;
            }

            if (handleArrayBuffer(event))
                return true;

            // blob can be received in one chunk
            const handleBlob = (event: any) => {
                if (event.data instanceof Blob) {
                    const blob = event.data;
                    this.blobToText(blob).then((text) => {
                        colabLog(this.dataChannelLabel, 'WebRTCCallService: Received blob:', text);

                        channelMessage!.channelmessage = text;
                        return true;
                    });
                }

                return false;
            }

            if (handleBlob(event))
                return true;

            // IMPORTANT: rest of the messages received should be in ChannelMessage format
            let channelMessage: ChannelMessage | null = null;

            try {
                channelMessage = JSON.parse(event.data);
            }
            catch {
                console.error("WebRTCCallService: ----> Invalid format received, expected JSON ");
                console.error("WebRTCCallService: ----> message received not processed: ", event.data);

                return false;
            }

            // received proper ChannelMessage
            // reset few properties
            channelMessage!.direction = 'in';
            channelMessage!.dataChannel = dataChannelLabel;
            channelMessage!.timestamp = new Date().toLocaleTimeString();

            // if system commands
            if (this.onReceiveSystemCommand(dataChannelLabel, channelMessage!))
                return true;

            // eveything else, pass it up the stack
            this.receiveChannelMessageCallback(dataChannelLabel, channelMessage!);

            return true;
        }
        catch (error) {
            console.error('WebRTCCallService: Error in onChannelMessage:', error);
            return false;
        }
    }

    private onReceiveSystemCommand(dataChannelLabel: WebRTCDataChannelLabel, channelMessage: ChannelMessage) {
        try {
            if (channelMessage?.type === ChannelMessageType.SystemCommand) {

                // if media related system commands
                if (channelMessage?.channelmessage === SystemCommand.SYS_CMD_VIDEO_CHUNKS_SENT) {
                    this.isVideoMessage = true;
                    this.isAudioMessage = false;
                    this.joinChunks(dataChannelLabel);
                    return;
                }
                else if (channelMessage?.channelmessage === SystemCommand.SYS_CMD_AUDIO_CHUNKS_SENT) {
                    this.isAudioMessage = true;
                    this.isVideoMessage = false;
                    this.joinChunks(dataChannelLabel);
                    return;
                }

                // rest pass it up the stack
                this.receiveSystemCommandCallback(dataChannelLabel, channelMessage!);

                return true;
            }
        }
        catch (error) {
            console.error('WebRTCCallService: Error in onReceiveSystemCommand:', error);
            return false;
        }
    }
    // -----------------------------------------------------------------------------------

    // -----------------------------------------------------------------------------------
    // methods to start video/audio recording and send/receive video/audio data
    public async StartVideoMessaging(videoElement: any) {
        if (this.isConnected === false) {
            colabLog(this.dataChannelLabel, 'WebRTCCallService: starting call');
            await this.StartCall();
        }

        if (this.isConnected === false) {
            console.error('WebRTCCallService: Failed to start video call');
            return false;
        }

        this.isVideoMessage = true;
        this.isAudioMessage = false;

        console.debug('WebRTCCallService: dataChannelLabel in video messaging:', this.dataChannelLabel!.dataChannelName!);

        try {
            colabLog(this.dataChannelLabel, 'WebRTCCallService: starting video recording');

            this.videoElement = videoElement;

            this.localStream = await mediaDevices.getUserMedia({ video: true, audio: true });

            if (this.localStream) {
                colabLog(this.dataChannelLabel, 'WebRTCCallService: Accessing camera');
                this.videoElement!.srcObject = this.localStream;

                this.mediaRecorder = new MediaRecorder(this.localStream, { mimeType: 'video/webm' });
                this.mediaRecorder.ondataavailable = (event: any) => this.handleMediaDataAvailable(event);
                this.mediaRecorder.start();

                colabLog(this.dataChannelLabel, 'WebRTCCallService: Started video recording');
            }

            return true;
        } catch (error) {
            console.error('WebRTCCallService: Error accessing camera:', error);
            return false;
        }
    }

    public async StartAudioMessaging(audioElement: any) {
        if (this.isConnected === false) {
            await this.StartCall();
        }

        if (this.isConnected === false) {
            console.error('WebRTCCallService: Failed to start audio call');
            return false;
        }

        this.isAudioMessage = true;
        this.isVideoMessage = false;
        colabLog(this.dataChannelLabel, 'WebRTCCallService: dataChannelLabel in audio messaging:', this.dataChannelLabel!.dataChannelName!);

        try {
            colabLog(this.dataChannelLabel, 'WebRTCCallService: starting audio recording');
            this.audioElement = audioElement;

            this.localStream = await mediaDevices.getUserMedia({ audio: true });

            if (this.localStream) {
                colabLog(this.dataChannelLabel, 'WebRTCCallService: Accessing microphone');
                this.audioElement!.srcObject = this.localStream;

                this.mediaRecorder = new MediaRecorder(this.localStream, { mimeType: 'audio/webm' });
                this.mediaRecorder.ondataavailable = async (event: any) => await this.handleMediaDataAvailable(event);
                this.mediaRecorder.start();

                colabLog(this.dataChannelLabel, 'WebRTCCallService: Started video recording');
            }

            return true;
        } catch (error) {
            console.error('WebRTCCallService: Error accessing camera:', error);
            return false;
        }
    }

    private async handleMediaDataAvailable(event: any) {
        colabLog(this.dataChannelLabel, 'WebRTCCallService: Media data available');
        console.debug('WebRTCCallService: dataChannelLabel in media available function:', this.dataChannelLabel!.dataChannelName!);

        if (event.data.size > 0) {
            colabLog(this.dataChannelLabel, 'WebRTCCallService: MEdia data available size:', event.data.size);
            colabLog(this.dataChannelLabel, 'WebRTCCallService: Media recording chunks:', this.recordedChunks.length);

            this.recordedChunks.push(event.data);

            colabLog(this.dataChannelLabel, 'WebRTCCallService: Media recording chunks after:', this.recordedChunks.length);
        }
    }

    public async StopRecording() {
        if (this.mediaRecorder && this.localStream) {
            colabLog(this.dataChannelLabel, 'WebRTCCallService: Stopping media recording');

            this.mediaRecorder.stop();
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;

            if (this.videoElement) {
                this.videoElement.srcObject = null;
            }

            if (this.audioElement) {
                this.audioElement.srcObject = null;
            }

            colabLog(this.dataChannelLabel, 'WebRTCCallService: Stopped media recording');
        }
    }

    private joinChunks(dataChannelLabel: WebRTCDataChannelLabel): void {
        // All chunks have been received, reassemble the ArrayBuffer
        const totalLength = this.receivedChunks.reduce((total, chunk) => total + chunk.length, 0);
        const concatenatedBytes = new Uint8Array(totalLength);
        let offset = 0;

        this.receivedChunks.forEach(chunk => {
            concatenatedBytes.set(chunk, offset);
            offset += chunk.length;
        });

        colabLog(this.dataChannelLabel, 'WebRTCCallService: Received media data:', concatenatedBytes.byteLength);
        colabLog(this.dataChannelLabel, 'WebRTCCallService: Received media chunks:', this.receivedChunks.length);

        let blob = null;
        if (this.isVideoMessage) {
            blob = new Blob([concatenatedBytes], { type: 'video/webm' });
            colabLog(this.dataChannelLabel, 'WebRTCCallService: Received video blob', blob.size);
        }
        else if (this.isAudioMessage) {
            blob = new Blob([concatenatedBytes], { type: 'audio/webm' });
            colabLog(this.dataChannelLabel, 'WebRTCCallService: Received audio blob', blob.size);
        }

        if (blob === null) {
            console.error('WebRTCCallService: Received media data is not video or audio');
            return;
        }

        let url = URL.createObjectURL(blob);
        colabLog(this.dataChannelLabel, 'WebRTCCallService: Received media URL:', url);

        let channelMessage: ChannelMessage = { dataChannel: this.dataChannelLabel!, direction: 'in', userName: '', timestamp: new Date().toLocaleTimeString(), type: ChannelMessageType.Unknown, channelmessage: '' };
        if (this.isVideoMessage) {
            channelMessage.type = ChannelMessageType.Video;
            channelMessage.channelmessage = url;
        }
        else if (this.isAudioMessage) {
            channelMessage.type = ChannelMessageType.Audio;
            channelMessage.channelmessage = url;
        }

        this.receiveChannelMessageCallback(dataChannelLabel, channelMessage);

        this.receivedChunks = [];
    }

    public async SendVideo(): Promise<string> {
        if (this.recordedChunks.length === 0) {
            console.error('WebRTCCallService: No recorded chunks available');
            return '';
        }

        colabLog(this.dataChannelLabel, 'WebRTCCallService: Sending video');

        if (this.localStream) {
            colabLog(this.dataChannelLabel, 'WebRTCCallService: getting video localstream');
            this.localStream.getTracks().forEach(track => this.pc!.addTrack(track, this.localStream!));
        }

        colabLog(this.dataChannelLabel, 'WebRTCCallService: Sending video data');

        colabLog(this.dataChannelLabel, 'WebRTCCallService: ----> Sending video data');
        let url = this.sendMedia('video/webm');
        colabLog(this.dataChannelLabel, 'WebRTCCallService: ----> Sent video data:');

        colabLog(this.dataChannelLabel, 'WebRTCCallService: Sent video');
        this.recordedChunks = new Array<Blob>();
        this.localStream = null;

        return url;
    }

    public async SendAudio(): Promise<string> {
        if (this.recordedChunks.length === 0) {
            console.error('WebRTCCallService: No recorded chunks available');
            return '';
        }

        colabLog(this.dataChannelLabel, 'WebRTCCallService: Sending audio');
        if (this.localStream) {
            colabLog(this.dataChannelLabel, 'WebRTCCallService: getting audio localstream');
            this.localStream.getTracks().forEach((track:any) => this.pc!.addTrack(track, this.localStream!));
        }

        colabLog(this.dataChannelLabel, 'WebRTCCallService: Sending audio data');

        colabLog(this.dataChannelLabel, 'WebRTCCallService: ----> Sending audio data');
        let url = this.sendMedia('audio/webm');
        colabLog(this.dataChannelLabel, 'WebRTCCallService: ----> Sent audio data:');

        colabLog(this.dataChannelLabel, 'WebRTCCallService: Sent audio');
        this.recordedChunks = new Array<Blob>();
        this.localStream = null;

        return url;
    }

    private sendMedia(type: string): string {
        if (this.recordedChunks.length === 0) {
            colabLog(this.dataChannelLabel, 'WebRTCCallService: ----> No recorded chunks available');
            return '';
        }

        colabLog(this.dataChannelLabel, 'WebRTCCallService: ----> Sending media data');

        const concatenatedBlob = new Blob(this.recordedChunks, { type: type });
        let url = URL.createObjectURL(concatenatedBlob);

        // Convert Blob to ArrayBuffer
        const fileReader = new FileReader();
        fileReader.onload = () => {

            if (fileReader.result instanceof ArrayBuffer) {
                const arrayBuffer = fileReader.result;

                try {
                    this.sendArrayBufferChunks(arrayBuffer);

                    // send a dummy message indicating all chunks have been sent
                    let channelMsg = '';
                    if (this.isVideoMessage)
                        channelMsg = SystemCommand.SYS_CMD_VIDEO_CHUNKS_SENT;
                    else if (this.isAudioMessage)
                        channelMsg = SystemCommand.SYS_CMD_AUDIO_CHUNKS_SENT;

                    colabLog(this.dataChannelLabel, 'WebRTCCallService: Sending Media Message Sys Command:', channelMsg);

                    this.sendData(channelMsg, ChannelMessageType.SystemCommand);

                    colabLog(this.dataChannelLabel, 'WebRTCCallService: command sent');
                }
                catch (error) {
                    console.error('WebRTCCallService: Error sending media data:', error);
                }
            }
        };

        fileReader.readAsArrayBuffer(concatenatedBlob);

        return url;
    }

    private sendArrayBufferChunks(arrayBuffer: ArrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer);

        for (let offset = 0; offset < bytes.byteLength; offset += this.CHUNK_SIZE) {
            const chunk = bytes.slice(offset, offset + this.CHUNK_SIZE);

            // Send ArrayBuffer over data channel
            if (this.sendChannel!.readyState === 'open') {
                colabLog(this.dataChannelLabel, 'WebRTCCallService: Sending media data in send channel');

                this.sendChannel!.send(chunk);
            }
            else if (this.receiveChannel!.readyState === 'open') {
                colabLog(this.dataChannelLabel, 'WebRTCCallService: Sending media data in receive channel');

                this.receiveChannel!.send(chunk);
            }
            else
                console.error('WebRTCCallService: Data channel is not open to send media');
        }
    }

    public async GetRecordedVideoURL(type: string): Promise<string> {
        if (this.recordedChunks.length === 0) {
            console.error('WebRTCCallService: No recorded chunks available');
            return '';
        }

        console.debug('WebRTCCallService: Getting video URL');

        const concatenatedBlob = new Blob(this.recordedChunks, { type: type });
        let url = URL.createObjectURL(concatenatedBlob);

        colabLog(this.dataChannelLabel, 'WebRTCCallService: Got video URL:', url);

        return url;
    }

    // -----------------------------------------------------------------------------------
    // methods to start video/audio streaming
    public async StartVideoStreaming() {
        this.isVideoStreaming = true;
        this.isAudioStreaming = false;

        // start the peer connection setup
        await this.StartCall().then((isSuccess: boolean) => {
            if (isSuccess === false) {
                console.error('WebRTCCallService: Error in starting call for video streaming');
                return false;
            }

            if (this.pc === null || this.pc === undefined) {
                console.error('WebRTCCallService: FATAL: Start Call: Invalid peer connection');
                return false;
            }

            colabLog(this.dataChannelLabel, 'WebRTCCallService: video streaming: returning true');
            return true;
        }).catch(error => {
            console.error('WebRTCCallService: Error accessing camera:', error);
            return false;
        });
    }

    public async StartAudioStreaming(localStreamObj: any) {
        if (localStreamObj === null) {
            console.error('WebRTCCallService: localstream not set for streaming');
            return null;
        }

        this.isAudioStreaming = true;
        this.isVideoStreaming = false;

        colabLog(this.dataChannelLabel, 'WebRTCCallService: audio streaming: starting call');
        console.debug('WebRTCCallService: dataChannelLabel in Audio stremaing:', this.dataChannelLabel);

        try {
            // !!!!! FOR STREAMING LATE CALL of StartCall because first the localstream has to be setup
            const isSuccess = await this.StartCall();
            if (isSuccess === false) {
                console.error('WebRTCCallService: Error in starting call for audio streaming');
                return null;
            }

            colabLog(this.dataChannelLabel, 'WebRTCCallService: audio streaming: started call: remoteStream', this.remoteStream);

            return this.remoteStream;
        } catch (error) {
            console.error('WebRTCCallService: Error accessing camera:', error);
            return null;
        }
    }

    public StopStreaming() {
        if (this.localStream) {
            colabLog(this.dataChannelLabel, 'WebRTCCallService: Stopping media streaming');

            this.isVideoStreaming = false;
            this.isAudioStreaming = false;

            this.pc!.removeEventListener('track', (event: any) => this.remoteStreamCallback(event.streams[0]));
        }

        colabLog(this.dataChannelLabel, 'WebRTCCallService: Stopped media streaming');

        return true;
    }
}

export default WebRTCCallService;
