import { Component, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EventEmitter } from '@angular/core';

import { Channel } from '../../libs/webrtc/models/Channel';

@Component({
  standalone: true,
  selector: 'app-channel-list',
  templateUrl: './channel-list.component.html',
  imports: [CommonModule],
  styleUrls: ['./channel-list.component.css']
})
export class ChannelListComponent {

  @Input() channelListType: string = '';
  @Input() selectedChannel: Channel | undefined;
  @Input() channelList: Channel[] | undefined;
  @Input() headerText?: string;
  @Output() OnChannelChange: EventEmitter<{channel: Channel, channelListType: string}> = new EventEmitter<{channel: Channel, channelListType: string}>();

  showChannelsPanel = false;

  toggleChannelsPanel() {
    console.log("In toggleChannelsPanel");
    this.showChannelsPanel = !this.showChannelsPanel;
  }

  async channelChanged(selChannel: Channel) {
    console.log("In channelChanged: ", selChannel);
    this.selectedChannel = selChannel;
    this.toggleChannelsPanel();
    
    console.log("Emitting onChannelChange");
    const params = { channel: selChannel, channelListType: this.channelListType };
    this.OnChannelChange!.emit(params);
    console.log("Emitting onChannelChange done");
  }
}

