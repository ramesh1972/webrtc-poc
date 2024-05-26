import { Component } from '@angular/core';
import { OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-text-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './text-chat.component.html',
  styleUrl: './text-chat.component.css'
})
export class TextChatComponent implements OnInit {
  configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  connected = false;
  localMessages : string[] = [];
  remoteMessages: string[] = [];
  chatMessages: string[] = [];
  newMessage: string = '';
  peerConnection!: RTCPeerConnection;
  _localConnection!: RTCPeerConnection;
  _remoteConnection!: RTCPeerConnection;
  dataChannel!: RTCDataChannel;
  _localChannel!: RTCDataChannel;
  _remoteChannel!: RTCDataChannel;

  constructor() {
  }

  disconnect() {
    this._localConnection.close();
    this._remoteConnection.close();
  }

  async connect() {
    console.log('connect!');
    try {
      const dataChannelParams = {ordered: true};
      
      this._localConnection = new RTCPeerConnection(this.configuration);
      this._localConnection.addEventListener('icecandidate', async e => {
        console.log('local connection ICE candidate: ', e.candidate);
        if (e.candidate) {
          await this._remoteConnection.addIceCandidate(e.candidate);
        }
      });
      
      this._remoteConnection = new RTCPeerConnection(this.configuration);
      this._remoteConnection.addEventListener('icecandidate', async e => {
        console.log('remote connection ICE candidate: ', e.candidate);
        if (e.candidate) {
          await this._localConnection.addIceCandidate(e.candidate);
        }
      });

      this._localChannel = this._localConnection.createDataChannel('messaging-channel', dataChannelParams);
      this._localChannel.binaryType = 'arraybuffer';
      this._localChannel.addEventListener('open', () => {
        console.log('Local channel open!');
        this.connected = true;
      });

      this._localChannel.addEventListener('close', () => {
        console.log('Local channel closed!');
        this.connected = false;
      });

      this._localChannel.addEventListener('message', this._onLocalMessageReceived.bind(this));
      this._remoteConnection.addEventListener('datachannel', this._onRemoteDataChannel.bind(this));

      const initLocalOffer = async () => {
        const localOffer = await this._localConnection.createOffer();
        console.log(`Got local offer ${JSON.stringify(localOffer)}`);

        const localDesc = this._localConnection.setLocalDescription(localOffer);
        const remoteDesc = this._remoteConnection.setRemoteDescription(localOffer);
        
        return Promise.all([localDesc, remoteDesc]);
      };

      const initRemoteAnswer = async () => {
        const remoteAnswer = await this._remoteConnection.createAnswer();
        console.log(`Got remote answer ${JSON.stringify(remoteAnswer)}`);
        
        const localDesc = this._remoteConnection.setLocalDescription(remoteAnswer);
        const remoteDesc = this._localConnection.setRemoteDescription(remoteAnswer);
        
        return Promise.all([localDesc, remoteDesc]);
      };

      await initLocalOffer();
      await initRemoteAnswer();
    } catch (e) {
      console.log(e);
    }
  }
  _onLocalMessageReceived(event: MessageEvent) {
    console.log(`Remote message received by local: ${event.data}`);

    this.localMessages.push(event.data);
  }

  _onRemoteDataChannel(event: RTCDataChannelEvent) {
    console.log(`onRemoteDataChannel: ${JSON.stringify(event)}`);

    this._remoteChannel = event.channel;
    this._remoteChannel.binaryType = 'arraybuffer';

    this._remoteChannel.addEventListener('message', this._onRemoteMessageReceived.bind(this));
    this._remoteChannel.addEventListener('close', () => {
      console.log('Remote channel closed!');
      this.connected = false;
    });
  }

  _onRemoteMessageReceived(event: MessageEvent) {
    console.log(`Local message received by remote: ${event.data}`);
    this.remoteMessages.push(event.data);
  }

  ngOnInit(): void {
/*     const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    this.peerConnection = new RTCPeerConnection(configuration);

    // Create a data channel
    this.dataChannel = this.peerConnection.createDataChannel('myDataChannel');

    // Set up the data channel event listeners
    this.dataChannel.onmessage = (event: MessageEvent) => { // Explicitly specify the type of the 'event' parameter as 'MessageEvent'
      const message = event.data;
      this.chatMessages.push(message);
    }; */
  }

/*   SendMessage() {
    const message = this.newMessage.trim();
    if (message) {
      //this.chatMessages.push(message);
      this.dataChannel.send(message);
      this.newMessage = '';
    }
  } */

  _sendMessage(channel: RTCDataChannel) {
    const value = this.newMessage.trim();
    console.log('Value: ', value);
    if (value === '') {
      console.log('Not sending empty message!');
      return;
    }

    console.log('Sending remote message: ', value);
    channel.send(value);
    
    this.newMessage = '';
  }
}
