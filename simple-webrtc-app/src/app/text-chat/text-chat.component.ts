import { Component, ChangeDetectorRef } from '@angular/core';
import { OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import  WebRTCCallService  from '../../services/callservice';

//import { DataChannelService } from '../../services/data-channel-service';

@Component({
  selector: 'app-text-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './text-chat.component.html',
  styleUrl: './text-chat.component.css'
})
export class TextChatComponent implements OnInit {
  callService: WebRTCCallService | null = null;

  connected = false;
  remoteMessages: Array<string> = new Array<string>();
  channelName: string = '';
  newMessage: string = '';

  constructor(private cdr: ChangeDetectorRef) {
    this.remoteMessages.push('Welcome to the chat room');

    this.callService = new WebRTCCallService('http://localhost:3010');
    this.callService.SetChannelName(this.channelName);
    this.callService.SetMessageReceivedCallBack(this.onRemoteMessageReceived.bind(this)); 
  }

  ngOnInit(): void {
  }

  async connect() {
    if (this.callService === null) {
      console.error('Call service not initialized');
      return;
    }

    await this.callService.StartCall(this.channelName);

    if (this.callService.IsConnected() === true)
      this.connected = true;
    else {
      console.error('Failed to start call');
      this.connected = false;
    }
  }
  
  disconnect() {
    if (this.callService === null) {
      console.error('Call service not initialized');
      return;
    }

    this.callService.CloseCall();
    this.connected = false;
  }

  _sendMessage() {
    if (this.callService === null) {
      console.error('Call service not initialized');
      return;
    }

    console.log(`Local message sent: ${this.newMessage}`);
    this.callService.sendData(this.newMessage);
    this.newMessage = '';
  }

  onRemoteMessageReceived(event: MessageEvent) {
    console.log(`Remote message received by local: ${event.data}`);
    this.remoteMessages.push(event.data);
    this.cdr.detectChanges();
    console.log(this.remoteMessages);
  }
}
