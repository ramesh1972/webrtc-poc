import { io, Socket } from 'socket.io-client'
import { RTCConfiguration, RTCPeerConnection, RTCSessionDescription, RTCSessionDescriptionInit, RTCPeerConnectionIceEvent, RTCDataChannel, RTCDataChannelEvent, RTCIceCandidate, BlobEvent } from 'react-native-webrtc';

import { SignalingMessage } from '../models/SignalingMessage';
import { MsgData } from '../../../models/MsgData';

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
    private socket: Socket = null;
    private isConnected: boolean = false;
    private pc: RTCPeerConnection = null;
    private sendChannel: RTCDataChannel = null;
    private receiveChannel: RTCDataChannel = null;
    private channelName: string = '';

    // media messaging properties
    private CHUNK_SIZE = 16384; // Adjust the chunk size as needed
    private TURN_SERVER_URLS = 'stun:stun.l.google.com:19302';
    private videoElement: HTMLVideoElement | null = null;
    private audioElement: HTMLAudioElement | null = null;
    private localStream: MediaStream | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: Blob[] = [];
    private isVideoMessage: boolean = false;
    private isAudioMessage: boolean = false;
    private receivedChunks: Uint8Array[] = [];

    // streaming properties
    isVideoStreaming: boolean = false;
    isAudioStreaming: boolean = false;

    localVideoElement: HTMLVideoElement | null = null;
    remoteVideoElement: HTMLVideoElement | null = null;

    localAudioElement: HTMLAudioElement | null = null;
    remoteAudioElement: HTMLAudioElement | null = null;

    // callbacks
    private receiveChannelMessageCallback: (messageData: MsgData) => void = () => { };

    constructor(private readonly signalingServerUrl: string) {
        console.log('constructor signal URL: ', signalingServerUrl);

				try {
	        this.socket = io(signalingServerUrl);

	        if (this.socket === null || this.socket === undefined) {
	          console.error('Socket is null');
	        }
        }
        catch (error) {
        		console.error('Error creating socket:', error);
				}

				console.log("socket created");
				console.log('Socket is not null:', this.socket);

        this.pc = null;
        this.channelName = '';
        this.sendChannel = null;
        this.receiveChannel = null;

        this.recordedChunks = new Array<Blob>();

        // Set up signaling server event handlers
        this.socket.on('connect', () => {
            console.log('Connected to signaling server');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from signaling server');
            this.handleBye();
        });

        // the main signaling message handler
        this.socket.on('message', async (message: SignalingMessage) => {
            console.log('Received signaling message type:', message.type);
            console.log('Received signaling message channelName:', message.channelName);
            console.log('Received signaling message data:', message.data);

            if (message.channelName !== this.channelName) {
                console.log('Received message for different channel:', message.channelName);
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
                    this.handleReady();
                    break;
                case 'bye':
                    this.handleBye();
                    break;
                default:
                    console.log('Unhandled message:', message);
                    break;
            }
        });

        console.log('++++++++++++++Socket event handlers set');
    }

    public SetChannelName(channelName: string) {
        this.channelName = channelName;
    }

    public SetMessageReceivedCallBack(callback: (messageData: MsgData) => void) {
        this.receiveChannelMessageCallback = callback;
    }

    // -----------------------------------------------------------------------------------
    // socket event handlers for handshake messages
    private async handleOffer(offer: any): Promise<void> {
        // if (this.pc) {
        //     console.error('Existing peer connection');
        //     return;
        // }

        console.log('=================> Received offer:', offer);

        let remotepc = await this.createPeerConnection();
        if (remotepc !== null) {
            console.log('Setting up data channel callback');

            remotepc.ondatachannel = (event: RTCDataChannelEvent) => this.receiveChannelCallback(event);
        }

        await remotepc.setRemoteDescription(new RTCSessionDescription(offer.data));

        console.log('Creating answer');

        const answer = await remotepc.createAnswer();
        this.socket.emit('message', { type: 'answer', channelName: this.channelName, data: {type: 'answer', sdp: answer.sdp} });

        await remotepc.setLocalDescription(answer);
        console.log('==================> Created answer:', answer);

        remotepc!.onicecandidate = (e: RTCPeerConnectionIceEvent) => this.handleIceCandidate(e);
    }

    private async handleAnswer(answer: any): Promise<void> {
        if (!this.pc) {
            console.error('No peer connection');
            return;
        }

        console.log('=================> Received answer:', answer);
        console.log('Signal state is ', this.pc.signalingState);

        try {
            console.log('Setting remote description in handleAnswer');
            await this.pc!.setRemoteDescription(new RTCSessionDescription(answer.data));
            console.log('==================> answer handled');
        }
        catch (e) {
            console.log('Error in handleAnswer', e);
        }
    }

    private async handleCandidate(candidate: any): Promise<void> {
        if (!this.pc) {
            console.error('No peer connection');
            return;
        }

        console.log('================> Received candidate:', candidate);
        console.log('remoteDescription ', this.pc.remoteDescription);
        if (this.pc.remoteDescription) {
            await this.pc!.addIceCandidate(new RTCIceCandidate(candidate.data));
            console.log('===============> candidate handled');
        }
    }

    private async handleIceCandidate(e: RTCPeerConnectionIceEvent): Promise<void> {
        let message = {
            type: 'candidate',
            channelName: this.channelName,
            data: {
              type: 'candidate',
	            candidate: null as string | null,
	            sdpMid: null as string | null, // Add the sdpMid property
	            sdpMLineIndex: null as number | null, // Add the sdpMLineIndex property
            }
        };

        console.log('Received ICE candidate:', e.candidate);
        if (e.candidate) {
            message.data.candidate = e.candidate.candidate;
            message.data.sdpMid = e.candidate.sdpMid;
            message.data.sdpMLineIndex = e.candidate.sdpMLineIndex;
            this.socket.emit('message', message);
        }

        console.log('==================> ICE candidate handled');
    }

    private handleReady(): void {
        if (this.pc) {
            this.isConnected = true;
        }
    }

    private handleBye(): void {
        if (this.pc) {
            this.isConnected = false;
        }
    }

    // -----------------------------------------------------------------------------------
    // RTC Peer connection methods
    private async createPeerConnection(): Promise<RTCPeerConnection> {
        let configuration: RTCConfiguration = { 'iceServers': [{ 'urls': this.TURN_SERVER_URLS }] };

        console.log('Creating peer connection');
        this.pc = new RTCPeerConnection(configuration);

        console.log('Created peer connection');

        console.log('==================> before Starting video streaming:', this.isVideoStreaming);
        console.log('==================> before Starting audio streaming:', this.isAudioStreaming);
        if (this.isVideoStreaming) {
            console.log('Going to Set video streaming');

            if (this.remoteVideoElement === null || this.remoteVideoElement === undefined) {
                console.error('Remote video element not set for streaming');
                return this.pc;
            }

            console.log('Setting remote video element');

            this.pc!.ontrack = (e: RTCTrackEvent) => this.remoteVideoElement!.srcObject = e.streams[0];
            this.localStream!.getTracks().forEach(track => this.pc!.addTrack(track, this.localStream!));
        }
        else if (this.isAudioStreaming) {
            console.log('Going to Set audio streaming');

            if (this.remoteAudioElement === null || this.remoteAudioElement === undefined) {
                console.error('Remote Audio element not set for streaming');
                return this.pc;
            }

            console.log('Setting remote Audio element');

            this.pc!.ontrack = (e: RTCTrackEvent) => this.remoteAudioElement!.srcObject = e.streams[0];
            this.localStream!.getTracks().forEach(track => this.pc!.addTrack(track, this.localStream!));
        }

        return this.pc;
    }

    public IsConnected(): boolean {
        return this.isConnected;
    }

    // -----------------------------------------------------------------------------------
    // methods to establish data channel and send/receive data
    public async StartCall(channelName: string) {
				try {
	        console.log('===================> Starting call');
	        await this.createPeerConnection();

	        this.channelName = channelName;

	        console.log('Creating data channel:' + this.channelName);
	        this.sendChannel = this.pc!.createDataChannel(channelName);
	        console.log('Created data channel with label:', this.sendChannel.label);

	        // set up data channel event handlers
	        this.sendChannel.onopen = () => this.onChannelStateChange(channelName);
	        this.sendChannel.onmessage = (event: MessageEvent) => this.onChannelMessage(channelName, event);
	        this.sendChannel.onerror = (error) => this.onChannelStateError(channelName, error);
	        this.sendChannel.onclose = () => this.onChannelStateChange(channelName);

	        console.log('==================> Creating offer');

	        const offer = await this.pc!.createOffer();
	        console.log('createOffer return:', offer);
	        console.log('createOffer channelName:', this.channelName);
	        this.socket.emit('message', { type: 'offer', channelName: this.channelName, data: {type: "offer", sdp: offer.sdp} });
	        console.log('Sent offer via socket:', offer);

	        await this.pc.setLocalDescription(offer);
	        console.log('Set local description');

	        console.log('==================> Created offer:', offer);

	        this.pc!.onicecandidate = (e: RTCPeerConnectionIceEvent) => this.handleIceCandidate(e);

	        this.isConnected = true;

					console.log("==============> Started call");
				}
        catch (error) {
            console.error('Error starting CALL:', error);
            return false;
        }

        return this.isConnected;
    }

    public async CloseCall(): Promise<void> {
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }

        this.sendChannel = null;
        this.receiveChannel = null;
        console.log('Closed peer connections');
    }

    public sendData(message: string) {
        console.log('+++++ Sending data:', message);
        console.log('+++++ Send channel state:', this.sendChannel?.readyState);
        if (this.sendChannel?.readyState === 'open') {
						console.log("sendData 1", message);
            this.sendChannel.send(message);
            console.log('+++++ Sent data:', message);
        }
        else if (this.receiveChannel?.readyState === 'open') {
            this.receiveChannel.send(message);
            console.log('++++++ Sent data in receive channel:', message);
        }
    }

    private onChannelMessage(channelName: string, event: MessageEvent): void {
        console.log('+++++ Received message:', event.data);

        let messageData: MsgData = { type: 'text', data: event.data };

        if (event.data instanceof ArrayBuffer) {
            const arrayBuffer = event.data;
            const chunk = new Uint8Array(event.data);
            this.receivedChunks.push(chunk);
        }
        else {
            if (event.data === '[[Video Chunks Complete]]') {
                this.isVideoMessage = true;
                this.isAudioMessage = false;
                this.joinChunks();
                return;
            }
            else if (event.data === '[[Audio Chunks Complete]]') {
                this.isAudioMessage = true;
                this.isVideoMessage = false;
                this.joinChunks();
                return;
            }

            this.receiveChannelMessageCallback(messageData);
        }
    }

    private async receiveChannelCallback(event: RTCDataChannelEvent): Promise<void> {
        console.log('================> Receive Channel Callback');

        this.receiveChannel = event.channel;

        this.receiveChannel.onmessage = (event: MessageEvent) => this.onChannelMessage(this.channelName, event);
        this.receiveChannel.onopen = () => this.onChannelStateChange(this.channelName);
        this.receiveChannel.onclose = () => this.onChannelStateChange(this.channelName);
        this.receiveChannel.onerror = (error) => this.onChannelStateError(this.channelName, error);
    }

    private onChannelStateError(channelName: string, event: Event): void {
        console.error('channel state is error:', event);
    }

    private onChannelStateChange(channelName: string): void {
        let datachannel: RTCDataChannel | null = null;
        console.log('Channel state changed:', channelName);
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
    public async StartVideoMessaging(videoElement: HTMLVideoElement): Promise<boolean> {
        if (this.isConnected === false) {
            console.log('starting call');
            await this.StartCall(this.channelName);
        }

        if (this.isConnected === false) {
            console.error('Failed to start video call');
            return false;
        }

        this.isVideoMessage = true;
        this.isAudioMessage = false;

        console.log('===================> channelName in video messaging:', this.channelName);

        try {
            console.log('===================> starting video recording');
            this.videoElement = videoElement;

            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

            if (this.localStream) {
                console.log('===================> Accessing camera');
                this.videoElement!.srcObject = this.localStream;

                // signal the peer that the channel is ready to send video data
                this.socket.emit('message', { type: 'ready', channelName: this.channelName });

                this.mediaRecorder = new MediaRecorder(this.localStream, { mimeType: 'video/webm' });
                this.mediaRecorder.ondataavailable = (event: BlobEvent) => this.handleMediaDataAvailable(event);
                this.mediaRecorder.start();

                console.log('===================> Started video recording');
            }

            return true;
        } catch (error) {
            console.error('Error accessing camera:', error);
            return false;
        }
    }

    public async StartAudioMessaging(audioElement: HTMLAudioElement): Promise<boolean> {
        if (this.isConnected === false) {
            await this.StartCall(this.channelName);
        }

        if (this.isConnected === false) {
            console.error('Failed to start audio call');
            return false;
        }

        this.isAudioMessage = true;
        this.isVideoMessage = false;
        console.log('===================> channelName in audio messaging:', this.channelName);

        try {
            console.log('===================> starting audio recording');
            this.audioElement = audioElement;

            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

            if (this.localStream) {
                console.log('===================> Accessing microphone');
                this.audioElement!.srcObject = this.localStream;

                // signal the peer that the channel is ready to send audio data
                this.socket.emit('message', { type: 'ready', channelName: this.channelName });

                this.mediaRecorder = new MediaRecorder(this.localStream, { mimeType: 'audio/webm' });
                this.mediaRecorder.ondataavailable = async (event: BlobEvent) => await this.handleMediaDataAvailable(event);
                this.mediaRecorder.start();

                console.log('===================> Started video recording');
            }

            return true;
        } catch (error) {
            console.error('Error accessing camera:', error);
            return false;
        }
    }

    private async handleMediaDataAvailable(event: BlobEvent) {
        console.log('===================> Media data available');
        console.log('===================> channelName in media available function:', this.channelName);

        if (event.data.size > 0) {
            console.log('===================> MEdia data available:', event.data.size);
            console.log('===================> Media recording chunks:', this.recordedChunks.length);
            this.recordedChunks.push(event.data);
            console.log('===================> Media recording chunks after:', this.recordedChunks.length);
        }
    }

    public async StopRecording() {
        console.log('===================> Stopping media recording');
        if (this.mediaRecorder && this.localStream) {
            this.mediaRecorder.stop();
            this.localStream.getTracks().forEach(track => track.stop());
        }

        console.log('===================> Stopped media recording');
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

        console.log('Received media data:', concatenatedBytes.byteLength);
        console.log('Received media chunks:', this.receivedChunks.length);

        let blob = null;
        if (this.isVideoMessage) {
            blob = new Blob([concatenatedBytes], { type: 'video/webm' });
            console.log('Received video blob', blob.size);
        }
        else if (this.isAudioMessage) {
            blob = new Blob([concatenatedBytes], { type: 'audio/webm' });
            console.log('Received audio blob', blob.size);
        }

        if (blob === null) {
            console.error('Received media data is not video or audio');
            return;
        }

        let url = URL.createObjectURL(blob);
        console.log('Received media URL:', url);

        let messageData: MsgData = { type: '', data: '' };
        if (this.isVideoMessage)
            messageData = { type: 'video', data: url };
        else if (this.isAudioMessage)
            messageData = { type: 'audio', data: url };

        this.receiveChannelMessageCallback(messageData);

        this.receivedChunks = [];
    }

    public async SendVideo(): Promise<string> {
        if (this.recordedChunks.length === 0) {
            console.error('No recorded chunks available');
            return '';
        }

        console.log('===================> Sending video');
        if (this.localStream) {
            console.log('===================> getting video localstream');
            this.localStream.getTracks().forEach(track => this.pc!.addTrack(track, this.localStream!));
        }

        console.log('===================> Sending video data');

        console.log('+++++ Sending video data');
        let url = this.sendMedia(this.channelName, 'video/webm');
        console.log('+++++ Sent video data:');

        console.log('===================> Sent video');
        this.recordedChunks = new Array<Blob>();
        this.localStream = null;

        return url;
    }

    public async SendAudio(): Promise<string> {
        if (this.recordedChunks.length === 0) {
            console.error('No recorded chunks available');
            return '';
        }

        console.log('===================> Sending audio');
        if (this.localStream) {
            console.log('===================> getting audio localstream');
            this.localStream.getTracks().forEach(track => this.pc!.addTrack(track, this.localStream!));
        }

        console.log('===================> Sending audio data');

        console.log('+++++ Sending audio data');
        let url = this.sendMedia(this.channelName, 'audio/webm');
        console.log('+++++ Sent audio data:');

        console.log('===================> Sent audio');
        this.recordedChunks = new Array<Blob>();
        this.localStream = null;

        return url;
    }

    private sendMedia(channelName: string, type: string): string {
        if (this.recordedChunks.length === 0) {
            console.log('============> No recorded chunks available');
            return '';
        }

        console.log('==============> Sending media data');

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
                    if (this.isVideoMessage)
                        this.sendData('[[Video Chunks Complete]]');
                    else if (this.isAudioMessage)
                        this.sendData('[[Audio Chunks Complete]]');

                    console.log('==============> Sent media data');
                }
                catch (error) {
                    console.error('Error sending media data:', error);
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
                console.log('==============> Sending media data in send channel');
                this.sendChannel!.send(chunk);
            }
            else if (this.receiveChannel!.readyState === 'open') {
                console.log('==============> Sending media data in receive channel');
                this.receiveChannel!.send(chunk);
            }
            else
                console.error('Data channel is not open to send media');
        }
    }

    public async GetRecordedVideoURL(type: string): Promise<string> {
        if (this.recordedChunks.length === 0) {
            console.error('No recorded chunks available');
            return '';
        }

        console.log('===================> Getting video URL');
        const concatenatedBlob = new Blob(this.recordedChunks, { type: type });
        let url = URL.createObjectURL(concatenatedBlob);
        console.log('===================> Got video URL:', url);

        return url;
    }

    // -----------------------------------------------------------------------------------
    // methods to start video/audio streaming
    public async StartVideoStreaming(localVideoElement: HTMLVideoElement, remoteVideoElement: HTMLVideoElement): Promise<boolean> {
        this.isVideoStreaming = true;
        this.isAudioStreaming = false;

        this.localVideoElement = localVideoElement;
        this.remoteVideoElement = remoteVideoElement;

        if (this.isConnected === false) {
            console.log('starting call');
            await this.StartCall(this.channelName);
        }
         else {
            console.log('Already connected');
            await this.CloseCall();
        }
 
        console.log('===================> channelName in video stremaing:', this.channelName);

        try {
            console.log('===================> starting video stremaing');

            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

            if (this.localStream) {
                console.log('===================> Accessing camera');
                this.localVideoElement!.srcObject = this.localStream;

                // signal the peer that the channel is ready to send video data
                this.socket.emit('message', { type: 'ready', channelName: this.channelName });
            }

            await this.StartCall(this.channelName);

            return true;
        } catch (error) {
            console.error('Error accessing camera:', error);
            return false;
        }
    }

    public async StartAudioStreaming(localAudioElement: HTMLAudioElement, remoteAudioElement: HTMLAudioElement): Promise<boolean> {
        this.isAudioStreaming = true;
        this.isVideoStreaming = false;

        this.localAudioElement = localAudioElement;
        this.remoteAudioElement = remoteAudioElement;

        if (this.isConnected === false) {
            console.log('starting call');
            await this.StartCall(this.channelName);
        }
         else {
            console.log('Already connected');
            await this.CloseCall();
        }
 
        console.log('===================> channelName in Audio stremaing:', this.channelName);

        try {
            console.log('===================> starting Audio stremaing');

            this.localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });

            if (this.localStream) {
                console.log('===================> Accessing camera');
                this.localAudioElement!.srcObject = this.localStream;

                // signal the peer that the channel is ready to send Audio data
                this.socket.emit('message', { type: 'ready', channelName: this.channelName });
            }

            await this.StartCall(this.channelName);

            return true;
        } catch (error) {
            console.error('Error accessing camera:', error);
            return false;
        }
    }
}

export default WebRTCCallService;
