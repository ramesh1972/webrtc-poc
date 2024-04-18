import { io, Socket } from 'socket.io-client'
import { MsgData } from '../store/msg-data';

interface SignalingMessage {
    type: string;
    channelName: string;
    data: any;
}



class CallService {

    private socket: Socket;
    private connected: boolean = false;
    private pc: RTCPeerConnection | null;
    private sendChannel: RTCDataChannel | null;
    private receiveChannel: RTCDataChannel | null;
    private channelName: string = '';

    private videoElement: HTMLVideoElement | null = null;
    private audioElement: HTMLAudioElement | null = null;
    private localStream: MediaStream | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: Blob[] = [];
    private isVideoMessage: boolean = false;
    private isAudioMessage: boolean = false;
    private CHUNK_SIZE = 16384; // Adjust the chunk size as needed
    private receivedChunks: Uint8Array[] = [];
    private receiveChannelMessageCallback: (messageData: MsgData) => void = () => { };

    constructor(private readonly signalingServerUrl: string) {
        console.log('constructor signal URL: ', signalingServerUrl);

        this.socket = io(signalingServerUrl);
        this.pc = null;
        this.sendChannel = null;
        this.receiveChannel = null;
        this.channelName = '';

        this.recordedChunks = new Array<Blob>();

        this.socket.on('connect', () => {
            console.log('Connected to signaling server');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from signaling server');
            this.handleBye();
        });

        this.socket.on('message', async (message: SignalingMessage) => {
            console.log('Received signaling message:', message);

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

        this.socket.emit('message', { type: 'ready', channelName: this.channelName });
    }

    public setChannelName(channelName: string) {
        this.channelName = channelName;
    }

    public setMessageReceivedCallBack(callback: (messageData: MsgData) => void) {
        this.receiveChannelMessageCallback = callback;
    }

    private async handleOffer(offer: any): Promise<void> {
        console.log('in handlOffer Received offer:', offer);
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

        await remotepc.setRemoteDescription(new RTCSessionDescription(offer));

        console.log('Creating answer');

        const answer = await remotepc.createAnswer();
        this.socket.emit('message', { type: 'answer', sdp: answer.sdp, channelName: this.channelName });

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
            await this.pc!.setRemoteDescription(new RTCSessionDescription(answer));
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
        if (this.pc.remoteDescription) {
            await this.pc!.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('===============> candidate handled');
        }
    }

    private handleReady(): void {
        if (this.pc) {
            this.connected = true;
        }
    }

    private handleBye(): void {
        if (this.pc) {
            this.connected = false;
        }
    }

    public isConnected(): boolean {
        return this.connected;
    }

    private async createPeerConnection(): Promise<RTCPeerConnection> {
        let configuration: RTCConfiguration = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] };

        console.log('Creating peer connection');
        this.pc = new RTCPeerConnection(configuration);

        console.log('Created peer connection');
        return this.pc;
    }

    private async handleIceCandidate(e: RTCPeerConnectionIceEvent): Promise<void> {
        let message = {
            type: 'candidate',
            channelName: this.channelName,
            candidate: null as string | null,
            sdpMid: null as string | null, // Add the sdpMid property
            sdpMLineIndex: null as number | null, // Add the sdpMLineIndex property
        };

        console.log('Received ICE candidate:', e.candidate);
        if (e.candidate) {
            message.candidate = e.candidate.candidate;
            message.sdpMid = e.candidate.sdpMid;
            message.sdpMLineIndex = e.candidate.sdpMLineIndex;
            this.socket.emit('message', message);
        }

        console.log('==================> ICE candidate handled');
    }

    public async startCall(channelName: string): Promise<void> {
        console.log('===================> Starting call');
        await this.createPeerConnection();

        this.channelName = channelName;

        console.log('Creating data channel:' + this.channelName);
        this.sendChannel = this.pc!.createDataChannel(channelName);
        console.log('Created data channel with label:', this.sendChannel.label);

        this.sendChannel.onopen = () => this.onChannelStateChange(channelName);
        this.sendChannel.onmessage = (event: MessageEvent) => this.onChannelMessage(channelName, event);
        this.sendChannel.onerror = (error) => this.onChannelStateError(channelName, error);
        this.sendChannel.onclose = () => this.onChannelStateChange(channelName);

        console.log('==================> Creating offer');

        const offer = await this.pc!.createOffer();
        this.socket.emit('message', { type: 'offer', sdp: offer.sdp, channelName: this.channelName });
        await this.pc!.setLocalDescription(offer);

        console.log('==================> Created offer:', offer);


        this.pc!.onicecandidate = (e: RTCPeerConnectionIceEvent) => this.handleIceCandidate(e);

        this.connected = true;
    }

    public async startVideoMessaging(videoElement: HTMLVideoElement) {
        if (this.connected === false) {
            await this.startCall(this.channelName);
        }

        if (this.connected === false) {
            console.error('Failed to start video call');
            return;
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
                this.mediaRecorder = new MediaRecorder(this.localStream, { mimeType: 'video/webm' });
                this.mediaRecorder.ondataavailable = (event: BlobEvent) => this.handleVideoDataAvailable(event);
                this.mediaRecorder.start();

                console.log('===================> Started video recording');
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
        }
    }

    public async startAudioMessaging(audioElement: HTMLAudioElement) {
        if (this.connected === false) {
            await this.startCall(this.channelName);
        }

        if (this.connected === false) {
            console.error('Failed to start audio call');
            return;
        }

        this.isAudioMessage = true;
        this.isVideoMessage = false;
        console.log('===================> channelName in audio messaging:', this.channelName);
        try {
            console.log('===================> starting audio recording');
            this.audioElement = audioElement;

            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

            if (this.localStream) {
                console.log('===================> Accessing camera');
                this.audioElement!.srcObject = this.localStream;
                this.mediaRecorder = new MediaRecorder(this.localStream, { mimeType: 'audio/webm' });
                this.mediaRecorder.ondataavailable = (event: BlobEvent) => this.handleVideoDataAvailable(event);
                this.mediaRecorder.start();

                console.log('===================> Started video recording');
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
        }
    }

    public stopRecording() {
        console.log('===================> Stopping video recording');
        if (this.mediaRecorder && this.localStream) {
            this.mediaRecorder.stop();
            this.localStream.getTracks().forEach(track => track.stop());
        }

        console.log('===================> Stopped video recording');
    }

    public async getRecordedVideoURL(type: string): Promise<string> {
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

    private async handleVideoDataAvailable(event: BlobEvent) {
        console.log('===================> Video data available');
        console.log('===================> channelName in video available function:', this.channelName);
        if (event.data.size > 0) {
            console.log('===================> Video data available:', event.data.size);
            console.log('===================> video recording chunks:', this.recordedChunks.length);
            this.recordedChunks.push(event.data);
            console.log('===================> video recording chunks after:', this.recordedChunks.length);
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

    public async sendVideo(): Promise<string> {
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

    public async sendAudio(): Promise<string> {
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

    public sendData(message: string) {
        console.log('+++++ Sending data:', message);
        if (this.sendChannel?.readyState === 'open') {

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

    private onChannelStateError(channelName: string, event: Event): void {
        console.error('channel state is error:', event);
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
                console.error('Data channel is not open to send video');
        }
    }

    private sendMedia(channelName: string, type: string): string {
        if (this.recordedChunks.length === 0) {
            console.log('============> No recorded chunks available');
            return '';
        }

        console.log('==============> Sending video data');

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
                    console.error('Error sending video data:', error);

                }
            }
        };

        fileReader.readAsArrayBuffer(concatenatedBlob);

        return url;
    }

    private onChannelStateChange(channelName: string): void {
        let datachannel: RTCDataChannel | null = null;
        if (this.sendChannel) {
            datachannel = this.sendChannel;
            const readyState = this.sendChannel!.readyState;
            console.log('Send channel state is:', readyState);
            // Handle send channel state change
        }
        if (this.receiveChannel && this.receiveChannel.label === channelName) {
            datachannel = this.receiveChannel;
            const readyState = this.receiveChannel.readyState;
            console.log('Receive channel state is:', readyState);
            // Handle receive channel state change
        }
    }

    public async closeCall(): Promise<void> {
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }
        this.sendChannel = null;
        this.receiveChannel = null;
        console.log('Closed peer connections');
    }
}

export default CallService;
