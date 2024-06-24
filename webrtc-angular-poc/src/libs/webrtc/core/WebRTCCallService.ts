/* import {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    EventOnAddStream,
    mediaDevices
} from 'react-native-webrtc'; */
import { io, Socket } from 'socket.io-client'

import { Channel } from '../models/Channel';
import { SystemCommand } from '../models/SystemCommand';
import SignalingMessage from '../models/SignalingMessage';
import { ChannelMessage, ChannelMessageType } from '../models/ChannelMessage';
import { WebRTCDataChannelLabel, WebRTCDataChannelType } from '../models/DataChannelLabel';
import { faUnderline } from '@fortawesome/free-solid-svg-icons';
//import { MediaStreamTrack } from 'react-native-webrtc';

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

    private groupMember: Channel | undefined = undefined;

    // media messaging properties
    private CHUNK_SIZE = 16384; // Adjust the chunk size as needed
    private TURN_SERVER_URLS = 'stun:stun.l.google.com:19302';
    private videoElement: any | null = null;
    private audioElement: any | null = null;
    private localStream: any | null = null;
    private remoteStream: any | null = null;
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
    private receiveChannelMessageCallback: (dataChannel: WebRTCDataChannelLabel, channelMessage: ChannelMessage) => void = () => { };
    private receiveSystemCommandCallback: (dataChannel: WebRTCDataChannelLabel, channelMessage: ChannelMessage) => void = () => { };
    private remoteStreamCallback: (stream: any) => void = () => { };

    constructor(private readonly signalingServerUrl: string, dataChannelLabel: WebRTCDataChannelLabel | null = null, groupMember?: Channel) {
        console.log('WebRTCCallService: constructor signal URL: ', signalingServerUrl);

        this.groupMember = groupMember;

        // if GROUP connection, then dataChannelName is null
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

            console.debug('WebRTCCallService: socket message dataChannelLabel:', message.dataChannelLabel!);
            console.debug('WebRTCCallService: socket message this dataChannelLabel:', this.dataChannelLabel!);

            if (message.dataChannelLabel.dataChannelName === this.dataChannelLabel!.dataChannelName) {
                console.log("--------> WebRTCCallService: Correct channel exchange", dataChannelLabel!.dataChannelName, this.dataChannelLabel!.dataChannelName);
            }
            else {
                console.debug('--------> WebRTCCallService: Received message for wrong data channel:', message.dataChannelLabel.fromChannel?.name, this.dataChannelLabel!.fromChannel?.name);
                return;
            }

            console.debug('WebRTCCallService: Received signaling message dataChannelLabel:', message.dataChannelLabel!.dataChannelName, this.dataChannelLabel!.dataChannelName);
            console.debug("WebRTCCallService: message fromChannel, to channel name", message.dataChannelLabel!.fromChannel?.name, message.dataChannelLabel!.toChannel!.name);
            console.debug("WebRTCCallService: this datachannel fromChannel, to channel name", this.dataChannelLabel!.fromChannel?.name, this.dataChannelLabel!.toChannel!.name);

            if (this.groupMember !== null && this.groupMember !== undefined && message.dataChannelLabel.fromChannel?.id === this.groupMember!.id) {
                console.debug("same side user id");
                return;
            }

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

    private sendSocketMessage(msg: SignalingMessage) {
        if (this.groupMember !== null || this.groupMember !== undefined)
            msg.groupMember = this.groupMember;

        this.socket!.emit('message', msg);
    }

    public SetMessageReceivedCallBack(callback: (dataChannel: WebRTCDataChannelLabel, channelMessage: ChannelMessage) => void) {
        this.receiveChannelMessageCallback = callback;
    }

    public SetSystemCommandCallBack(callback: (dataChannel: WebRTCDataChannelLabel, channelMessage: ChannelMessage) => void) {
        this.receiveSystemCommandCallback = callback;
    }

    public SetRemoteStreamCallBack(callback: (stream: any) => void) {
        this.remoteStreamCallback = callback;
    }

    public GetChannel(): WebRTCDataChannelLabel {
        return this.dataChannelLabel!;
    }

    // -----------------------------------------------------------------------------------
    // socket event handlers for handshake messages
    private async handleOffer(offer: SignalingMessage): Promise<void> {
        /*         if (!this.pc) {
                    console.error('WebRTCCallService: No peer connection');
                    return;
                } */

        try {
            console.log('WebRTCCallService: Received offer:');

            //await this.createPeerConnection();

            await this.pc!.setRemoteDescription(new RTCSessionDescription(offer.data));

            console.debug('WebRTCCallService: Creating answer');
            const answer = await this.pc!.createAnswer();

            const channelName = offer.dataChannelLabel;

            this.sendSocketMessage({ type: 'answer', dataChannelLabel: channelName, data: { type: 'answer', sdp: answer.sdp } });
            await this.pc!.setLocalDescription(answer);

            console.log('WebRTCCallService: Created answer:');

            this.pc!.onicecandidate = (e: RTCPeerConnectionIceEvent) => this.handleIceCandidate(e);
        }
        catch (e) {
            console.error('WebRTCCallService: Error in handleOffer', e);
        }
    }

    private async handleAnswer(answer: SignalingMessage): Promise<void> {
        if (!this.pc) {
            console.error('WebRTCCallService: No peer connection');
            return;
        }

        console.log('WebRTCCallService: Received answer:');
        console.log('WebRTCCallService: Signal state is ', this.pc.signalingState);

        try {
            console.debug('WebRTCCallService: Setting remote description in handleAnswer');
            await this.pc!.setRemoteDescription(new RTCSessionDescription(answer.data));
            console.log('WebRTCCallService: answer handled');
        }
        catch (e) {
            console.error('WebRTCCallService: Error in handleAnswer', e);
        }
    }

    private async handleCandidate(candidate: SignalingMessage): Promise<void> {
        if (!this.pc) {
            console.error('WebRTCCallService: No peer connection');
            return;
        }

        //console.debug('WebRTCCallService: Received candidate:', candidate);
        //console.debug('WebRTCCallService: remoteDescription ', this.pc.remoteDescription);

        if (this.pc.remoteDescription) {
            await this.pc!.addIceCandidate(new RTCIceCandidate(candidate.data));
            console.log('WebRTCCallService: candidate handled');
        }

        this.sendSocketMessage({ type: 'ready', dataChannelLabel: this.dataChannelLabel!, data: { type: 'ready', sdp: '' } })
    }

    private async handleIceCandidate(e: RTCPeerConnectionIceEvent): Promise<void> {
        const message = {
            type: 'candidate',
            dataChannelLabel: this.dataChannelLabel!,
            data: {
                type: 'candidate',
                candidate: null as string | null,
                sdpMid: null as string | null, // Add the sdpMid property
                sdpMLineIndex: null as number | null, // Add the sdpMLineIndex property
            }
        };

        console.log('WebRTCCallService: Received ICE candidate:');
        if (e.candidate) {
            message.data.candidate = e.candidate.candidate;
            message.data.sdpMid = e.candidate.sdpMid;
            message.data.sdpMLineIndex = e.candidate.sdpMLineIndex;
            this.sendSocketMessage(message);
        }

        console.log('WebRTCCallService: ICE candidate handled');
    }

    private handleReady(msg: SignalingMessage): void {
        console.log('WebRTCCallService: Peer is ready. Singnaling Message is: ', msg);

        if (this.pc) {
            this.isConnected = true;

            if (this.isPeerConnected === false) {
                //this.socket!.emit('message', { type: 'ready', dataChannelLabel: this.dataChannelLabel, data: { type: 'ready', sdp: '' } });
                this.isPeerConnected = true;
            }
        }
    }


    handleBye(msg: SignalingMessage | null): void {
        if (msg)
            console.log('WebRTCCallService: GoodBye. Singnaling Message is: ', msg);

        this.CloseCall();

        if (this.isPeerConnected) {
            this.sendSocketMessage({ type: 'bye', dataChannelLabel: this.dataChannelLabel!, data: { type: 'bye', sdp: '' } });
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
                this.pc.ontrack = (event) => {
                    console.log('CallService: setting remote stream', event.streams[0]);

                    if (this.remoteStreamCallback) {
                        this.remoteStreamCallback(event.streams[0]);
                    }
                }

                this.localStream.getTracks().forEach((track: MediaStreamTrack) => this.pc?.addTrack(track, this.localStream));
            }
        }
        /*  else if (this.isAudioStreaming) {
             if (this.localStream) {
                 this.pc!.ontrack = (e: RTCTrackEvent) => { this.remoteStream = e.streams[0] };
                 this.localStream.getTracks().forEach((track: MediaStreamTrack) => this.pc?.add(track, this.localStream));
             }
         } */

        return this.pc;
    }

    public IsConnected(): boolean {
        return this.isConnected;
    }

    public IsPeerConnected(): boolean {
        return this.isPeerConnected;
    }

    // -----------------------------------------------------------------------------------
    // methods to establish data channel and send/receive data
    public async StartCall() {
        try {
            console.log('WebRTCCallService: Starting call');

            if (this.dataChannelLabel === null || this.dataChannelLabel === undefined) {
                console.error('!!!!!!!!! IMPORTANT: WebRTCCallService: Invalid data channel label');
                return false;
            }

            // start the peer connection
            await this.createPeerConnection();

            // create the RTCDataChannel
            console.log('WebRTCCallService: Creating data channel:', this.dataChannelLabel!.dataChannelName);
            this.sendChannel = this.pc!.createDataChannel(this.dataChannelLabel.dataChannelName!);

            console.log('WebRTCCallService: Created sendchannel with label:', this.sendChannel.label);

                        console.log('WebRTCCallService: Setting up data channel callback');
            this.pc!.ondatachannel = (event: RTCDataChannelEvent) => this.receiveChannelCallback(event);

            // set up data channel event handlers
            this.sendChannel.onopen = () => this.onChannelStateChange(this.dataChannelLabel!.dataChannelName!);
            this.sendChannel.onmessage = (event: MessageEvent) => this.onChannelMessage(this.dataChannelLabel!, event);
            this.sendChannel.onerror = (error) => this.onChannelStateError(this.dataChannelLabel!.dataChannelName!, error);
            this.sendChannel.onclose = () => this.onChannelStateChange(this.dataChannelLabel!.dataChannelName!);

            // create offer for the peer
            console.debug('WebRTCCallService: Creating offer');
            const offer = await this.pc!.createOffer();
            console.log('WebRTCCallService: created offer');

            // send it across to the peer
            // the initiate-call message is to the pther side of the peer to create the data channel and the initiate peer connections
            // if already not created or started to create
            //this.socket!.emit('message', { type: 'initiate-call', dataChannelLabel: this.dataChannelLabel, data: 'initiate' });

            // send an offer to the peer
            this.sendSocketMessage({ type: 'offer', dataChannelLabel: this.dataChannelLabel, data: { type: "offer", sdp: offer.sdp } });

            console.log('WebRTCCallService: Sent offer');

            await this.pc!.setLocalDescription(offer);
            console.debug('WebRTCCallService: Set local description');

            this.pc!.onicecandidate = (e: RTCPeerConnectionIceEvent) => this.handleIceCandidate(e);

            console.log("WebRTCCallService: Started call !!!!");

            return true;
        }
        catch (error) {
            console.error('WebRTCCallService: Error starting CALL:', error);
            return false;
        }
    }

    public async CloseCall(): Promise<void> {
        console.log('WebRTCCallService: in Closing call: ', this.dataChannelLabel!.dataChannelName!);

        if (this.pc) {
            console.log('WebRTCCallService: Closing peer connections');

            this.pc.close();
            this.pc.onicecandidate = null;
            this.pc.ontrack = null;
            this.pc.ondatachannel = null;
            this.pc = null;

        }

        if (this.sendChannel) {
            this.sendChannel?.close();
            this.sendChannel = null;
        }

        if (this.receiveChannel) {
            this.receiveChannel?.close();
            this.receiveChannel = null;
        }

        this.StopRecording();
        this.StopStreaming();

        console.log('WebRTCCallService: Closed peer connections');

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

        console.log('WebRTCCallService: ---> Sending data:', message);
        console.log('WebRTCCallService: ---> Send channel state:', this.sendChannel?.readyState);

        if (this.sendChannel?.readyState === 'open') {
            console.log("sendData 1", message);

            this.sendChannel.send(channelMessage);
            console.log('WebRTCCallService: ---> Sent data i send channel:', message);
        }
        else if (this.receiveChannel?.readyState === 'open') {
            console.log("sendData 2", message);

            this.receiveChannel.send(channelMessage);
            console.log('WebRTCCallService: ---> Sent data in receive channel:', message);
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

    private onChannelMessage(dataChannelLabel: WebRTCDataChannelLabel, event: MessageEvent) {
        console.log('WebRTCCallService: ----> Received message:', event.data);

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

    private onReceiveSystemCommand(dataChannelLabel: WebRTCDataChannelLabel, channelMessage: ChannelMessage) {
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

        return false;
    }

    private async receiveChannelCallback(event: RTCDataChannelEvent): Promise<void> {
        console.log('WebRTCCallService: ================> ReceiveChannel Callback');

        this.receiveChannel = event.channel;


        this.receiveChannel.onopen = () => this.onChannelStateChange(this.dataChannelLabel!.dataChannelName!);
        this.receiveChannel.onmessage = (event: MessageEvent) => this.onChannelMessage(this.dataChannelLabel!, event);
        this.receiveChannel.onerror = (error) => this.onChannelStateError(this.dataChannelLabel!.dataChannelName!, error);
        this.receiveChannel.onclose = () => this.onChannelStateChange(this.dataChannelLabel!.dataChannelName!);
    }

    private onChannelStateError(channelName: string, event: Event): void {
        console.error('channel state is error:', event);
    }

    private onChannelStateChange(channelName: string): void {
        let datachannel: RTCDataChannel | null = null;

        if (this.sendChannel) {
            datachannel = this.sendChannel;
            const readyState = this.sendChannel!.readyState;

            console.log('Send channel state is:', readyState);
        }

        if (this.receiveChannel && this.receiveChannel.label === channelName) {
            datachannel = this.receiveChannel;
            const readyState = this.receiveChannel.readyState;

            console.log('Receive channel state is:', readyState);
        }
    }


    // -----------------------------------------------------------------------------------
    // methods to start video/audio recording and send/receive video/audio data
    public async StartVideoMessaging(videoElement: any): Promise<boolean> {
        if (this.isConnected === false) {
            console.log('WebRTCCallService: starting call');
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
            console.log('WebRTCCallService: starting video recording');

            this.videoElement = videoElement;

            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

            if (this.localStream) {
                console.log('WebRTCCallService: Accessing camera');
                this.videoElement!.srcObject = this.localStream;

                // signal the peer that the channel is ready to send video data
                //this.socket!.emit('message', { type: 'ready', dataChannelLabel: this.dataChannelLabel });

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
            await this.StartCall();
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
                //this.socket!.emit('message', { type: 'ready', dataChannelLabel: this.dataChannelLabel });

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
        console.debug('WebRTCCallService: dataChannelLabel in media available function:', this.dataChannelLabel!.dataChannelName!);

        if (event.data.size > 0) {
            console.log('WebRTCCallService: MEdia data available size:', event.data.size);
            console.log('WebRTCCallService: Media recording chunks:', this.recordedChunks.length);

            this.recordedChunks.push(event.data);

            console.log('WebRTCCallService: Media recording chunks after:', this.recordedChunks.length);
        }
    }

    public async StopRecording() {
        if (this.mediaRecorder && this.localStream) {
            console.log('WebRTCCallService: Stopping media recording');

            this.mediaRecorder.stop();
            this.localStream.getTracks().forEach((track: any) => track.stop());
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

    private joinChunks(dataChannelLabel: WebRTCDataChannelLabel): void {
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

        this.receiveChannelMessageCallback(dataChannelLabel, channelMessage);

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
            this.localStream.getTracks().forEach((track: any) => this.pc!.addTrack(track, this.localStream!));
        }

        console.log('WebRTCCallService: Sending video data');

        console.log('WebRTCCallService: ----> Sending video data');
        let url = this.sendMedia('video/webm');
        console.log('WebRTCCallService: ----> Sent video data:');

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
            this.localStream.getTracks().forEach((track: any) => this.pc!.addTrack(track, this.localStream!));
        }

        console.log('WebRTCCallService: Sending audio data');

        console.log('WebRTCCallService: ----> Sending audio data');
        let url = this.sendMedia('audio/webm');
        console.log('WebRTCCallService: ----> Sent audio data:');

        console.log('WebRTCCallService: Sent audio');
        this.recordedChunks = new Array<Blob>();
        this.localStream = null;

        return url;
    }

    private sendMedia(type: string): string {
        if (this.recordedChunks.length === 0) {
            console.log('WebRTCCallService: ----> No recorded chunks available');
            return '';
        }

        console.log('WebRTCCallService: ----> Sending media data');

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

                    console.log('WebRTCCallService: Sending Media Message Sys Command:', channelMsg);

                    this.sendData(channelMsg, ChannelMessageType.SystemCommand);

                    console.log('WebRTCCallService: command sent');
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

        console.debug('WebRTCCallService: Getting video URL');

        const concatenatedBlob = new Blob(this.recordedChunks, { type: type });
        let url = URL.createObjectURL(concatenatedBlob);

        console.log('WebRTCCallService: Got video URL:', url);

        return url;
    }

    // -----------------------------------------------------------------------------------
    // methods to start video/audio streaming
    SetStreamParams(localVideoElement: any, remoteVideoElement: any, localAudioElement: any, remoteAudioElement: any) {
        this.localVideoElement = localVideoElement;
        this.remoteVideoElement = remoteVideoElement;
        this.localAudioElement = localAudioElement;
        this.remoteAudioElement = remoteAudioElement;
    }

    public async StartVideoStreaming(localStreamObj: any) {
        if (localStreamObj === null) {
            console.error('WebRTCCallService: localstream not set for streaming');
            return null;
        }

        this.localStream = localStreamObj;

        this.isVideoStreaming = true;
        this.isAudioStreaming = false;

        console.log('WebRTCCallService: video streaming: starting call');
        //console.debug('WebRTCCallService: dataChannelLabel in video stremaing:', this.dataChannelLabel);

        // !!!!! FOR STREAMING LATE CALL of StartCall because first the localstream has to be setup
        return await this.StartCall();
    }

    public async StartAudioStreaming(localStreamObj: any) {
        if (localStreamObj === null) {
            console.error('WebRTCCallService: localstream not set for streaming');
            return null;
        }

        this.isAudioStreaming = true;
        this.isVideoStreaming = false;

        console.log('WebRTCCallService: audio streaming: starting call');
        console.debug('WebRTCCallService: dataChannelLabel in Audio stremaing:', this.dataChannelLabel);

        try {
            // !!!!! FOR STREAMING LATE CALL of StartCall because first the localstream has to be setup
            const isSuccess = await this.StartCall();
            if (isSuccess === false) {
                console.error('WebRTCCallService: Error in starting call for audio streaming');
                return null;
            }

            console.log('WebRTCCallService: audio streaming: started call: remoteStream', this.remoteStream);

            return this.remoteStream;
        } catch (error) {
            console.error('WebRTCCallService: Error accessing camera:', error);
            return null;
        }
    }

    public async StopStreaming() {
        if (this.localStream) {
            console.log('WebRTCCallService: Stopping media streaming');

            this.isVideoStreaming = false;
            this.isAudioStreaming = false;

            return true;
        }

        console.log('WebRTCCallService: Stopped media streaming');

        return false;
    }
}

export default WebRTCCallService;
