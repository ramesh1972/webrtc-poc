import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Renderer2, ElementRef } from '@angular/core';

import  WebRTCHandler  from '../../libs/webrtc/WebRTCHandler';

import { ChannelMessage } from '../../libs/webrtc/models/ChannelMessage';
import { WebRTCDataChannelLabel } from '../../libs/webrtc/models/DataChannelLabel';

@Component({
  selector: 'app-chat-box',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-box.component.html',
  styleUrl: './chat-box.component.css'
})
export class ChatBoxComponent {
  @Input() webRTCHandler: WebRTCHandler | null = null;
  @Input() currentDataChannel?: WebRTCDataChannelLabel;
  @Input() onSentMessage?: (dataChannelName: WebRTCDataChannelLabel, msg: ChannelMessage) => void;

  newChatMessage: string = '';
  recordingURL: string = '';

  isVideoMessage: boolean = false;
  isAudioMessage: boolean = false;
  isTextMessage: boolean = true;
  isVideoRecordingOn: boolean = false;
  isAudioRecordingOn: boolean = false;

  isVideoInputVisible: boolean = false;
  isAudioInputVisible: boolean = false;

  isVideoStreamingOn: boolean = false;
  isAudioStreamingOn: boolean = false;

  isImageCaptureVisible: boolean = false;

  constructor() {}

  public async handleVideoMessaging() {
    this.isVideoMessage = true;
    this.isAudioMessage = false;

    this.isAudioInputVisible = false;
    this.isVideoInputVisible = true;

    let videoElement = document.getElementById('sendVideoElement') as HTMLVideoElement;
    if (videoElement === null || videoElement === undefined) {
      console.error('Video element not found');
      return;
    }

    if (this.isVideoRecordingOn) {
      console.log('Stopping video messaging');
      let url = await this.webRTCHandler?.StopVideo().then((url) => {
        this.recordingURL = url;
      });

      if (videoElement)
        videoElement.parentNode!.removeChild(videoElement);
    }

    console.log('Starting video messaging');

    this.isVideoMessage = true;
    this.isAudioMessage = false;
    this.isVideoRecordingOn = true;
    this.isAudioRecordingOn = false;
    this.recordingURL = '';

    this.webRTCHandler!.StartVideo(this.currentDataChannel!, videoElement);
  }

  async handleAudioMessaging() {
    this.isVideoMessage = false;
    this.isAudioMessage = true;
    this.isAudioInputVisible = true;
    this.isVideoInputVisible = false;

    let audioElement = document.getElementById('sendAudioElement') as HTMLVideoElement;
    if (audioElement === null || audioElement === undefined) {
      console.error('Audio element not found');
      return;
    }

    if (this.isVideoRecordingOn) {
      console.log('Stopping audio messaging');
      let url = await this.webRTCHandler?.StopAudio().then((url) => {
        this.recordingURL = url;
      });

      if (audioElement)
        audioElement.parentNode!.removeChild(audioElement);
    }

    console.log('Starting audio messaging');

    this.isVideoMessage = true;
    this.isAudioMessage = false;
    this.isVideoRecordingOn = true;
    this.isAudioRecordingOn = false;
    this.recordingURL = '';

    this.webRTCHandler!.StartAudio(this.currentDataChannel!, audioElement);
  }

  async sendMessage() {
    let sentMsg: ChannelMessage | null | undefined = undefined;

    if (!this.isTextMessage && !this.isVideoMessage && !this.isAudioMessage) {
      console.error('No message type selected');
      return;
    }

    this.isVideoInputVisible = false;
    this.isAudioInputVisible = false;

    if (this.isVideoMessage) {
      sentMsg = await this.webRTCHandler!.SendVideoMessage(this.currentDataChannel!);
    } else if (this.isAudioMessage) {
      sentMsg = await this.webRTCHandler!.SendAudioMessage(this.currentDataChannel!);
    }

    const newTextMessage = this.newChatMessage.trim();
    if (newTextMessage) {
      sentMsg = await this.webRTCHandler!.SendTextMessage(this.currentDataChannel!, newTextMessage);
      this.isAudioMessage = false;
      this.isVideoMessage = false;
      this.newChatMessage = '';
    }

    if (!sentMsg) {
      console.error('Failed to send message');
      return;
    }

    if (this.onSentMessage)
      this.onSentMessage(this.currentDataChannel!, sentMsg);
  }

  handleMessageChange(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    this.newChatMessage = inputElement.value;
  }
}
