import WebRTCCallServiceFacade from './core/WebRTCCallServiceFacade';

import { WebRTCDataChannelLabel } from './models/DataChannelLabel';
import { ChannelMessage, ChannelMessageType } from './models/ChannelMessage';

// internal class to send an audio message to a WebRTC connection
// use WebRTCHandler to send a video message that in turn uses this object to send an audio message
class WebRTCSendAudioMessage {

  webRTCCallServiceFacade: WebRTCCallServiceFacade | null | undefined = null;

  isAudioRecordingOn: boolean = false;
  recordingURL: string = '';

  constructor(webRTCCallServiceFacade: WebRTCCallServiceFacade) {
    this.webRTCCallServiceFacade = webRTCCallServiceFacade;
  }

  public async StartAudioMessaging(audioElement: any) {
    if (audioElement === null || audioElement === undefined) {
      console.error('Audio element not found');
      return;
    }

    let callServiceFacade = this.webRTCCallServiceFacade;
    if (callServiceFacade === null || callServiceFacade === undefined) {
      console.error('Call service facade not found');
      return;
    }

    this.isAudioRecordingOn = true;
    this.recordingURL = '';

    await callServiceFacade.StartAudioMessaging(audioElement);
  }

  public async StopAudio(): Promise<string> {
    let callServiceFacade = this.webRTCCallServiceFacade
    if (callServiceFacade === null || callServiceFacade === undefined) {
      console.error('Call service facade not found');
      return '';
    }

    if (this.isAudioRecordingOn) {
      console.log('Stopping audio messaging');

      let url = await callServiceFacade.StopAudio();
      this.isAudioRecordingOn = false;
      this.recordingURL = url;

      console.log('audio stopped');
      console.log('audio url:', url);

      return url;
    }
    else {
      console.error('Audio is not recording');
      return '';
    }
  }

  public async SendAudioMessage() {
    console.log('-------------> Sending message:');
    let callServiceFacade = this.webRTCCallServiceFacade;
    if (callServiceFacade === null || callServiceFacade === undefined) {
      console.error('Call service facade not found');
      return;
    }

    if (this.isAudioRecordingOn) {
      console.log('-------------> Stopping audio recording');

      await this.StopAudio().then((url) => {
        this.recordingURL = url;
      });

      this.isAudioRecordingOn = false;
      console.log('audio recording stopped : url: ' + this.recordingURL);
    }

    console.log('----------------> Sending audio message');
    let URL: string = await callServiceFacade.SendAudio();

    const dataChannel = callServiceFacade.GetChannel();
    const msg: ChannelMessage = { type: ChannelMessageType.Audio, dataChannel: dataChannel!, channelmessage: URL, timestamp: new Date().toLocaleTimeString(), direction: 'out' };
    return msg;
  }
}

export default WebRTCSendAudioMessage;