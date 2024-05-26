import { io, Socket } from 'socket.io-client'
import SocketIOClient from 'socket.io';
import { DataChannelService } from './data-channel-service';

interface SignalingMessage {
  type: string;
  data: any;
}

export class WebRTCCallService {
  private socket: Socket;
  private peerConnection: RTCPeerConnection;
  //private remotePeerConnection: RTCPeerConnection | null = null;
  private sendDataChannel: RTCDataChannel | null = null;
  private receiveDataChannel: RTCDataChannel | null = null;

  private receiveChannelMessageCallback: (event: MessageEvent) => void = () => { };

  private connected: boolean = false;

  constructor(private readonly signalingServerUrl: string) {
    this.socket = io(signalingServerUrl);
    this.setupSignaling();

    this.peerConnection = new RTCPeerConnection();
    this.createPeerConnection(this.peerConnection);

    this.setupSendDataChannel(this.peerConnection);

    this.createLocalOffer();
  }

  public setupSignaling(): boolean {
    console.log('Setting up signaling');
    try {
      this.socket.on('connect', () => {
        console.log('Connected to signaling server');
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from signaling server');
        this.close();
      });

      this.socket.on('message', async (message: SignalingMessage) => {
        console.log('Received signaling message:', message);

        switch (message.type) {
          case 'offer':
            await this.handleOffer(message.data);
            break;
          case 'answer':
            await this.handleAnswer(message.data);
            break;
          case 'candidate':
            await this.handleIceCandidate(message.data);
            break;
          default:
            console.warn('Unknown message type:', message.type);
        }
      });

      console.log('Signaling setup complete');
      return true;
    }

    catch (error) {
      console.error('Error setting up signaling:', error);
      return false;
    }
  }

  public IsConnected(): boolean {
    return this.connected;
  }

  private setupSendDataChannel(peerConnection: RTCPeerConnection) {
    console.log('Setting up send data channel');
    this.sendDataChannel = peerConnection.createDataChannel('sendDataChannel');

    if (this.sendDataChannel) {
      this.sendDataChannel.onopen = () => {
        console.log('Data channel opened');
      };

      this.sendDataChannel.onclose = () => {
        console.log('Data channel closed');
      };

      this.sendDataChannel.onmessage = (event) => {
        console.log('Received message:', event.data);
        this.onSendChannelMessageReceived(event);
      };
    }
  }

  private async createPeerConnection(connection: RTCPeerConnection) {
    connection.onicecandidate = e => {
      console.log('onicecandidate');
      let message = {
        type: 'candidate',
        candidate: null as string | null,
        sdpMid: null as string | null, // Add the sdpMid property
        sdpMLineIndex: null as number | null, // Add the sdpMLineIndex property
      };

      if (e.candidate) {
        message.candidate = e.candidate.candidate;
        message.sdpMid = e.candidate.sdpMid;
        message.sdpMLineIndex = e.candidate.sdpMLineIndex;
      }

      this.socket.emit('message', message);
      console.log('ICE candidate sent');
    }
  }

  private async createLocalOffer() {
    try {
      console.log('Starting call');
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.socket.emit('message', {
        type: 'offer',
        sdp: offer.sdp
      });

      console.log('Call started, offer created from local');

      return true;

    } catch (error) {
      this.connected = false;
      console.error('Error starting call:', error);
      return false;
    }
  }

  private async handleOffer(offer : RTCSessionDescriptionInit) {
    try {

      if (this.peerConnection) {
        console.error('Peer connection already exists');
        return;
      }
      
      this.peerConnection = new RTCPeerConnection();
      this.createPeerConnection(this.peerConnection);
      this.peerConnection.ondatachannel = this.receiveChannelCallback;;

      console.log('Received offer');
      let offerDesc = new RTCSessionDescription(offer);
      await this.peerConnection.setRemoteDescription(offerDesc);
      console.log('Remote description set');

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      console.log('Local description set');

      if (this.peerConnection.localDescription) {
        this.socket.emit('message', {
          type: 'answer',
          sdp: answer.sdp,
          data: this.peerConnection.localDescription,
        });
      }

      console.log('Answer created and sent');
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit) {
    try {
      console.log('Received answer');
      if (!this.peerConnection) {
        console.error('Remote peer connection is not set');
        return;
      }
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('Remote description set');

      //this.receiveDataChannelService = new DataChannelService(this.peerConnection);
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit) {
    try {
      console.log('in handleIceCandidate');
      if (candidate) {
        console.log('Received ICE candidate:');
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        this.connected = true;
        console.log('ICE candidate added');
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
      this.connected = false;
    }
  }


  public async StartCall(): Promise<boolean> {
    this.connected = true;
    return true;

  }

  public SetMessageReceivedCallBack(callback: (event: MessageEvent) => void) {
    this.receiveChannelMessageCallback = callback;
  }

  public sendData(message: string) {
    console.log('Sending data:', message);
    if (this.sendDataChannel) {
      this.sendDataChannel.send(message);
    }
  }

  private receiveChannelCallback(event: RTCDataChannelEvent) {
    console.log('--------Receive Channel Callback');
    this.receiveDataChannel = event.channel;
    this.receiveDataChannel.onmessage = this.onReceiveChannelMessageCallback;
    // receiveChannel.onopen = onReceiveChannelStateChange;
    // receiveChannel.onclose = onReceiveChannelStateChange;
  }

  public async close() {
    try {
      if (this.peerConnection) {
        this.peerConnection.close();
      }
      if (this.socket) {
        this.socket.disconnect();
      }
    } catch (error) {
      console.error('Error closing connection:', error);
    }
  }

  private onSendChannelMessageReceived(event: MessageEvent<any>) {
    console.log('Received message on send:', event.data);
    this.receiveChannelMessageCallback(event);
  }


  private onReceiveChannelMessageCallback(event : MessageEvent<any>) {
    console.log('Received Message on receive');
    this.receiveChannelMessageCallback(event);
  }
}

