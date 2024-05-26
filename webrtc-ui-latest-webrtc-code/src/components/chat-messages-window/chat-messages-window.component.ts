import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import WebRTCHandler from '../../libs/webrtc/WebRTCHandler';

import { ChannelMessage } from '../../libs/webrtc/models/ChannelMessage';
import { WebRTCDataChannelLabel } from '../../libs/webrtc/models/DataChannelLabel';

@Component({
  selector: 'app-chat-messages-window',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './chat-messages-window.component.html',
  styleUrl: './chat-messages-window.component.css'
})
export class ChatMessagesWindowComponent {
  @Input() currentDataChannel?: WebRTCDataChannelLabel;
  @Input() chatMessages!: ChannelMessage[];
  @Input() webRTCHandler!: WebRTCHandler | null;

  constructor() { }

}
