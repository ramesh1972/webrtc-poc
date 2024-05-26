import WebRTCCallServiceFacade from './core/WebRTCCallServiceFacade';
import { WebRTCDataChannelLabel } from './models/DataChannelLabel';

export class WebRTCVideoStreaming {

  webRTCCallServiceFacade: WebRTCCallServiceFacade | null | undefined = null;
  isVIdeoStreamingOn: boolean = false;
  recordingURL: string = '';

  constructor(webRTCCallServiceFacade: WebRTCCallServiceFacade) {
    this.webRTCCallServiceFacade = webRTCCallServiceFacade;
  }

  async StartVideoStreaming(dataChannel: WebRTCDataChannelLabel, localVideoElement: any, remoteVideoElement: any) {
    if (this.webRTCCallServiceFacade === null || this.webRTCCallServiceFacade == undefined) {
      console.error('Call service not initialized');
      return;
    }

    if (localVideoElement === null || remoteVideoElement === null) {
      console.error('Video elements not found');
      return;
    }

    await this.webRTCCallServiceFacade.StartVideoStreaming(dataChannel, localVideoElement, remoteVideoElement);
    console.log(`----------------> video call setup successfully`);
  }

  public async StopStreaming() {
    if (this.webRTCCallServiceFacade === null) {
      console.error('Call service not initialized');
      return;
    }

    await this.webRTCCallServiceFacade?.StopStreaming();
  }
}
