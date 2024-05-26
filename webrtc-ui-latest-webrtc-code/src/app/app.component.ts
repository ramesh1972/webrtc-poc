import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ChatViewComponent } from '../views/chat-view/chat-view.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ChatViewComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'WebRTC Angular App';
  peerConnection!: RTCPeerConnection;
  dataChannel!: RTCDataChannel;
}
