import WebRTCCallServiceFacade from './core/WebRTCCallServiceFacade';

export class WebRTCAudioStreaming {

  webRTCCallServiceFacade: WebRTCCallServiceFacade | null | undefined = null;
  isAudioStreamingOn: boolean = false;
  recordingURL: string = '';

  constructor(webRTCCallServiceFacade: WebRTCCallServiceFacade) {
    this.webRTCCallServiceFacade = webRTCCallServiceFacade;
  }

  async StartAudioStreaming(localAudioElement: HTMLAudioElement, remoteAudioElement: HTMLAudioElement) {
    if (this.webRTCCallServiceFacade === null || this.webRTCCallServiceFacade == undefined) {
      console.error('Call service not initialized');
      return;
    }

    if (localAudioElement === null || remoteAudioElement === null) {
      console.error('Audio elements not found');
      return;
    }

    await this.webRTCCallServiceFacade.StartAudioStreaming(localAudioElement, remoteAudioElement);
    console.log(`----------------> Audio call setup successfully`);
  }

  public async StopStreaming() {
    if (this.webRTCCallServiceFacade === null) {
      console.error('Call service not initialized');
      return;
    }

    this.webRTCCallServiceFacade?.StopStreaming();
  }
}
