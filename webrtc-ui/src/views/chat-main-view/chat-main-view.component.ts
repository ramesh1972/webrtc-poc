import { ChangeDetectorRef, Component } from '@angular/core';
import { ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import getChannels from '../../store/channelList';

import { ChatChannelsPanelComponent } from '../../components/chat-channels-panel/chat-channels-panel.component';
import { ChatMessageWindowComponent } from '../../components/chat-message-window/chat-message-window.component';

import { WebRTCChannelsCollection } from '../../services/core/WebRTCChannelsCollection';
import WebRTCCallServiceFacade from '../../services/core/WebRTCCallServiceFacade';

import { Channel } from '../../services/models/Channel';
import { ChannelMessage } from '../../services/models/ChannelMessage';
import { ChannelMessages } from '../../services/models/ChannelMessages';

@Component({
  selector: 'app-chat-main-view',
  standalone: true,
  imports: [ChatChannelsPanelComponent, ChatMessageWindowComponent, FormsModule, CommonModule],
  templateUrl: './chat-main-view.component.html',
  styleUrl: './chat-main-view.component.css'
})
export class ChatMainViewComponent {
  @ViewChild(ChatMessageWindowComponent) chatMessageWindowComponent: ChatMessageWindowComponent | null = null;

  selectedUser: string = '';

  // global collection of Web RTC call services
  callServicesCollection: WebRTCChannelsCollection | null | undefined = null;

  // for the panel of channels
  channels = getChannels();
  visibleChannels: any[] = [];
  currentChannelName: string = '';
  myChannel: Channel | null = null;
  toChannel: Channel | null = null;

  // for the chat window
  webRTCCallServiceFacade: WebRTCCallServiceFacade | null = null;
  channelAndMessagesList: Map<string, ChannelMessages> = new Map<string, ChannelMessages>();
  currentVisibleChannelChatMessages: ChannelMessage[] = [];

  constructor(private cdr: ChangeDetectorRef) {
    console.log("channels in view=" + this.channels.length);
  }

  ngOnInit() {
    console.log('ChatMainViewComponent initialized toChannel:');

    this.callServicesCollection = new WebRTCChannelsCollection(this.cdr, this.onReceiveMessage.bind(this));
    this.channelAndMessagesList = new Map<string, ChannelMessages>();

    this.webRTCCallServiceFacade = null;

    this.myChannel = this.channels[0];
    this.selectedUser = this.myChannel.name;

    if (this.myChannel !== null) {
      this.visibleChannels = this.channels.filter((channel: any) => channel.name !== this.myChannel?.name);
    }

    this.toChannel = this.visibleChannels[0];

    this.setProperties();
  }

  userChanged(event: any) {
    console.log("logged in user changed in panel=" + event.target.value);

    if (event.target.value === null || event.target.value === undefined) {
      return;
    }

    this.myChannel = this.channels.find(channel => channel.name === event.target.value) || this.channels[0];
    if (this.myChannel !== null)
      console.log("selected login user: ", this.myChannel.name);

    // remove user name from channel list
    this.visibleChannels = this.channels.filter((channel: any) => channel.name !== event.target.value);

    this.toChannel = this.visibleChannels[0];

    this.setProperties();
  }

  async onChannelChange(channelName: any) {
    console.log("Channel changed to in parent: " + channelName);

    this.toChannel = this.visibleChannels.find(channel => channel.name === channelName) || this.channels[1];

    this.setProperties();
  }

  async setProperties() {
    // get or create the call Service Facade
    if (this.callServicesCollection === null || this.callServicesCollection === undefined) {
      console.error('Call services collection not found');
      return;
    }

    let callServiceFacade = await this.callServicesCollection.Connect(this.myChannel!.id, this.toChannel!.id);
    if (callServiceFacade === null || callServiceFacade === undefined) {
      console.error('Call service facade not found');
      return;
    }

    this.webRTCCallServiceFacade = callServiceFacade;
    this.currentChannelName = this.webRTCCallServiceFacade.GetChannelId();
    this.currentVisibleChannelChatMessages = this.channelAndMessagesList.get(this.currentChannelName)?.channelMessages || [];

    // set the properties of chat window
    this.chatMessageWindowComponent?.setMessageHandlers(this.webRTCCallServiceFacade);
  }

  private onReceiveMessage(channelName: string, type: string, message: string): void {
    message = message.trim();
    console.log('--------------> Received message in component:', message);
    console.log('--------------> Received message type in component:', type);

    // add the message to the chatMessages
    if (this.channelAndMessagesList.get(channelName) === null || this.channelAndMessagesList.get(channelName) === undefined) {
      this.channelAndMessagesList.set(channelName, { channelId: channelName, channelMessages: [] });
      this.cdr.detectChanges();
    }

    this.channelAndMessagesList.get(channelName)?.channelMessages.push({ type: type, direction: 'in', channelmessage: message, timestamp: new Date().toLocaleTimeString() });
    this.cdr.detectChanges();

    // update the currentVisibleChannelChatMessages
    if (channelName === this.currentChannelName) {
      this.currentVisibleChannelChatMessages = this.channelAndMessagesList.get(channelName)?.channelMessages || [];
      this.cdr.detectChanges();
    }
  }

  public AddMessage(params: {channelId: string, message: ChannelMessage}): void {
    console.log('--------------> Adding message in AddMessageMethod:', params.message.channelmessage);

    let channelName = params.channelId;
    let msg = params.message;

    // add the message to the chatMessages
    if (this.channelAndMessagesList.get(channelName) === null || this.channelAndMessagesList.get(channelName) === undefined) {
      this.channelAndMessagesList.set(channelName, { channelId: channelName, channelMessages: [] });
      this.cdr.detectChanges();
    }

    this.channelAndMessagesList.get(channelName)?.channelMessages.push(msg);
    this.cdr.detectChanges();

    // update the currentVisibleChannelChatMessages
    if (channelName === this.currentChannelName) {
      this.currentVisibleChannelChatMessages = this.channelAndMessagesList.get(channelName)?.channelMessages || [];
      this.cdr.detectChanges();
    }
  }
}