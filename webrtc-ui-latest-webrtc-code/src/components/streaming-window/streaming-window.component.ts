import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faStop } from '@fortawesome/free-solid-svg-icons';

import WebRTCHandler from '../../libs/webrtc/WebRTCHandler';

import { WebRTCDataChannelLabel } from '../../libs/webrtc/models/DataChannelLabel';
import { Channel } from '../../libs/webrtc/models/Channel';

@Component({
  selector: 'app-streaming-window',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './streaming-window.component.html',
  styleUrl: './streaming-window.component.css'
})
export class StreamingWindowComponent {

  @Input() webRTCHandler: WebRTCHandler | null = null;
  @Input() dataChannelLabel: WebRTCDataChannelLabel | null = null;

  toChannelName: string = '';

  // audio & video streaming
  @Input() isVideoVisible: boolean = false;
  @Input() isAudioVisible: boolean = false;

  isVideoStreamingOn: boolean = false;
  isAudioStreamingOn: boolean = false;

  faStop = faStop;

  ngOnInit() {
    this.setToChannelName()
  }

  setToChannelName() {
    this.toChannelName = 'Unknown';

    if (this.dataChannelLabel !== null && this.dataChannelLabel !== undefined) {
      if (this.dataChannelLabel.toChannel !== null && this.dataChannelLabel.toChannel !== undefined) {
        this.toChannelName = this.dataChannelLabel.toChannel.name;;
      }
    }
  }

  // -------------------------------------------------------------------------------------
  // audio & video streaming
  public async handleVideoStreaming() {
    console.log('StreamingComponent: Starting video streaming');

    if (this.isVideoStreamingOn)
      return;

    this.setToChannelName();

    // get the local & remote video elements
    let localVideoElement = document.getElementById('localVideo') as HTMLVideoElement;
    let remoteVideoElement = document.getElementById('remoteVideo') as HTMLVideoElement;

    if (localVideoElement === null || remoteVideoElement === null) {
      console.error('Video elements not found');
      return;
    }

    console.log('HandleVIdeoStreaming: datachannel label: ', this.dataChannelLabel);

    await this.webRTCHandler?.StartVideoStreaming(this.dataChannelLabel!, localVideoElement, remoteVideoElement);
    localVideoElement.play();
    this.isVideoStreamingOn = true;
    console.log('Video streaming setup completed');
  }

  handleAudioStreaming() {
    console.log('Starting audio streaming');

    if (this.isAudioStreamingOn)
      return;

    this.setToChannelName();

    // get the local & remote Audio elements
    let localAudioElement = document.getElementById('localAudio') as HTMLAudioElement;
    let remoteAudioElement = document.getElementById('remoteAudio') as HTMLAudioElement;

    if (localAudioElement === null || remoteAudioElement === null) {
      console.error('Audio elements not found');
      return;
    }

    console.log('HandleAudioStreaming: datachannel label: ', this.dataChannelLabel);
    this.webRTCHandler?.StartAudioStreaming(this.dataChannelLabel!, localAudioElement, remoteAudioElement);
    localAudioElement.play();
    this.isAudioStreamingOn = true;
  }

  async StopStreaming() {

    if (this.isVideoStreamingOn) {
      console.log('Stopping video streaming');

      await this.webRTCHandler?.StopVideoStreaming();

      this.isVideoStreamingOn = false;
    }
    else if (this.isAudioStreamingOn) {
      console.log('Stopping audio streaming');

      await this.webRTCHandler?.StopAudioStreaming();
      this.isAudioStreamingOn = false;
    }
  }
}
