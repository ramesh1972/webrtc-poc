//import { RTCConfiguration, RTCPeerConnection, RTCSessionDescription, RTCSessionDescriptionInit, RTCPeerConnectionIceEvent, RTCDataChannel, RTCDataChannelEvent, RTCIceCandidate, BlobEvent } from 'react-native-webrtc';

import { io, Socket } from 'socket.io-client'

import { SystemCommand } from '../models/SystemCommand';
import SignalingMessage from '../models/SignalingMessage';
import { ChannelMessage, ChannelMessageType } from '../models/ChannelMessage';
import { ChannelType } from '../models/Channel';
import { WebRTCDataChannelLabel, WebRTCDataChannelType } from '../models/DataChannelLabel';

// TODO
// exception handling/error handling
// console.log messages
// disconnect gracefully

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
    private remotepc: RTCPeerConnection | null = null;
    private sendChannel: RTCDataChannel | null = null;
    private receiveChannel: RTCDataChannel | null = null;
    private dataChannelLabel?: WebRTCDataChannelLabel;

    // media messaging properties
    private CHUNK_SIZE = 16384; // Adjust the chunk size as needed
    private TURN_SERVER_URLS = 'stun:stun.l.google.com:19302';
    private videoElement: any | null = null;
    private audioElement: any | null = null;
    private localStream: MediaStream | null = null;
    private mediaRecorder: MediaRecorder | null = null;
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
    private receiveChannelMessageCallback: (channelMessage: ChannelMessage) => void = () => { };
    private receiveSystemCommandCallback: (channelMessage: ChannelMessage) => void = () => { };

    constructor(private readonly signalingServerUrl: string, dataChannelLabel: WebRTCDataChannelLabel | null = null) {
        console.log('WebRTCCallService: constructor signal URL: ', signalingServerUrl);

        if (dataChannelLabel !== null && dataChannelLabel !== undefined) {
            this.dataChannelLabel = dataChannelLabel;
        }
        else {
            console.error('WebRTCCallService: Invalid data channel label');
            return;
        }

        try {
            this.socket = io(signalingServerUrl);

            if (this.socket === null || this.socket === undefined) {
                console.error(' WebRTCCallService: Socket is null');
            }
        }
        catch (error) {
            console.error('WebRTCCallService: Error creating socket:', error);
        }

        console.log("WebRTCCallService: socket created");
        console.log('WebRTCCallService: Socket is not null:', this.socket);

        this.pc = null;
        this.remotepc = null;
        this.sendChannel = null;
        this.receiveChannel = null;

        this.recordedChunks = new Array<Blob>();

        // Set up signaling server event handlers
        this.socket!.on('connect', () => {
            console.log('WebRTCCallService: Connected to signaling server');
        });

        this.socket!.on('disconnect', () => {
            console.log('WebRTCCallService: Disconnected from signaling server');
            this.handleBye(null);
        });

        // the main signaling message handler
        this.socket!.on('message', async (message: SignalingMessage) => {
            if (message === null || message === undefined) {
                console.error('WebRTCCallService: Invalid signaling message');
                return;
            }

            console.log('WebRTCCallService: Received signaling message type:', message.type);

            if (message.dataChannelLabel === null || message.dataChannelLabel === undefined) {
                console.error('WebRTCCallService: Invalid data channel label');
                return;
            }

            if (message.dataChannelLabel!.dataChannelName === null || message.dataChannelLabel!.dataChannelName === undefined) {
                console.error('WebRTCCallService: Invalid data channel name');
                return;
            }

            console.log('WebRTCCallService: socket message dataChannelLabel:', message.dataChannelLabel!);
            console.log('WebRTCCallService: socket message this dataChannelLabel:', this.dataChannelLabel!);

            if (message.dataChannelLabel.dataChannelType === WebRTCDataChannelType.P2P) {
                if (message.dataChannelLabel.dataChannelName === this.dataChannelLabel!.dataChannelName) {
                    console.log("--------> WebRTCCallService: Correct channel exchange");
                }
                else {
                    console.log('--------> WebRTCCallService: Received message for wrong data channel:', message.dataChannelLabel.fromChannel?.name, this.dataChannelLabel!.fromChannel?.name);
                    return;
                }
            }
            else {
                console.error('-------------> WebRTCCallService: Unsupported channelType received:', message.dataChannelLabel.dataChannelType);
            }

            console.log('WebRTCCallService: Received signaling message dataChannelLabel:', message.dataChannelLabel!.dataChannelName, this.dataChannelLabel!.dataChannelName);
            console.log("WebRTCCallService: message fromChannel, to channel name", message.dataChannelLabel!.fromChannel?.name, message.dataChannelLabel!.toChannel!.name);
            console.log("WebRTCCallService: this datachannel fromChannel, to channel name", this.dataChannelLabel!.fromChannel?.name, this.dataChannelLabel!.toChannel!.name);

            switch (message.type) {
                case 'offer':
                    await this.handleOffer(message);
                    break;
                case 'answer':
                    await this.handleAnswer(message);
                    break;
                case 'candidate':
                    await this.handleCandidate(message);
                    break;
                case 'ready':
                    this.handleReady(message);
                    break;
                case 'bye':
                    this.handleBye(message);
                    break;
                default:
                    console.log('WebRTCCallService: Unhandled message:', message);
                    break;
            }
        });

        console.log('WebRTCCallService: Socket event handlers set');
    }

    public SetdataChannelLabel(dataChannelLabel: WebRTCDataChannelLabel) {
        this.dataChannelLabel = dataChannelLabel;
    }

    public SetMessageReceivedCallBack(callback: (channelMessage: ChannelMessage) => void) {
        this.receiveChannelMessageCallback = callback;
    }

    public SetSystemCommandCallBack(callback: (channelMessage: ChannelMessage) => void) {
        this.receiveSystemCommandCallback = callback;
    }

    // -----------------------------------------------------------------------------------
    // socket event handlers for handshake messages
    private async handleOffer(offer: SignalingMessage): Promise<void> {
        // if (this.pc) {
        //     console.error('WebRTCCallService: Existing peer connection');
        //     return;
        // }

        console.log('WebRTCCallService: Received offer:', offer);

        this.remotepc = await this.createPeerConnection();
        if (this.remotepc !== null) {
            console.log('WebRTCCallService: Setting up data channel callback');

            this.remotepc.ondatachannel = (event: RTCDataChannelEvent) => this.receiveChannelCallback(event);
        }

        await this.remotepc.setRemoteDescription(new RTCSessionDescription(offer.data));

        console.log('WebRTCCallService: Creating answer');

        const answer = await this.remotepc.createAnswer();

        const channelName = offer.dataChannelLabel;
        this.socket!.emit('message', { type: 'answer', dataChannelLabel: channelName, data: { type: 'answer', sdp: answer.sdp } });

        await this.remotepc.setLocalDescription(answer);

        console.log('WebRTCCallService: Created answer:', answer);

        this.remotepc!.onicecandidate = (e: RTCPeerConnectionIceEvent) => this.handleIceCandidate(e);
    }

    private async handleAnswer(answer: SignalingMessage): Promise<void> {
        if (!this.pc) {
            console.error('WebRTCCallService: No peer connection');
            return;
        }

        console.log('WebRTCCallService: Received answer:', answer);
        console.log('WebRTCCallService: Signal state is ', this.pc.signalingState);

        try {
            console.log('WebRTCCallService: Setting remote description in handleAnswer');
            await this.pc!.setRemoteDescription(new RTCSessionDescription(answer.data));
            console.log('WebRTCCallService: answer handled');
        }
        catch (e) {
            console.log('WebRTCCallService: Error in handleAnswer', e);
        }
    }

    private async handleCandidate(candidate: SignalingMessage): Promise<void> {
        if (!this.pc) {
            console.error('WebRTCCallService: No peer connection');
            return;
        }

        console.log('WebRTCCallService: Received candidate:', candidate);
        console.log('WebRTCCallService: remoteDescription ', this.pc.remoteDescription);

        if (this.pc.remoteDescription) {
            await this.pc!.addIceCandidate(new RTCIceCandidate(candidate.data));
            console.log('WebRTCCallService: candidate handled');
        }
    }

    private async handleIceCandidate(e: RTCPeerConnectionIceEvent): Promise<void> {
        let message = {
            type: 'candidate',
            dataChannelLabel: this.dataChannelLabel,
            data: {
                type: 'candidate',
                candidate: null as string | null,
                sdpMid: null as string | null, // Add the sdpMid property
                sdpMLineIndex: null as number | null, // Add the sdpMLineIndex property
            }
        };

        console.log('WebRTCCallService: Received ICE candidate:', e.candidate);
        if (e.candidate) {
            message.data.candidate = e.candidate.candidate;
            message.data.sdpMid = e.candidate.sdpMid;
            message.data.sdpMLineIndex = e.candidate.sdpMLineIndex;
            this.socket!.emit('message', message);
        }

        console.log('WebRTCCallService: ICE candidate handled');
    }

    private handleReady(msg: SignalingMessage): void {
        console.log('WebRTCCallService: Peer is ready. Singnaling Message is: ', msg);

        if (this.pc) {
            this.isConnected = true;

            if (this.isPeerConnected === false) {
                if (this.remotepc) {
                    this.socket!.emit('message', { type: 'ready', dataChannelLabel: this.dataChannelLabel, data: { type: 'ready', sdp: '' } });
                    this.isPeerConnected = true;
                }
            }
        }
    }


    private handleBye(msg: SignalingMessage | null): void {
        if (msg)
            console.log('WebRTCCallService: GoodBye. Singnaling Message is: ', msg);

        this.CloseCall();

        if (this.isPeerConnected) {
            this.socket!.emit('message', { type: 'bye', dataChannelLabel: this.dataChannelLabel, data: { type: 'bye', sdp: '' } });
            this.isPeerConnected = false;
        }
    }

    // -----------------------------------------------------------------------------------
    // RTC Peer connection methods
    private async createPeerConnection(): Promise<RTCPeerConnection> {
        let configuration: RTCConfiguration = { 'iceServers': [{ 'urls': this.TURN_SERVER_URLS }] };

        console.log('WebRTCCallService: Creating peer connection');
        this.pc = new RTCPeerConnection(configuration);

        console.log('WebRTCCallService: Created peer connection');

        console.log('==================> before Starting video streaming:', this.isVideoStreaming);
        console.log('==================> before Starting audio streaming:', this.isAudioStreaming);

        if (this.isVideoStreaming) {
            if (this.localStream) {
                this.pc!.ontrack = (e: RTCTrackEvent) => this.remoteVideoElement!.srcObject = e.streams[0];
                this.localStream!.getTracks().forEach(track => this.pc!.addTrack(track, this.localStream!));
            }
        }
        else if (this.isAudioStreaming) {
            if (this.localStream) {
                this.pc!.ontrack = (e: RTCTrackEvent) => this.remoteAudioElement!.srcObject = e.streams[0];
                this.localStream!.getTracks().forEach(track => this.pc!.addTrack(track, this.localStream!));
            }
        }

        return this.pc;
    }

    public IsConnected(): boolean {
        return this.isConnected;
    }

    // -----------------------------------------------------------------------------------
    // methods to establish data channel and send/receive data
    public async StartCall(dataChannelLabel: WebRTCDataChannelLabel) {
        try {
            console.log('WebRTCCallService: Starting call');

            await this.createPeerConnection();

            this.dataChannelLabel = dataChannelLabel;

            console.log('WebRTCCallService: Creating data channel:', this.dataChannelLabel);
            this.sendChannel = this.pc!.createDataChannel(dataChannelLabel.dataChannelName!);
            console.log('WebRTCCallService: Created sendchannel with label:', this.sendChannel.label);

            // set up data channel event handlers
            this.sendChannel.onopen = () => this.onChannelStateChange(dataChannelLabel.dataChannelName!);
            this.sendChannel.onmessage = (event: MessageEvent) => this.onChannelMessage(dataChannelLabel!, event);
            this.sendChannel.onerror = (error) => this.onChannelStateError(dataChannelLabel.dataChannelName!, error);
            this.sendChannel.onclose = () => this.onChannelStateChange(dataChannelLabel.dataChannelName!);

            console.log('WebRTCCallService: Creating offer');

            const offer = await this.pc!.createOffer();
            console.log('WebRTCCallService: createOffer return:', offer);
            console.log('WebRTCCallService: createOffer dataChannelLabel:', this.dataChannelLabel!.dataChannelName!);

            this.socket!.emit('message', { type: 'offer', dataChannelLabel: this.dataChannelLabel, data: { type: "offer", sdp: offer.sdp } });
            console.log('WebRTCCallService: Sent offer via socket:', offer);

            await this.pc!.setLocalDescription(offer);
            console.log('WebRTCCallService: Set local description');

            console.log('WebRTCCallService: Created offer:', offer);

            this.pc!.onicecandidate = (e: RTCPeerConnectionIceEvent) => this.handleIceCandidate(e);

            this.isConnected = true;

            console.log("WebRTCCallService: Started call !!!!");
        }
        catch (error) {
            console.error('WebRTCCallService: Error starting CALL:', error);
            return false;
        }

        return this.isConnected;
    }

    public async CloseCall(): Promise<void> {
        console.log('WebRTCCallService: in Closing call: ', this.dataChannelLabel!.dataChannelName!);

        if (this.pc) {
            console.log('WebRTCCallService: Closing peer connections');

            this.pc.close();
            this.pc = null;

            this.sendChannel?.close();
            this.sendChannel = null;

            this.receiveChannel?.close();
            this.receiveChannel = null;

            console.log('WebRTCCallService: Closed peer connections');
        }

        this.isConnected = false;
    }

    private createChannelMessage(type: ChannelMessageType, direction: string, message: string): string {
        const channelMessage: ChannelMessage = { dataChannel: this.dataChannelLabel!, type: type, direction: direction, channelmessage: message, userName: '', timestamp: new Date().toLocaleDateString() };
        const data = JSON.stringify(channelMessage);
        return data;
    }

    public sendSystemCommand(command: SystemCommand) {
        if (command === null || command === undefined)
            return false;

        console.log('WebRTCCallService: Sending command:', command);

        this.sendData(command, ChannelMessageType.SystemCommand);

        return true;
    }

    public sendData(message: string, type: ChannelMessageType) {

        const channelMessage = this.createChannelMessage(type, 'out', message);

        console.log('WebRTCCallService: +++++ Sending data:', message);
        console.log('WebRTCCallService: +++++ Send channel state:', this.sendChannel?.readyState);

        if (this.sendChannel?.readyState === 'open') {
            console.log("sendData 1", message);

            this.sendChannel.send(channelMessage);
            console.log('WebRTCCallService: +++++ Sent data i send channel:', message);
        }
        else if (this.receiveChannel?.readyState === 'open') {
            console.log("sendData 2", message);

            this.receiveChannel.send(channelMessage);
            console.log('WebRTCCallService: ++++++ Sent data in receive channel:', message);
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

    private async onChannelMessage(dataChannelLabel: WebRTCDataChannelLabel, event: MessageEvent) {
        console.log('WebRTCCallService: +++++ Received message:', event.data);

        const messageData = event.data;

        // arrayBuffer can be received in chunks
        const handleArrayBuffer = (event: MessageEvent) => {
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
        const handleBlob = (event: MessageEvent) => {
            if (event.data instanceof Blob) {
                const blob = event.data;
                this.blobToText(blob).then((text) => {
                    console.log('WebRTCCallService: Received blob:', text);
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
            console.error("WebRTCCallService: =====> Invalid format received, expected JSON ");
            console.error("WebRTCCallService: =====> message received not processed: ", event.data);
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
        this.receiveChannelMessageCallback(channelMessage!);

        return true;
    }

    private onReceiveSystemCommand(dataChannelLabel: WebRTCDataChannelLabel, channelMessage: ChannelMessage) {
        if (channelMessage?.type == ChannelMessageType.SystemCommand) {

            // if media related system commands
            if (channelMessage?.channelmessage === SystemCommand.SYS_CMD_VIDEO_CHUNKS_SENT) {
                this.isVideoMessage = true;
                this.isAudioMessage = false;
                this.joinChunks();
                return;
            }
            else if (channelMessage?.channelmessage === SystemCommand.SYS_CMD_AUDIO_CHUNKS_SENT) {
                this.isAudioMessage = true;
                this.isVideoMessage = false;
                this.joinChunks();
                return;
            }

            // rest pass it up the stack
            this.receiveSystemCommandCallback(channelMessage!);

            return true;
        }

        return false;
    }

    private async receiveChannelCallback(event: RTCDataChannelEvent): Promise<void> {
        console.log('WebRTCCallService: ================> ReceiveChannel Callback');

        this.receiveChannel = event.channel;

        this.receiveChannel.onmessage = (event: MessageEvent) => this.onChannelMessage(this.dataChannelLabel!, event);
        this.receiveChannel.onopen = () => this.onChannelStateChange(this.dataChannelLabel!.dataChannelName!);
        this.receiveChannel.onclose = () => this.onChannelStateChange(this.dataChannelLabel!.dataChannelName!);
        this.receiveChannel.onerror = (error) => this.onChannelStateError(this.dataChannelLabel!.dataChannelName!, error);
    }

    private onChannelStateError(dataChannelLabel: string, event: Event): void {
        console.error('WebRTCCallService: channel state is error:', event);
    }

    private onChannelStateChange(dataChannelLabel: string): void {
        console.log('WebRTCCallService: Channel state changed:', dataChannelLabel);

        if (this.sendChannel) {
            const readyState = this.sendChannel!.readyState;
            console.log('WebRTCCallService: Sendchannel state is:', readyState);
        }

        if (this.receiveChannel) {
            const readyState = this.receiveChannel.readyState;
            console.log('WebRTCCallService: Receivechannel state is:', readyState);
        }
    }

    // -----------------------------------------------------------------------------------
    // methods to start video/audio recording and send/receive video/audio data
    public async StartVideoMessaging(videoElement: any): Promise<boolean> {
        if (this.isConnected === false) {
            console.log('WebRTCCallService: starting call');
            await this.StartCall(this.dataChannelLabel!);
        }

        if (this.isConnected === false) {
            console.error('WebRTCCallService: Failed to start video call');
            return false;
        }

        this.isVideoMessage = true;
        this.isAudioMessage = false;

        console.log('WebRTCCallService: dataChannelLabel in video messaging:', this.dataChannelLabel!.dataChannelName!);

        try {
            console.log('WebRTCCallService: starting video recording');
            this.videoElement = videoElement;

            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

            if (this.localStream) {
                console.log('WebRTCCallService: Accessing camera');
                this.videoElement!.srcObject = this.localStream;

                // signal the peer that the channel is ready to send video data
                this.socket!.emit('message', { type: 'ready', dataChannelLabel: this.dataChannelLabel });

                this.mediaRecorder = new MediaRecorder(this.localStream, { mimeType: 'video/webm' });
                this.mediaRecorder.ondataavailable = (event: BlobEvent) => this.handleMediaDataAvailable(event);
                this.mediaRecorder.start();

                console.log('WebRTCCallService: Started video recording');
            }

            return true;
        } catch (error) {
            console.error('WebRTCCallService: Error accessing camera:', error);
            return false;
        }
    }

    public async StartAudioMessaging(audioElement: any): Promise<boolean> {
        if (this.isConnected === false) {
            await this.StartCall(this.dataChannelLabel!);
        }

        if (this.isConnected === false) {
            console.error('WebRTCCallService: Failed to start audio call');
            return false;
        }

        this.isAudioMessage = true;
        this.isVideoMessage = false;
        console.log('WebRTCCallService: dataChannelLabel in audio messaging:', this.dataChannelLabel!.dataChannelName!);

        try {
            console.log('WebRTCCallService: starting audio recording');
            this.audioElement = audioElement;

            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

            if (this.localStream) {
                console.log('WebRTCCallService: Accessing microphone');
                this.audioElement!.srcObject = this.localStream;

                // signal the peer that the channel is ready to send audio data
                this.socket!.emit('message', { type: 'ready', dataChannelLabel: this.dataChannelLabel });

                this.mediaRecorder = new MediaRecorder(this.localStream, { mimeType: 'audio/webm' });
                this.mediaRecorder.ondataavailable = async (event: BlobEvent) => await this.handleMediaDataAvailable(event);
                this.mediaRecorder.start();

                console.log('WebRTCCallService: Started video recording');
            }

            return true;
        } catch (error) {
            console.error('WebRTCCallService: Error accessing camera:', error);
            return false;
        }
    }

    private async handleMediaDataAvailable(event: BlobEvent) {
        console.log('WebRTCCallService: Media data available');
        console.log('WebRTCCallService: dataChannelLabel in media available function:', this.dataChannelLabel!.dataChannelName!);

        if (event.data.size > 0) {
            console.log('WebRTCCallService: MEdia data available:', event.data.size);
            console.log('WebRTCCallService: Media recording chunks:', this.recordedChunks.length);
            this.recordedChunks.push(event.data);
            console.log('WebRTCCallService: Media recording chunks after:', this.recordedChunks.length);
        }
    }

    public async StopRecording() {
        if (this.mediaRecorder && this.localStream) {
            console.log('WebRTCCallService: Stopping media recording');

            this.mediaRecorder.stop();
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;

            if (this.videoElement) {
                this.videoElement.srcObject = null;
            }

            if (this.audioElement) {
                this.audioElement.srcObject = null;
            }

            console.log('WebRTCCallService: Stopped media recording');
        }
    }

    public async StopStreaming() {
        if (this.localStream) {
            console.log('WebRTCCallService: Stopping media streaming');

            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;

            if (this.isVideoStreaming) {
                if (this.localVideoElement) {
                    // let mediaStream = this.localVideoElement.srcObject as MediaStream;
                    // mediaStream.getTracks().forEach(track => track.stop());

                    this.localVideoElement.srcObject = null;
                }

                if (this.remoteVideoElement) {
                    // let mediaStream = this.remoteVideoElement.srcObject as MediaStream;
                    // mediaStream.getTracks().forEach(track => track.stop());

                    this.remoteVideoElement.srcObject = null;
                }

                this.isVideoStreaming = false;
            }

            if (this.isAudioStreaming) {
                if (this.localAudioElement) {
                    // let mediaStream = this.localAudioElement.srcObject as MediaStream;
                    // mediaStream.getTracks().forEach(track => track.stop());

                    this.localAudioElement.srcObject = null;
                }

                if (this.remoteAudioElement) {
                    // let mediaStream = this.remoteAudioElement.srcObject as MediaStream;
                    // mediaStream.getTracks().forEach(track => track.stop());

                    this.remoteAudioElement.srcObject = null;
                }

                this.isAudioStreaming = false;
            }

            this.localStream = null;

            console.log('WebRTCCallService: Stopped media streaming');
        }
    }

    private joinChunks(): void {
        // All chunks have been received, reassemble the ArrayBuffer
        const totalLength = this.receivedChunks.reduce((total, chunk) => total + chunk.length, 0);
        const concatenatedBytes = new Uint8Array(totalLength);
        let offset = 0;

        this.receivedChunks.forEach(chunk => {
            concatenatedBytes.set(chunk, offset);
            offset += chunk.length;
        });

        console.log('WebRTCCallService: Received media data:', concatenatedBytes.byteLength);
        console.log('WebRTCCallService: Received media chunks:', this.receivedChunks.length);

        let blob = null;
        if (this.isVideoMessage) {
            blob = new Blob([concatenatedBytes], { type: 'video/webm' });
            console.log('WebRTCCallService: Received video blob', blob.size);
        }
        else if (this.isAudioMessage) {
            blob = new Blob([concatenatedBytes], { type: 'audio/webm' });
            console.log('WebRTCCallService: Received audio blob', blob.size);
        }

        if (blob === null) {
            console.error('WebRTCCallService: Received media data is not video or audio');
            return;
        }

        let url = URL.createObjectURL(blob);
        console.log('WebRTCCallService: Received media URL:', url);

        let channelMessage: ChannelMessage = { dataChannel: this.dataChannelLabel!, direction: 'in', userName: '', timestamp: new Date().toLocaleTimeString(), type: ChannelMessageType.Unknown, channelmessage: '' };
        if (this.isVideoMessage) {
            channelMessage.type = ChannelMessageType.Video;
            channelMessage.channelmessage = url;
        }
        else if (this.isAudioMessage) {
            channelMessage.type = ChannelMessageType.Audio;
            channelMessage.channelmessage = url;
        }

        this.receiveChannelMessageCallback(channelMessage);

        this.receivedChunks = [];
    }

    public async SendVideo(): Promise<string> {
        if (this.recordedChunks.length === 0) {
            console.error('WebRTCCallService: No recorded chunks available');
            return '';
        }

        console.log('WebRTCCallService: Sending video');
        if (this.localStream) {
            console.log('WebRTCCallService: getting video localstream');
            this.localStream.getTracks().forEach(track => this.pc!.addTrack(track, this.localStream!));
        }

        console.log('WebRTCCallService: Sending video data');

        console.log('WebRTCCallService: +++++ Sending video data');
        let url = this.sendMedia(this.dataChannelLabel!, 'video/webm');
        console.log('WebRTCCallService: +++++ Sent video data:');

        console.log('WebRTCCallService: Sent video');
        this.recordedChunks = new Array<Blob>();
        this.localStream = null;

        return url;
    }

    public async SendAudio(): Promise<string> {
        if (this.recordedChunks.length === 0) {
            console.error('WebRTCCallService: No recorded chunks available');
            return '';
        }

        console.log('WebRTCCallService: Sending audio');
        if (this.localStream) {
            console.log('WebRTCCallService: getting audio localstream');
            this.localStream.getTracks().forEach(track => this.pc!.addTrack(track, this.localStream!));
        }

        console.log('WebRTCCallService: Sending audio data');

        console.log('WebRTCCallService: +++++ Sending audio data');
        let url = this.sendMedia(this.dataChannelLabel!, 'audio/webm');
        console.log('WebRTCCallService: +++++ Sent audio data:');

        console.log('WebRTCCallService: Sent audio');
        this.recordedChunks = new Array<Blob>();
        this.localStream = null;

        return url;
    }

    private sendMedia(dataChannelLabel: WebRTCDataChannelLabel, type: string): string {
        if (this.recordedChunks.length === 0) {
            console.log('WebRTCCallService: ============> No recorded chunks available');
            return '';
        }

        console.log('WebRTCCallService: ==============> Sending media data');

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

                    this.sendData(channelMsg, ChannelMessageType.SystemCommand);
                    console.log('WebRTCCallService: Sent media data');
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
                console.log('WebRTCCallService: Sending media data in send channel');
                this.sendChannel!.send(chunk);
            }
            else if (this.receiveChannel!.readyState === 'open') {
                console.log('WebRTCCallService: Sending media data in receive channel');
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

        console.log('WebRTCCallService: Getting video URL');
        const concatenatedBlob = new Blob(this.recordedChunks, { type: type });
        let url = URL.createObjectURL(concatenatedBlob);
        console.log('WebRTCCallService: Got video URL:', url);

        return url;
    }

    // -----------------------------------------------------------------------------------
    // methods to start video/audio streaming
    public async StartVideoStreaming(dataChannel: WebRTCDataChannelLabel, localVideoElement: any, remoteVideoElement: any): Promise<boolean> {
        if (remoteVideoElement === null || remoteVideoElement === undefined) {
            console.error('WebRTCCallService: Remote video element not set for streaming');
            return false;
        }

        this.isVideoStreaming = true;
        this.isAudioStreaming = false;

        this.localVideoElement = localVideoElement;
        this.remoteVideoElement = remoteVideoElement;

        this.dataChannelLabel = dataChannel;

        console.log('WebRTCCallService: video streaming: starting call');

        if (this.isConnected === false) {
            console.log('WebRTCCallService: starting call again');
            await this.StartCall(dataChannel!);
        }
        else {
            console.log('Already connected');
            await this.CloseCall();
        }

        console.log('WebRTCCallService: dataChannelLabel in video stremaing:', this.dataChannelLabel);

        try {
            console.log('WebRTCCallService: starting video stremaing');

            console.log('WebRTCCallService: Accessing camera');
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

            if (this.localStream) {
                console.log('WebRTCCallService: final setup for video streaming');
                this.localVideoElement!.srcObject = this.localStream;

                this.socket!.emit('message', { type: 'ready', dataChannelLabel: this.dataChannelLabel });

            }

            await this.StartCall(this.dataChannelLabel);
            return true;
        }
        catch (error) {
            console.error('WebRTCCallService: Error in video streaming:', error);
            return false;
        }
    }

    public async StartAudioStreaming(dataChannel: WebRTCDataChannelLabel, localAudioElement: any, remoteAudioElement: any): Promise<boolean> {
        if (remoteAudioElement === null || remoteAudioElement === undefined) {
            console.error('WebRTCCallService: Remote audio element not set for streaming');
            return false;
        }

        this.isAudioStreaming = true;
        this.isVideoStreaming = false;

        this.localAudioElement = localAudioElement;
        this.remoteAudioElement = remoteAudioElement;

        this.dataChannelLabel = dataChannel;

        console.log('WebRTCCallService: audio streaming: starting call');

        if (this.isConnected === false) {
            this.dataChannelLabel = dataChannel;
            await this.StartCall(dataChannel!);
        }
        else {
            console.log('WebRTCCallService: Already connected');
            await this.CloseCall();
        }

        console.log('WebRTCCallService: dataChannelLabel in Audio stremaing:', this.dataChannelLabel);

        try {
            console.log('WebRTCCallService: Accessing microphone');
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });

            if (this.localStream) {
                this.localAudioElement!.srcObject = this.localStream;

                // signal the peer that the channel is ready to send Audio data
                this.socket!.emit('message', { type: 'ready', dataChannelLabel: this.dataChannelLabel });
            }

            await this.StartCall(dataChannel!);

            return true;
        } catch (error) {
            console.error('WebRTCCallService: Error accessing camera:', error);
            return false;
        }
    }
}

export default WebRTCCallService;
