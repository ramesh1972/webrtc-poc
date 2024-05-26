import { Component, Input, ViewChild, Output, EventEmitter } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, retry } from 'rxjs';
import { Renderer2, ElementRef } from '@angular/core';
import { AfterViewInit } from '@angular/core';

import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faVideo } from '@fortawesome/free-solid-svg-icons';
import { faMicrophone } from '@fortawesome/free-solid-svg-icons';
import { faStop } from '@fortawesome/free-solid-svg-icons';
import { faCamera } from '@fortawesome/free-solid-svg-icons';

import { Channel } from '../../services/models/Channel';
import { ChannelMessage } from '../../services/models/ChannelMessage';

import { WebRTCSendTextMessage } from '../../services/WebRTCSendTextMessage';
import { WebRTCSendVideoMessage } from '../../services/WebRTCSendVideoMessage';
import { WebRTCSendAudioMessage } from '../../services/WebRTCSendAudioMessage';
import WebRTCCallServiceFacade  from '../../services/core/WebRTCCallServiceFacade';

@Component({
  selector: 'app-chat-message-window',
  standalone: true,
  imports: [FormsModule, CommonModule, FontAwesomeModule],
  templateUrl: './chat-message-window.component.html',
  styleUrl: './chat-message-window.component.css'
})
export class ChatMessageWindowComponent {

  sendTextMessageHandler: WebRTCSendTextMessage | null = null;
  sendVideoMessageHandler: WebRTCSendVideoMessage | null = null;
  sendAudioMessageHandler: WebRTCSendAudioMessage | null = null;

  @Input() myChannel: any;
  @Input() toChannel: any;

  @Input() chatMessages: ChannelMessage[] = [];
  @Input() callServiceFacade: WebRTCCallServiceFacade | null | undefined;

  @Output() addMessageToCollection = new EventEmitter<any>();

  toChannelId: number = -1;
  cuurentChannelId: string = '';

  faPhone = faMicrophone;
  faVideo = faVideo;
  faStop = faStop;
  faCamera = faCamera;

  // audio & video messaging
  isVideoMessage: boolean = false;
  isAudioMessage: boolean = false;
  isTextMessage: boolean = true;
  isVideoRecordingOn: boolean = false;
  isAudioRecordingOn: boolean = false;

  isVideoInputVisible: boolean = false;
  isAudioInputVisible: boolean = false;

  newChatMessage: string = '';

  recordingURL: string = '';

  // audio & video streaming
  isVideoStreamingOn: boolean = false;
  isAudioStreamingOn: boolean = false;

  // image capture
  isImageCaptureVisible: boolean = false;

  constructor(private cdr: ChangeDetectorRef, private renderer: Renderer2, private el: ElementRef) {
    // Initialize callServiceFacade here if needed
    this.cdr = cdr;
  }

  ngOnInit() {
    this.toChannelId = this.toChannel.id;
  }

  setMessageHandlers(callServiceFacade: WebRTCCallServiceFacade) {
    console.log('Setting message handlers');

    this.callServiceFacade = callServiceFacade;
    this.sendTextMessageHandler = new WebRTCSendTextMessage(callServiceFacade);
    this.sendVideoMessageHandler = new WebRTCSendVideoMessage(callServiceFacade);
    this.sendAudioMessageHandler = new WebRTCSendAudioMessage(callServiceFacade);

    this.cuurentChannelId = this.callServiceFacade?.GetChannelId()!;
  }

  public async handlVideoMessaging() {
    this.isVideoMessage = true;
    this.isAudioMessage = false;

    this.isVideoInputVisible = true;
    this.isAudioInputVisible = false;

    if (this.isVideoRecordingOn) {

      console.log('Stopping video messaging');
      let url = await this.sendVideoMessageHandler?.StopVideo().then((url) => {
        this.recordingURL = url;
      });

/*       let videoElement = this.el.nativeElement.querySelector('.send-video-input') as HTMLVideoElement;
      if (videoElement)
        this.renderer.removeChild(this.el.nativeElement, videoElement);
 */    }

    console.log('Starting video messaging');

    this.isVideoMessage = true;
    this.isAudioMessage = false;
    this.isVideoRecordingOn = true;
    this.isAudioRecordingOn = false;
    this.recordingURL = '';

    let videoElement = document.getElementById('sendVideoElement') as HTMLVideoElement;
    if (videoElement === null || videoElement === undefined) {
      console.error('Video element not found');
      return;
    }

    let mediaStream = (videoElement as any).captureStream() as MediaStream;
    await this.sendVideoMessageHandler?.StartVideoMessaging(videoElement);
    videoElement.pause();
  }

    // -------------------------------------------------------------------------------------
    // audio & video messaging
    public async handleAudioMessaging() {
      this.isVideoMessage = false;
      this.isAudioMessage = true;

      this.isAudioInputVisible = true;
      this.isVideoInputVisible = false;


      if (this.isAudioRecordingOn) {
        console.log('Stopping audio messaging');
        let url = await this.sendAudioMessageHandler?.StopAudio().then((url) => {
          this.recordingURL = url;
        });

        let audioElement = this.el.nativeElement.querySelector('.send-audio-input') as HTMLAudioElement;
        if (audioElement)
          this.renderer.removeChild(this.el.nativeElement, audioElement);
      }

      console.log('Starting audio messaging');


      this.isVideoMessage = false;
      this.isAudioMessage = true;
      this.isVideoRecordingOn = false;
      this.isAudioRecordingOn = true;
      this.recordingURL = '';

      let audioElement = document.getElementById('sendAudioElement') as HTMLAudioElement;
      if (audioElement === null || audioElement === undefined) {
        console.error('Audio element not found');
        return;
      }

      this.sendAudioMessageHandler?.StartAudioMessaging(audioElement);
    }

    async SendMessage() {
      let sentMsg: ChannelMessage | null | undefined = undefined;

      if (this.isTextMessage === false && this.isVideoMessage === false && this.isAudioMessage === false)
        return;

      this.isVideoInputVisible = false;
      this.isAudioInputVisible = false;

      console.log('-------------> Sending message:');

      // if video
      if (this.isVideoMessage) {
        console.log('----------------> Sending video message');
        sentMsg = await this.sendVideoMessageHandler?.SendVideoMessage();
        console.log('----------------> Sent video message', sentMsg?.channelmessage);

        if (sentMsg != null) {
          this.chatMessages.push(sentMsg!);
          this.cdr.detectChanges();
        }
      }
      else if (this.isAudioMessage) { // if audio
        console.log('----------------> Sending audio message');
        sentMsg = await this.sendAudioMessageHandler?.SendAudioMessage(); // Await the promise

        this.chatMessages.push(sentMsg!);
        this.cdr.detectChanges();
      }

      // if there was a video or audio message add it to the global message collection
      if (sentMsg != null)
        this.addMessageToCollection.emit({ channelId: this.callServiceFacade?.GetChannelId(), message: sentMsg });

      // if there was a text message add it to the global message collection
      const newTextMessage = this.newChatMessage.trim();
      if (newTextMessage !== null && newTextMessage !== undefined && newTextMessage !== '') {
        sentMsg = await this.sendTextMessageHandler?.SendMessage(newTextMessage);

        if (sentMsg != null) {
          this.chatMessages.push(sentMsg);
          this.cdr.detectChanges();
        }

        this.isAudioMessage = false;
        this.isVideoMessage = false;
        this.newChatMessage = '';
      }
    }

    // -------------------------------------------------------------------------------------
    // audio & video streaming
    public async handleVideoStreaming() {
      console.log('Starting video streaming');
      this.isAudioStreamingOn = false;

      if (this.isVideoStreamingOn)
        this.isVideoStreamingOn = false;
      else
        this.isVideoStreamingOn = true;

      // get the local & remote video elements
      let localVideoElement = document.getElementById('localVideo') as HTMLVideoElement;
      let remoteVideoElement = document.getElementById('remoteVideo') as HTMLVideoElement;

      if (localVideoElement === null || remoteVideoElement === null) {
        console.error('Video elements not found');
        return;
      }

      await this.callServiceFacade?.StartVideoStreaming(localVideoElement, remoteVideoElement);

      console.log('Video streaming setup completed');
    }

    handleAudioStreaming() {
      console.log('Starting audio streaming');
      this.isVideoStreamingOn = false;

      if (this.isAudioStreamingOn)
        this.isAudioStreamingOn = false;
      else
        this.isAudioStreamingOn = true;

      // get the local & remote Audio elements
      let localAudioElement = document.getElementById('localAudio') as HTMLAudioElement;
      let remoteAudioElement = document.getElementById('remoteAudio') as HTMLAudioElement;

      if (localAudioElement === null || remoteAudioElement === null) {
        console.error('Audio elements not found');
        return;
      }

      this.callServiceFacade?.StartAudioStreaming(localAudioElement, remoteAudioElement);
    }

  // -------------------------------------------------------------------------------------
  // image capture
  handleImageCaptureMessaging() {
    this.isImageCaptureVisible = true;
    this.isAudioInputVisible = false;
    this.isVideoInputVisible = false;

    console.log('Starting image capture');

    //this.callServiceFacade?.StartImageCapture();

    const constraints = {
      audio: false,
      video: true
    };

    navigator.mediaDevices.getUserMedia(constraints).then(this.handleSuccess).catch(this.handleError);
  }

  captureImage() {
    const video = document.querySelector('.send-video-capture-input') as HTMLVideoElement;

    let canvas = document.querySelector('canvas');
    canvas!.getContext('2d')!.drawImage(video, 0, 0, canvas!.width, canvas!.height);

    // Capture the canvas as an image
    let imageData = canvas!.toDataURL('image/png');

  }

  handleSuccess(stream: any) {
    //window.stream = stream; // make stream available to browser console
    const video = document.querySelector('.send-video-capture-input') as HTMLVideoElement;
    video!.srcObject = stream;
  }

  handleError(error: any) {
    console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
  }
}
