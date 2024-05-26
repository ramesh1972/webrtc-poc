import { io, Socket } from 'socket.io-client'

interface SignalingMessage {
    type: string;
    data: any;
}

class WebRTCCallService {
    private socket: Socket;
    private connected: boolean = false;
    private pc: RTCPeerConnection | null;
    private sendChannel: RTCDataChannel | null;
    private receiveChannel: RTCDataChannel | null;
    private channelName: string = '';

    private receiveChannelMessageCallback: (event: MessageEvent) => void = () => { };

    constructor(private readonly signalingServerUrl: string) {
        console.log('constructor signal URL: ', signalingServerUrl);    
        this.socket = io(signalingServerUrl);
        this.pc = null;
        this.sendChannel = null;
        this.receiveChannel = null;

        this.socket.on('connect', () => {
            console.log('Connected to signaling server');
          });
    
          this.socket.on('disconnect', () => {
            console.log('Disconnected from signaling server');
            this.handleBye();
          });

        this.socket.on('message', async (message: SignalingMessage) => {
            console.log('Received signaling message:', message);

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

        this.socket.emit('message', { type: 'ready' });
    }

    public SetChannelName(channelName: string) {
        this.channelName = channelName;
    }

    public SetMessageReceivedCallBack(callback: (event: MessageEvent) => void) {
        this.receiveChannelMessageCallback = callback;
    }

    private async handleOffer(offer: any): Promise<void> {
        if (this.pc) {
            console.error('Existing peer connection');
            return;
        }

        console.log('Received offer:', offer);
        await this.createPeerConnection();
        this.pc!.ondatachannel = (event: RTCDataChannelEvent) => this.receiveChannelCallback(event);
        await this.pc!.setRemoteDescription(new RTCSessionDescription(offer));

        console.log('Creating answer');
        const answer = await this.pc!.createAnswer();
        this.socket.emit('message', { type: 'answer', sdp: answer.sdp });
        await this.pc!.setLocalDescription(answer);
        console.log('Created answer:', answer);
    }

    private async handleAnswer(answer: any): Promise<void> {
        if (!this.pc) {
            console.error('No peer connection');
            return;
        }

        console.log('Received answer:', answer);
        await this.pc!.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('answer handled');
    }

    private async handleCandidate(candidate: any): Promise<void> {
        if (!this.pc) {
            console.error('No peer connection');
            return;
        }

        if (this.pc.remoteDescription) {
            console.log('Received candidate:', candidate);
            await this.pc!.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('candidate handled');
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

    public IsConnected(): boolean {
        return this.connected;
    }

    private async createPeerConnection(): Promise<void> {
        console.log('Creating peer connection');
        this.pc = new RTCPeerConnection();
        this.pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => this.handleIceCandidate(e);
        console.log('Created peer connection');
    }

    private async handleIceCandidate(e: RTCPeerConnectionIceEvent): Promise<void> {
        let message = {
            type: 'candidate',
            candidate: null as string | null,
            sdpMid: null as string | null, // Add the sdpMid property
            sdpMLineIndex: null as number | null, // Add the sdpMLineIndex property
        };

        console.log('Received ICE candidate:', e.candidate);
        if (e.candidate) {
            message.candidate = e.candidate.candidate;
            message.sdpMid = e.candidate.sdpMid;
            message.sdpMLineIndex = e.candidate.sdpMLineIndex;
            //this.signaling.postMessage(message);
            this.socket.emit('message', message);
        }

        console.log('ICE candidate handled');
    }

    public async StartCall(channelName : string): Promise<void> {
        await this.createPeerConnection();

        console.log('Creating data channel:' + channelName);
        this.sendChannel = this.pc!.createDataChannel(channelName);
        console.log('Created data channel with label:', this.sendChannel.label);

        this.sendChannel.onopen = () => this.onChannelStateChange(channelName);
        this.sendChannel.onmessage = (event: MessageEvent) => this.onChannelMessage(channelName, event);
        this.sendChannel.onclose = () => this.onChannelStateChange(channelName);

        console.log('Creating offer');

        const offer = await this.pc!.createOffer();
        this.socket.emit('message',{ type: 'offer', sdp: offer.sdp });
        await this.pc!.setLocalDescription(offer);
        
        console.log('Created offer:', offer);

        this.connected = true;
    }

    private async receiveChannelCallback(event: RTCDataChannelEvent): Promise<void> {
        console.log('Receive Channel Callback');
        this.receiveChannel = event.channel;
        this.receiveChannel.onmessage = (event: MessageEvent) => this.onChannelMessage(this.channelName, event);
        this.receiveChannel.onopen = () => this.onChannelStateChange(this.channelName);
        this.receiveChannel.onclose = () => this.onChannelStateChange(this.channelName);
    }

    public sendData(message: string) {
        console.log('Sending data:', message);
        if (this.sendChannel?.readyState === 'open') {
            this.sendChannel.send(message);
        }
        if (this.receiveChannel?.readyState === 'open') {
            this.receiveChannel.send(message);
        }
    }

    private onChannelMessage(channelName: string, event: MessageEvent): void {
        console.log('Received message:', event.data);

        this.receiveChannelMessageCallback(event);
    }

    private onChannelStateChange(channelName: string): void {
        if (this.sendChannel && this.sendChannel.label === channelName) {
            const readyState = this.sendChannel.readyState;
            console.log('Send channel state is:', readyState);
            // Handle send channel state change
        }
        if (this.receiveChannel && this.receiveChannel.label === channelName) {
            const readyState = this.receiveChannel.readyState;
            console.log('Receive channel state is:', readyState);
            // Handle receive channel state change
        }
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
}

export default WebRTCCallService;
