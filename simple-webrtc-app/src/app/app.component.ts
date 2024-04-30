import { Component } from '@angular/core';
import { TextChatComponent } from './text-chat/text-chat.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TextChatComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'WebRTC Angular App';
  peerConnection!: RTCPeerConnection;
  dataChannel!: RTCDataChannel;

  constructor() {
    this.peerConnection = new RTCPeerConnection();
  }

  ngOnInit(): void {
    const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    this.peerConnection = new RTCPeerConnection(configuration);

    // Create a data channel
    this.dataChannel = this.peerConnection.createDataChannel('myDataChannel');

    // Set up event listeners for data channel events
    this.dataChannel.onopen = () => {
      console.log('Data channel opened');
    };

    this.dataChannel.onmessage = (event) => {
      const message = event.data;
      console.log('Received message:', message);
    };

    // Signaling process
    this.peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        // Send the candidate to the remote peer
      }
    };
  }

  // Handle incoming signaling messages from the remote peer
  // Set the received SDP description as the remote description
  async handleSignalingMessage(message: any) {
    const offer = new RTCSessionDescription(message);
    await this.peerConnection.setRemoteDescription(offer);
    // Create an answer and send it to the remote peer
  }

    // Send data through the data channel
    sendData(message: string) {
      if (this.dataChannel.readyState === 'open') {
        this.dataChannel.send(message);
        console.log('Sent message:', message);
      }
    }
}
