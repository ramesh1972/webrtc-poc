import WebRTCCallServiceFacade from './core/WebRTCCallServiceFacade';
import { WebRTCDataChannelLabel } from './models/DataChannelLabel';

export class WebRTCVideoStreaming {

  webRTCCallServiceFacade: WebRTCCallServiceFacade | null | undefined = null;
  isVIdeoStreamingOn: boolean = false;
  recordingURL: string = '';

  constructor(webRTCCallServiceFacade: WebRTCCallServiceFacade) {
    this.webRTCCallServiceFacade = webRTCCallServiceFacade;
  }

  async StartVideoStreaming(localStreamObj: any) {
    if (this.webRTCCallServiceFacade === null || this.webRTCCallServiceFacade === undefined) {
      console.error('Call service not initialized');
      return false;
    }

    return await this.webRTCCallServiceFacade.StartVideoStreaming(localStreamObj);
  }

  public async StopStreaming() {
    if (this.webRTCCallServiceFacade === null) {
      console.error('Call service not initialized');
      return false;
    }

    return this.webRTCCallServiceFacade?.disconnect();
  }
}
