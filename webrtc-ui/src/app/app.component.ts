import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ChatMainViewComponent } from '../views/chat-main-view/chat-main-view.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ChatMainViewComponent],
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
  }
}
