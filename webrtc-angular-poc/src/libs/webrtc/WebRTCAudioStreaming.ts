import WebRTCCallServiceFacade from './core/WebRTCCallServiceFacade';
import { WebRTCDataChannelLabel } from './models/DataChannelLabel';

export class WebRTCAudioStreaming {

  webRTCCallServiceFacade: WebRTCCallServiceFacade | null | undefined = null;
  isAudioStreamingOn: boolean = false;
  recordingURL: string = '';

  constructor(webRTCCallServiceFacade: WebRTCCallServiceFacade) {
    this.webRTCCallServiceFacade = webRTCCallServiceFacade;
  }

    async StartAudioStreaming(localStreamObj: any) {
    if (this.webRTCCallServiceFacade === null || this.webRTCCallServiceFacade === undefined) {
      console.error('Call service not initialized');
      return;
    }

    return await this.webRTCCallServiceFacade.StartAudioStreaming(localStreamObj);
  }

  public async StopStreaming() {
    if (this.webRTCCallServiceFacade === null) {
      console.error('Call service not initialized');
      return;
    }

    await this.webRTCCallServiceFacade?.StopStreaming();
  }
}
