import WebRTCCallServiceFacade from './core/WebRTCCallServiceFacade';

import { WebRTCDataChannelLabel } from './models/DataChannelLabel';
import { ChannelMessage, ChannelMessageType } from './models/ChannelMessage';

class WebRTCSendVideoMessage {

  webRTCCallServiceFacade: WebRTCCallServiceFacade | null | undefined = null;
  isVideoRecordingOn: boolean = false;
  recordingURL: string = '';

  constructor(webRTCCallServiceFacade: WebRTCCallServiceFacade) {
    this.webRTCCallServiceFacade = webRTCCallServiceFacade;
  }

  // video messaging public interface
  public async StartVideoMessaging(videoElement: any) {
    if (videoElement === null || videoElement === undefined) {
      console.error('Video element not found');
      return;
    }

    let callServiceFacade = this.webRTCCallServiceFacade;
    if (callServiceFacade === null || callServiceFacade === undefined) {
      console.error('Call service facade not found');
      return;
    }


    this.isVideoRecordingOn = true;
    this.recordingURL = '';

    await callServiceFacade.StartVideoMessaging(videoElement);
  }

  public async StopVideo(): Promise<string> {
    let callServiceFacade = this.webRTCCallServiceFacade;
    if (callServiceFacade === null || callServiceFacade === undefined) {
      console.error('Call service facade not found');
      return '';
    }

    console.log('Stopping video');
    let url = await callServiceFacade.StopVideo();
    this.isVideoRecordingOn = false;
    console.log('-----------> Video stopped : URL' + url);
    return url;
  }

  public async SendVideoMessage() {
    console.log('-------------> Sending message:');

    let callServiceFacade = this.webRTCCallServiceFacade;
    if (callServiceFacade === null || callServiceFacade === undefined) {
      console.error('Call service facade not found');
      return;
    }

    console.log('-------------> isVideoRecordingOn:', this.isVideoRecordingOn);
    if (this.isVideoRecordingOn) {
      console.log('----------> Stopping video recording');

      await this.StopVideo().then((url) => {
        this.recordingURL = url;
      });

      this.isVideoRecordingOn = false;
      console.log('Video recording stopped : url: ' + this.recordingURL);
    }

    console.log('----------------> Sending video message');
    let URL: string = await callServiceFacade.SendVideo();
    console.log('----------------> Sent video message URL', URL);

    const dataChannel: WebRTCDataChannelLabel | null = callServiceFacade.GetChannel();
    const msg: ChannelMessage = { type: ChannelMessageType.Video, dataChannel: dataChannel!, channelmessage: URL, timestamp: new Date().toLocaleTimeString(), direction: 'out' };
    return msg;
  }
}

export default WebRTCSendVideoMessage;