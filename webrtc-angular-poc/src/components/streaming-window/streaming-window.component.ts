import { Component, Input } from '@angular/core';
import { Renderer2, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faStop } from '@fortawesome/free-solid-svg-icons';

import WebRTCHandler from '../../libs/webrtc/WebRTCHandler';

import { WebRTCDataChannelLabel, WebRTCDataChannelType, WebRTCDataChannelStreamType } from '../../libs/webrtc/models/DataChannelLabel';
import { Channel } from '../../libs/webrtc/models/Channel';

@Component({
  selector: 'app-streaming-window',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  templateUrl: './streaming-window.component.html',
  styleUrl: './streaming-window.component.css'
})
export class StreamingWindowComponent {

  constructor(private renderer: Renderer2, private elementRef: ElementRef) { }

  @Input() webRTCHandler: WebRTCHandler | null = null;
  @Input() dataChannelLabel: WebRTCDataChannelLabel | null = null;

  videoStreamingDataChannelLabels: Map<string, WebRTCDataChannelLabel> = new Map<string, WebRTCDataChannelLabel>();
  audioStreamingDataChannelLabels: Map<string, WebRTCDataChannelLabel> = new Map<string, WebRTCDataChannelLabel>();

  toChannelName: string = '';

  // audio & video streaming
  @Input() isVideoVisible: boolean = false;
  @Input() isAudioVisible: boolean = false;

  isVideoStreamingOn: boolean = false;
  isAudioStreamingOn: boolean = false;

  localStream: any = null;
  remoteStream: any = null;

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
  public async handleVideoStreaming(isVisible: boolean) {
    console.log('StreamingComponent: Starting video streaming');

    if (isVisible && this.isVideoStreamingOn) {
      return;
    }

    if (!isVisible && this.isVideoStreamingOn) {
      this.StopStreaming();
      return;
    }

    console.log('StreamingComponent: video visible: ', isVisible);

    if (isVisible) {
      console.log('Streaming Component: Starting video streaming');

      this.setToChannelName();

      // check if the video streaming interface is setup
      const dataChannelName = this.webRTCHandler!.GetDataChannelName(WebRTCDataChannelType.P2P, WebRTCDataChannelStreamType.VIDEO, this.dataChannelLabel!.tenantId!, this.dataChannelLabel!.fromChannel!, this.dataChannelLabel!.toChannel!);

      var videoStreamingDataChannelLabel = this.videoStreamingDataChannelLabels.get(dataChannelName!);
      if (videoStreamingDataChannelLabel === null || videoStreamingDataChannelLabel === undefined) {
        videoStreamingDataChannelLabel = await this.webRTCHandler?.ConnectDataChannel(WebRTCDataChannelType.P2P, this.dataChannelLabel!.tenantId!, this.dataChannelLabel!.fromChannel!, this.dataChannelLabel!.toChannel!, WebRTCDataChannelStreamType.VIDEO) || undefined;
        if (videoStreamingDataChannelLabel === null) {
          console.error('Video streaming data channel not created');
          return;
        }

        this.videoStreamingDataChannelLabels.set(dataChannelName!, videoStreamingDataChannelLabel!);
      }
      else
        console.log('HandleVIdeoStreaming: found datachannel label: ');

      console.log('HandleVIdeoStreaming: datachannel label: ', videoStreamingDataChannelLabel);

      // get the local & remote video elements
      let localVideoElement = this.createElement('video', '.local-video-streaming-window', 'localVideo', 'local-video-streaming') as HTMLVideoElement;
      let remoteVideoElement = this.createElement('video', '.remote-video-streaming-window', 'remoteVideo', 'remote-video-streaming') as HTMLVideoElement;

      if (localVideoElement === null || remoteVideoElement === null) {
        console.error('Video elements not found');
        return;
      }

      this.webRTCHandler!.SetMediaStreamReceiveCallback(videoStreamingDataChannelLabel!, this.setStream.bind(this));

      var strm = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      localVideoElement.srcObject = strm;
      this.localStream = strm;

      let peerConnection: RTCPeerConnection | null;
      peerConnection = await this.webRTCHandler?.StartVideoStreaming(videoStreamingDataChannelLabel!, strm) as RTCPeerConnection | null;

      if (peerConnection !== null && peerConnection !== undefined) {
        console.log('CallWindowVideo useEffect peerConnection', peerConnection);

        this.isVideoStreamingOn = true;
        console.log('Video streaming setup completed');
      }
      else {
        console.error('Peer connection not established');
        return;
      }
    }
  }

  /*   async handleAudioStreaming(isVisible: boolean) {
      console.log('Starting audio streaming');
  
      if (isVisible && this.isAudioStreamingOn) {
        return;
      }
  
      if (!isVisible && this.isAudioStreamingOn) {
        this.StopStreaming();
        return;
      }
  
      this.setToChannelName();
  
      if (isVisible) {
        console.log('Streaming Component: Starting video streaming');
  
        // just in case any audio element is already streaming
        this.StopStreaming();
  
        // just in case any video element is already streaming
        this.StopStreaming();
  
        const dataChannelName = this.webRTCHandler!.GetDataChannelName(WebRTCDataChannelType.P2P, WebRTCDataChannelStreamType.VIDEO, this.dataChannelLabel!.tenantId!, this.dataChannelLabel!.fromChannel!, this.dataChannelLabel!.toChannel!);
  
        // check of the audio streaming interface is setup already
        var audioStreamingDataChannelLabel = this.audioStreamingDataChannelLabels.get(dataChannelName!);
        if (audioStreamingDataChannelLabel === null || audioStreamingDataChannelLabel === undefined) {
          audioStreamingDataChannelLabel = await this.webRTCHandler?.ConnectStreamDataChannel(WebRTCDataChannelType.P2P, WebRTCDataChannelStreamType.AUDIO, this.dataChannelLabel!.tenantId!, this.dataChannelLabel!.fromChannel!, this.dataChannelLabel!.toChannel!) || undefined;
          if (audioStreamingDataChannelLabel === null) {
            console.error('audio streaming data channel not created');
            return;
          }
  
          this.audioStreamingDataChannelLabels.set(dataChannelName!, audioStreamingDataChannelLabel!);
        }
        else
          console.log('HandleAudioStreaming: found datachannel label: ');
  
        console.log('HandleAudioStreaming: datachannel label: ', audioStreamingDataChannelLabel);
  
        // get the local & remote audio elements
        let localAudioElement = this.createElement('audio', '.local-audio-streaming-window', 'localAudio', 'local-audio-streaming');
        let remoteAudioElement = this.createElement('audio', '.remote-audio-streaming-window', 'remoteAudio', 'remote-audio-streaming');
  
        if (localAudioElement === null || remoteAudioElement === null) {
          console.error('audio elements not found');
          return;
        }
  
        if (await this.webRTCHandler?.StartAudioStreaming(audioStreamingDataChannelLabel!, localAudioElement, remoteAudioElement)) {
          localAudioElement.play();
          this.isAudioStreamingOn = true;
          console.log('Audio streaming setup completed');
        }
        else {
          console.error('Audio streaming setup failed');
          this.isVideoStreamingOn = false;
        }
      }
    }
   */

  setStream(stream: any) {
    console.log('callback Setting stream: ', stream);
    if (stream === null || stream === undefined) {
      console.error('Stream is null');
      return;
    }

    let videoElement = this.getElement('.remote-video-streaming') as HTMLVideoElement;
    if (videoElement === null || videoElement === undefined) {
      console.error('Video element not found');
      return;
    }

    videoElement.srcObject = stream;
    this.remoteStream = stream;
    //videoElement.play();
  }

  async StopStreaming() {

    console.log('Stopping streaming');

    if (this.localStream !== null && this.localStream !== undefined) {
      this.localStream.getTracks().forEach((track: any) => {
        track.stop();
      });

      this.localStream = null;
    }

    if (this.remoteStream !== null && this.remoteStream !== undefined) {
      this.remoteStream.getTracks().forEach((track: any) => {
        track.stop();
      });

      this.remoteStream = null;
    }

    if (this.isVideoStreamingOn) {
      console.log('Stopping video streaming');

      await this.webRTCHandler?.StopVideoStreaming();

      this.removeElement('.local-video-streaming');
      this.removeElement('.remote-video-streaming');

      this.isVideoStreamingOn = false;
    }
    else if (this.isAudioStreamingOn) {
      console.log('Stopping audio streaming');

      await this.webRTCHandler?.StopAudioStreaming();

      this.removeElement('.local-audio-streaming');
      this.removeElement('.remote-audio-streaming');

      this.isAudioStreamingOn = false;
    }
    else {
      console.error('No streaming to stop');
    }
  }

  createElement(elementType: string, parentSelector: string, id: string, className: string): any {
    let element = this.renderer.createElement(elementType);
    this.renderer.setProperty(element, 'id', id);
    this.renderer.setAttribute(element, 'class', className);
    this.renderer.setAttribute(element, 'autoplay', 'true');
    this.renderer.setAttribute(element, 'controls', 'true');

    console.log('createelement: element: ', element);

    this.renderer.setStyle(element, 'display', 'block');

    const parentElement = this.elementRef.nativeElement.querySelector(parentSelector);
    // append the video element to the parent
    this.renderer.appendChild(parentElement, element);

    console.log('createelement: parent: ', parent);

    return element;
  }


  removeElement(elementId: string) {
    let element = this.elementRef.nativeElement.querySelector(elementId);
    if (element === null || element === undefined) {
      console.log('Element not found');
      return;
    }

    this.renderer.removeChild(element.parentNode, element);
  }

  getElement(elementId: string) {
    return this.elementRef.nativeElement.querySelector(elementId);
  }
}
