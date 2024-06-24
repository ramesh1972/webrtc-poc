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
import { WebRTCDataChannelLabel, WebRTCDataChannelStreamType, WebRTCDataChannelType } from '../../libs/webrtc/models/DataChannelLabel';
import { WebRTCChannelType } from '../../libs/webrtc/models/Channel';
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
  groupChannel?: Channel;

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
    // assuming the second user is the dummy channel list is the current user id
    const thisUserId = "2";
    this.webRTCHandler = WebRTCHandler.getInstance(thisUserId, this.onReceiveMessage.bind(this), this.onReceiveSystemCommand.bind(this), this.changeDetectorRef);
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

    let text = `Chatting with user ${user!.name} on channel ${toChannel!.name}`;
    if (toChannel!.channelType === WebRTCChannelType.GROUP) {
      text = `Chatting with group ${toChannel!.name}`;
      text += ` with members: ${this.getGroupMemberNames(user, toChannel!)}`;
    }

    return text;
  }

  getGroupMemberNames(user: Channel, channel: Channel): string {
    if (channel.channelType !== WebRTCChannelType.GROUP) {
      return '';
    }

    if (!this.isUserPartOfChannel(user, channel)) {
      return 'Invalid: You are not part of this group';
    }

    const memberNames = channel.groupMembers?.map(member => this.getMemberName(user, member));
    return memberNames?.join(', ') || '';
  }

  isUserPartOfChannel(user: Channel, channel: Channel): boolean {
    if (channel.channelType !== WebRTCChannelType.GROUP) {
      return false;
    }

    const listOfMemberIds: string[] = [];
    channel.groupMembers?.map(member => listOfMemberIds.push(member.id));

    return listOfMemberIds?.includes(user.id) || false;
  }

  getMemberName(user: Channel, member: Channel): string {
    if (member.id === user.id) {
      return 'Yourself';
    }

    const channel = this.channels.find(channel => channel.id === member.id);
    if (channel) {
      if (channel.name !== user.name)
        return channel.name;
      else {
        return 'Yourself';
      }
    }

    return '';
  }

  async onChannelChange(params: { channel: Channel, channelListType: string }) {
    console.log('onChannelChange: ', params.channel, params.channelListType);

    if (params.channelListType === 'Users') {
      this.myChannel = params.channel;
      this.selectedUser = params.channel.name;

      const toChannelsList = this.channels.filter(channel => channel.name !== params.channel.name);
      this.visibleChannels = toChannelsList;

      this.chatWindowChatInfo = this.getChatWindowChatInfo(params.channel, undefined);

      this.webRTCHandler!.currentUserId = params.channel.id;
    }
    else if (params.channelListType === 'Channels') {
      // pretty print JSON params.channel
      console.log('onChannelChange: ', JSON.stringify(params.channel, null, 2));

      this.toChannel = params.channel;
      this.chatWindowChatInfo = this.getChatWindowChatInfo(this.myChannel!, params.channel);

      // ----- IMPORTANT:  CONNECT TO DATA CHANNEL HERE -----
      if (params.channel.channelType === WebRTCChannelType.GROUP) {
        this.currentDataChannel = await this.webRTCHandler!.ConnectDataChannel(WebRTCDataChannelType.GROUP, this.tenantId, this.myChannel!, params.channel) || undefined;
      }
      else {

        this.currentDataChannel = await this.webRTCHandler!.ConnectDataChannel(WebRTCDataChannelType.P2P, this.tenantId, this.myChannel!, params.channel) || undefined;
        if (this.currentDataChannel === null || this.currentDataChannel === undefined) {
          console.error('ChatViewComponent: Current data channel is null');
          return;
        }
      }

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

  OnReceiveMediaStream(stream: any) {
    if (stream === null || stream === undefined) {
      console.error('Stream is null');
      return;
    }

    this.streamingWindow?.setStream(stream);
    // IMPORTANT:  DO YOUR STREAM HANDLING HERE
  }

  // -------------------------------------------------------------------------------------
  // audio & video streaming
  public async handleVideoStreaming() {
    console.log('Starting video streaming');

    this.isAudioVisible = false;
    this.isVideoVisible = !this.isVideoVisible;

    await this.streamingWindow?.handleVideoStreaming(this.isVideoVisible);
  }

  handleAudioStreaming() {
    console.log('Starting audio streaming');

    this.isVideoVisible = false;
    this.isAudioVisible = !this.isAudioVisible;

    /*     if (this.streamingWindow) {
          this.streamingWindow.handleAudioStreaming(this.isAudioVisible);
        } */
  }
}
