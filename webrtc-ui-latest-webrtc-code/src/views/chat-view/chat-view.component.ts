import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ChangeDetectorRef } from '@angular/core';

import { faVideo } from '@fortawesome/free-solid-svg-icons';
import { faPhone } from '@fortawesome/free-solid-svg-icons';
import { faStop } from '@fortawesome/free-solid-svg-icons';

import WebRTCHandler from '../../libs/webrtc/WebRTCHandler';

import { Channel } from '../../libs/webrtc/models/Channel';
import { WebRTCDataChannelLabel } from '../../libs/webrtc/models/DataChannelLabel';
import { ChannelMessage } from '../../libs/webrtc/models/ChannelMessage';

import getChannels from '../../store/channelList';

import { ChatBoxComponent } from '../../components/chat-box/chat-box.component';
import { ChannelListComponent } from '../../components/channel-list/channel-list.component';
import { ChatMessagesWindowComponent } from '../../components/chat-messages-window/chat-messages-window.component';
import { StreamingWindowComponent } from '../../components/streaming-window/streaming-window.component';
import { from } from 'rxjs';

@Component({
  selector: 'app-chat-view',
  standalone: true,
  imports: [ChatBoxComponent, ChannelListComponent, ChatMessagesWindowComponent, StreamingWindowComponent, FormsModule, CommonModule, FontAwesomeModule],
  templateUrl: './chat-view.component.html',
  styleUrl: './chat-view.component.css'
})
export class ChatViewComponent {
  @ViewChild(StreamingWindowComponent) streamingWindow?: StreamingWindowComponent;

  tenantId: number = 1; // in reality this should come from backend
  currentDataChannel?: WebRTCDataChannelLabel;

  myChannel?: Channel;
  toChannel?: Channel;

  selectedUser: string = '';
  channels: Channel[] = [];
  visibleChannels: Channel[] = [];
  chatWindowChatInfo: string = '';
  currentChannelChatMessages: ChannelMessage[] = [];

  faVideo = faVideo;
  faPhone = faPhone;
  faStop = faStop;;

  // audio & video streaming
  isVideoVisible: boolean = false;
  isAudioVisible: boolean = false;

  public webRTCHandler: WebRTCHandler | null = null;

  constructor(private changeDetectorRef: ChangeDetectorRef) {
  }

  /*   async requestPermissions() {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
    }
  }
 */

  async ngOnInit() {
    // await this.requestPermissions();

    this.webRTCHandler = WebRTCHandler.getInstance(this.onReceiveMessage.bind(this), this.onReceiveSystemCommand.bind(this), this.changeDetectorRef);
    if (!this.webRTCHandler) {
      console.error('WebRTC handler not initialized');
      return;
    }

    let channels = getChannels();
    this.channels = channels;

    this.chatWindowChatInfo = this.getChatWindowChatInfo(undefined, undefined);
  }

  setMessages(channelName: WebRTCDataChannelLabel) {
    if (!this.webRTCHandler) {
      console.error('WebRTC handler not initialized');
      return;
    }

    if (!channelName === null || channelName === undefined) {
      console.error('Channel is null');
      return;
    }

    if (channelName.dataChannelName === null || channelName.dataChannelName === undefined) {
      console.error('Channel name is empty');
      return;
    }

    this.currentChannelChatMessages = this.webRTCHandler.getChannelMessages(channelName.dataChannelName) || [];
    this.changeDetectorRef.detectChanges();

  }

  getChatWindowChatInfo(user?: Channel, toChannel?: Channel): string {
    if (user === null || user === undefined) {
      return 'Select user & channel from above dropdown lists to start chatting...';
    }

    if (user && (toChannel === null || toChannel === undefined)) {
      return `Select channel from above dropdown list to chat with user ${user.name}...`;
    }

    if (toChannel && (user === null || user === undefined)) {
      return `Select user from above dropdown list to chat with channel ${toChannel.name}...`;
    }

    return `${user!.name} is chatting on channel ${toChannel!.name}`;
  }

  async onChannelChange(params: { channel: Channel, channelListType: string }) {
    console.log('onChannelChange: ', params.channel, params.channelListType);

    if (params.channelListType === 'Users') {
      this.myChannel = params.channel;
      this.selectedUser = params.channel.name;

      const toChannelsList = this.channels.filter(channel => channel.name !== params.channel.name);
      this.visibleChannels = toChannelsList;

      this.chatWindowChatInfo = this.getChatWindowChatInfo(params.channel, undefined);
    }
    else if (params.channelListType === 'Channels') {
      this.toChannel = params.channel;
      this.chatWindowChatInfo = this.getChatWindowChatInfo(this.myChannel!, params.channel);

      await this.webRTCHandler!.ConnectDataChannel(this.tenantId, this.myChannel!, params.channel);
      this.currentDataChannel = this.webRTCHandler!.getcurrentDataChannel();
      console.log('ChatViewComponent: Current data channel: ', this.currentDataChannel);

      this.setMessages(this.currentDataChannel!);
    }
  }

  onSentMessage(event: { channelName: WebRTCDataChannelLabel, msg: ChannelMessage }) {
    if (event.channelName === null || event.channelName === undefined) {
      console.error('Channel is null');
      return;
    }

    if (event.channelName.dataChannelName === null || event.channelName.dataChannelName === undefined) {
      console.error('Channel name is empty');
      return;
    }

    if (this.currentDataChannel?.dataChannelName === event.channelName.dataChannelName) {
      this.currentChannelChatMessages = this.webRTCHandler!.getChannelMessages(event.channelName.dataChannelName) || [];
    }
  }

  onReceiveMessage(channelMessage: ChannelMessage) {
    if (channelMessage === null || channelMessage === undefined) {
      console.error('Channel message is null');
      return;
    }

    if (channelMessage.dataChannel === null || channelMessage.dataChannel === undefined) {
      console.error('data Channel label is empty');
      return;
    }

    if (this.currentDataChannel?.dataChannelName === channelMessage.dataChannel.dataChannelName) {
      this.currentChannelChatMessages = this.webRTCHandler!.getChannelMessages(channelMessage.dataChannel.dataChannelName!) || [];
    }
  }

  onReceiveSystemCommand(channelCommand: ChannelMessage) {
    if (channelCommand === null || channelCommand === undefined) {
      console.error('Channel command is null');
      return;
    }

    if (channelCommand.dataChannel === null || channelCommand.dataChannel === undefined) {
      console.error('data Channel label is empty');
      return;
    }

    // IMPORTANT:  DO YOUR COMMAND HANDLING HERE
  }

  // -------------------------------------------------------------------------------------
  // audio & video streaming
  public async handleVideoStreaming() {
    console.log('Starting video streaming');

    this.isAudioVisible = false;
    this.isVideoVisible = !this.isVideoVisible;

    await this.streamingWindow?.handleVideoStreaming();
  }

  handleAudioStreaming() {
    console.log('Starting audio streaming');
    this.isVideoVisible = false;
    this.isAudioVisible = !this.isAudioVisible;

    if (this.streamingWindow) {
      this.streamingWindow.handleAudioStreaming();
    }
  }
}
