import WebRTCCallServiceFacade from './core/WebRTCCallServiceFacade';
import { WebRTCDataChannelLabel } from './models/DataChannelLabel';

// internal class to start/stop a video stream to a WebRTC connection
// use WebRTCHandler to start/stop a video stream that in turn uses this object to start/stop a video stream
export default class WebRTCVideoStreaming {

  webRTCCallServiceFacade: WebRTCCallServiceFacade | null | undefined = null;
  isVIdeoStreamingOn: boolean = false;
  recordingURL: string = '';

  constructor(webRTCCallServiceFacade: WebRTCCallServiceFacade) {
    this.webRTCCallServiceFacade = webRTCCallServiceFacade;
  }

  async StartVideoStreaming() {
    if (this.webRTCCallServiceFacade === null || this.webRTCCallServiceFacade === undefined) {
      console.error('Call service facade not initialized');
      return false;
    }

    return await this.webRTCCallServiceFacade.StartVideoStreaming();
  }

  public StopStreaming() {
    if (this.webRTCCallServiceFacade === null) {
      console.log('WARN: Call service not initialized');
      return true;
    }

    console.log('StopStreaming: disconnecting');

    return this.webRTCCallServiceFacade?.disconnect();
  }
}
