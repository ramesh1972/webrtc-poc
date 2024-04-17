import { Component } from '@angular/core';
import getChannels from '../../store/channelList';
import { Channel } from '../../store/channelList';
import { ChatChannelsPanelComponent } from '../../components/chat-channels-panel/chat-channels-panel.component';
import { ChatMessageWindowComponent } from '../../components/chat-message-window/chat-message-window.component';
import { ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-chat-main-view',
  standalone: true,
  imports: [ChatChannelsPanelComponent, ChatMessageWindowComponent, FormsModule, CommonModule],
  templateUrl: './chat-main-view.component.html',
  styleUrl: './chat-main-view.component.css'
})
export class ChatMainViewComponent {
  @ViewChild(ChatMessageWindowComponent) chatMessageWindowComponent!: ChatMessageWindowComponent;

  channels = getChannels();
  myChannel: Channel | null = null;
  toChannel: Channel | null = null;

  visibleChannels: any[] = [];

  constructor() {
    console.log("channels in view=" + this.channels.length);
  }

  ngOnInit() {
    console.log('ChatMainViewComponent initialized toChannel:');
    //console.log("my channel name ", this.myChannel.name);
    if (this.myChannel !== null) {
      this.visibleChannels = this.channels.filter((channel: any) => channel.name !== this.myChannel?.name);
    }
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
  }

  onChannelChange(channelName: any) {
    console.log("Channel changed to in parent: " + channelName);

    this.toChannel = this.visibleChannels.find(channel => channel.name === channelName) || this.channels[1];

    // Update the toChannel value
    if (this.toChannel !== null)
      this.chatMessageWindowComponent.updateChannel(this.toChannel);
  }
}
