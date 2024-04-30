import { Component, ChangeDetectorRef } from '@angular/core';
import { OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import  CallService  from '../../services/callservice';

//import { DataChannelService } from '../../services/data-channel-service';

@Component({
  selector: 'app-text-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './text-chat.component.html',
  styleUrl: './text-chat.component.css'
})
export class TextChatComponent implements OnInit {
  callService: CallService | null = null;

  connected = false;
  remoteMessages: Array<string> = new Array<string>();
  channelName: string = '';
  newMessage: string = '';

  constructor(private cdr: ChangeDetectorRef) {
    this.remoteMessages.push('Welcome to the chat room');

    this.callService = new CallService('http://localhost:3010');
    this.callService.setChannelName(this.channelName);
    this.callService.setMessageReceivedCallBack(this.onRemoteMessageReceived.bind(this)); 
  }

  ngOnInit(): void {
  }

  async connect() {
    if (this.callService === null) {
      console.error('Call service not initialized');
      return;
    }

    await this.callService.startCall(this.channelName);

    if (this.callService.isConnected() === true)
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

    this.callService.closeCall();
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
