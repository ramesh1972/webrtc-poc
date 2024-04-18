
import { Component, Input } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, retry } from 'rxjs';
import { Renderer2, ElementRef } from '@angular/core';

import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faVideo } from '@fortawesome/free-solid-svg-icons';
import { faMicrophone } from '@fortawesome/free-solid-svg-icons';
import { faStop } from '@fortawesome/free-solid-svg-icons';

import CallServiceFacade from '../../services/callserviceFacade';
import { Channel } from '../../store/channelList';
import getChannels from '../../store/channelList';


interface ChannelMessage {
  type: string;
  direction: string;
  channelmessage: string;
  userName?: string;
  timestamp?: string;
}

interface ChannelMessages {
  channelId: string;
  channelMessages: ChannelMessage[];
}

@Component({
  selector: 'app-chat-message-window',
  standalone: true,
  imports: [FormsModule, CommonModule, FontAwesomeModule],
  templateUrl: './chat-message-window.component.html',
  styleUrl: './chat-message-window.component.css'
})
export class ChatMessageWindowComponent {
  @Input() myChannel: any;
  private _toChannel = new BehaviorSubject<Channel | null>(null);
  @Input() toChannel: any;

  toChannelId: number = -1;
  cuurentChannelId: string = '';

  channelAndMessagesList: Map<string, ChannelMessages>;
  currentChatMessages: ChannelMessage[] = [];

  newChatMessage: string = '';
  isVideoMessage: boolean = false;
  isAudioMessage: boolean = false;
  isVideoRecordingOn: boolean = false;
  isAudioRecordingOn: boolean = false;
  recordingURL: string = '';

  callServiceFacades: Map<string, CallServiceFacade> = new Map<string, CallServiceFacade>();

  faVideo = faVideo;
  faMicrophone = faMicrophone;
  faStop = faStop;

  constructor(private cdr: ChangeDetectorRef, private renderer: Renderer2, private el: ElementRef) {
    // Initialize callServiceFacade here if needed
    this.cdr = cdr;
    this.channelAndMessagesList = new Map<string, ChannelMessages>;
  }

  // Function to update the channel
  updateChannel(channel: Channel) {
    this._toChannel.next(channel);
  }

  ngOnInit() {
    console.log('ChatMessageWindowComponent initialized');

    // Expose toChannel as an Observable
    this.toChannel = this._toChannel.asObservable();

    // and subscribe to changes
    this.toChannel.subscribe((channel: Channel | null): void => {
      if (channel === null || channel === undefined) {
        return;
      }

      console.log('Channel updated:', channel.name);
      console.log('my channel:', this.myChannel.name);

      this.toChannelId = channel.id;

      let dataChannelId = this.createDataChannelId(this.myChannel.id, channel.id);
      this.cuurentChannelId = dataChannelId;

      this.createFacade(dataChannelId);
      // **************** connecting to webrtc ***************
      this.connect(dataChannelId);

      let channelMessages = this.channelAndMessagesList.get(dataChannelId);
      if (channelMessages === null || channelMessages === undefined) {
        this.channelAndMessagesList.set(dataChannelId, { channelId: dataChannelId, channelMessages: [] });

        channelMessages = this.channelAndMessagesList.get(dataChannelId);
      }

      this.currentChatMessages = channelMessages ? channelMessages.channelMessages : [];

    });
  }

  private getInitials(name: string) {
    return name.charAt(0).toUpperCase();
  }

  private createDataChannelId(fromChannelId: number, toChannelId: number): string {
    let firstId = fromChannelId <= toChannelId ? fromChannelId : toChannelId
    let secondId = firstId === toChannelId ? fromChannelId : toChannelId;

    let cuurentChannelId = "tenant-1-" + "usr-" + firstId + "-" + "usr-" + secondId;

    console.log("Created datachannel id string", cuurentChannelId);
    return cuurentChannelId;
  }

  createAllFacades() {
    let channels = getChannels();
    for (let i = 0; i < channels.length; i++) {
      for (let j = i + 1; j < channels.length; j++) {
        if (i !== j) {
          let dataChannelId = this.createDataChannelId(channels[i].id, channels[j].id);
          this.createFacade(dataChannelId);
        }
      }
    }
  }

  createFacade(dataChannelId: string) {

    let callServiceFacade = this.callServiceFacades.get(dataChannelId);

    if (callServiceFacade === null || callServiceFacade === undefined) {
      console.log('-----> Creating facade for channel:', dataChannelId);

      callServiceFacade = new CallServiceFacade(this.cdr, this.onReceiveMessage.bind(this));
      callServiceFacade.from_user = this.myChannel.name;
      callServiceFacade.to_user = this.toChannel.name;

      this.callServiceFacades.set(dataChannelId, callServiceFacade);
    }
  }


  async connect(dataChannelId: string) {
    if (dataChannelId === '' || dataChannelId === null || dataChannelId === undefined) {
      console.error('Invalid dataChannelId');
      return;
    }

    console.log('----------> Connecting to channel:' + dataChannelId);

    let callServiceFacade = this.callServiceFacades.get(dataChannelId);
    if (callServiceFacade === null || callServiceFacade === undefined) {
      console.error('Call service facade not found');
      return;
    }

    if (callServiceFacade.isConnected() === true) {
      console.log('-----------------> Already Connected to CallServiceFacade', dataChannelId);
    } else {
      // *********** make the connection ***********
      await callServiceFacade.connect(dataChannelId);

      if (callServiceFacade.isConnected() === true) {
        console.log('------------------->  Connected to Data Channel:', dataChannelId);
        this.cuurentChannelId = dataChannelId;
      } else {
        console.error('Failed to connect to Data Channel', dataChannelId);
      }
    }
  }

  public async handlVideoMessaging() {
    this.isVideoMessage = true;
    this.isAudioMessage = false;
    if (this.isVideoRecordingOn) {

      console.log('Stopping video messaging');
      let url = await this.stopVideo();
      this.recordingURL = url;

      let videoElement = this.el.nativeElement.querySelector('.send-video-input');
      if (videoElement) {
        this.renderer.removeChild(this.el.nativeElement, videoElement);
      }
    }

    console.log('Starting video messaging');
    this.startVideoMessaging();
  }

  public async handleAudioMessaging() {
    this.isVideoMessage = false;
    this.isAudioMessage = true;
    if (this.isAudioRecordingOn) {
      console.log('Stopping audio messaging');
      let url = await this.stopAudio();
      this.recordingURL = url;
      let audioElement = this.el.nativeElement.querySelector('.send-audio-input');
      if (audioElement) {
        this.renderer.removeChild(this.el.nativeElement, audioElement);
      }
    }

    console.log('Starting video messaging');
    this.startAudioMessaging();
  }

  public async startVideoMessaging() {
    let callServiceFacade = this.callServiceFacades.get(this.cuurentChannelId);
    if (callServiceFacade === null || callServiceFacade === undefined) {
      console.error('Call service facade not found');
      return;
    }

    if (callServiceFacade.isConnected() === false) {
      console.error('Call service facade not connected');
      return;
    }

    let videoElement = document.getElementById('sendVideoElement') as HTMLVideoElement;
    if (videoElement === null || videoElement === undefined) {
      console.error('Video element not found');
      return;
    }

    this.isVideoMessage = true;
    this.isAudioMessage = false;
    this.isVideoRecordingOn = true;
    this.isAudioRecordingOn = false;
    this.recordingURL = '';
    callServiceFacade.startVideoMessaging(videoElement);
  }

  public async startAudioMessaging() {
    let callServiceFacade = this.callServiceFacades.get(this.cuurentChannelId);
    if (callServiceFacade === null || callServiceFacade === undefined) {
      console.error('Call service facade not found');
      return;
    }

    if (callServiceFacade.isConnected() === false) {
      console.error('Call service facade not connected');
      return;
    }

    let audioElement = document.getElementById('sendAudioElement') as HTMLVideoElement;
    if (audioElement === null || audioElement === undefined) {
      console.error('Audio element not found');
      return;
    }

    this.isVideoMessage = false;
    this.isAudioMessage = true;
    this.isVideoRecordingOn = false;
    this.isAudioRecordingOn = true;
    this.recordingURL = '';
    callServiceFacade.startAudioMessaging(audioElement);
  }

  public async stopVideo(): Promise<string> {
    let callServiceFacade = this.callServiceFacades.get(this.cuurentChannelId);
    if (callServiceFacade === null || callServiceFacade === undefined) {
      console.error('Call service facade not found');
      return '';
    }

    console.log('Stopping video');
    let url = await callServiceFacade.stopVideo();
    this.isVideoRecordingOn = false;
    console.log('Video stopped');
    return url;
  }

  public async stopAudio(): Promise<string> {
    let callServiceFacade = this.callServiceFacades.get(this.cuurentChannelId);
    if (callServiceFacade === null || callServiceFacade === undefined) {
      console.error('Call service facade not found');
      return '';
    }

    console.log('Stopping video');
    let url = await callServiceFacade.stopAudio();
    this.isAudioRecordingOn = false;
    console.log('audio stopped');
    return url;
  }

  async sendMessage() {
    console.log('-------------> Sending message:');
    if (this.newChatMessage === '' && (this.isVideoMessage === false && this.isAudioMessage === false))
      return;

    let callServiceFacade = this.callServiceFacades.get(this.cuurentChannelId);
    if (callServiceFacade === null || callServiceFacade === undefined) {
      console.error('Call service facade not found');
      return;
    }

    if (callServiceFacade.isConnected() === false) {
      console.error('Call service facade not connected');
      return;
    }

    if (this.channelAndMessagesList.get(this.cuurentChannelId) == null || this.channelAndMessagesList.get(this.cuurentChannelId) == undefined) {
      let channelMessages: ChannelMessages = { channelId: this.cuurentChannelId, channelMessages: [] };

      this.channelAndMessagesList.set(this.cuurentChannelId, channelMessages);
    }

    console.log('----------------> is Video message?:', this.isVideoMessage);
    if (this.isVideoMessage) {
      console.log('----------------> Sending video message');
      let URL: string = await callServiceFacade.sendVideo();

      this.channelAndMessagesList.get(this.cuurentChannelId)?.channelMessages.push({ type: 'video', direction: 'out', channelmessage: URL, userName: this.getInitials(this.callServiceFacades.get(this.cuurentChannelId)?.from_user ?? ''), timestamp: new Date().toLocaleTimeString() });
      this.isVideoMessage = false;
      this.isAudioMessage = false;
      return;
    }
    else if (this.isAudioMessage) {
      console.log('----------------> Sending audio message');
      let URL: string = await callServiceFacade.sendAudio();

      this.channelAndMessagesList.get(this.cuurentChannelId)?.channelMessages.push({ type: 'audio', direction: 'out', channelmessage: URL, userName: this.getInitials(this.callServiceFacades.get(this.cuurentChannelId)?.from_user ?? ''), timestamp: new Date().toLocaleTimeString() });
      this.isVideoMessage = false;
      this.isAudioMessage = false;
      return;
    }

    this.channelAndMessagesList.get(this.cuurentChannelId)?.channelMessages.push({ type: 'text', direction: 'out', channelmessage: this.newChatMessage, userName: this.getInitials(this.callServiceFacades.get(this.cuurentChannelId)?.from_user ?? ''), timestamp: new Date().toLocaleTimeString() });
    this.currentChatMessages = this.channelAndMessagesList.get(this.cuurentChannelId)?.channelMessages ?? [];

    callServiceFacade.sendMessage(this.newChatMessage);
    console.log('---------------> Sent message in Component:', this.newChatMessage);
  }

  private onReceiveMessage(channelName: string, type: string, message: string): void {
    message = message.trim();
    console.log('--------------> Received message in component:', message);
    console.log('--------------> Received message type in component:', type);

    if (this.channelAndMessagesList.get(channelName ?? '') == null || this.channelAndMessagesList.get(channelName ?? '') == undefined) {
      let channelMessages: ChannelMessages = { channelId: channelName ?? '', channelMessages: [] };

      this.channelAndMessagesList.set(channelName ?? '', channelMessages);
    }

    this.channelAndMessagesList.get(channelName ?? '')?.channelMessages.push({ type: type, direction: 'in', channelmessage: message, userName: this.getInitials(this.callServiceFacades.get(this.cuurentChannelId)?.from_user ?? ''), timestamp: new Date().toLocaleTimeString() });
    this.currentChatMessages = this.channelAndMessagesList.get(channelName ?? '')?.channelMessages ?? [];

    this.cdr.detectChanges();
  }
}
