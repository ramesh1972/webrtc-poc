import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HostListener } from '@angular/core';

@Component({
  selector: 'app-chat-channels-panel',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './chat-channels-panel.component.html',
  styleUrl: './chat-channels-panel.component.css'
})
export class ChatChannelsPanelComponent {
  @Input() myChannel!: any;
  @Input() toChannel!: any;
  @Input() channelList!: any;
  @Output() channelChange = new EventEmitter<any>();

  showChannelsPanel = false;

  ngOnInit() {
    console.log("channels in panel=" + this.channelList);

    let deviceWidth = window.innerWidth;
    if (deviceWidth > 768) {
      this.showChannelsPanel = true;
    }
    else {
      this.showChannelsPanel = false;
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    let deviceWidth = event.target.innerWidth;
    if (deviceWidth > 768) {
      this.showChannelsPanel = true;
    }
    else {
      this.showChannelsPanel = false;
    }
  }
  
  channelChanged(channelName: any) {
    console.log("channel changed in panel=" + channelName);
    this.channelChange.emit(channelName);
  }

  toggleChannelsPanel() {
    this.showChannelsPanel = !this.showChannelsPanel;
  }
}
