import WebRTCCallServiceFacade from './core/WebRTCCallServiceFacade';

import { WebRTCDataChannelLabel } from './models/DataChannelLabel'
import { ChannelMessage, ChannelMessageType } from './models/ChannelMessage';

// internal class to send a text message to a WebRTC connection
// use WebRTCHandler to send a video message that in turn uses this object to send a text message
class WebRTCSendTextMessage {
  webRTCCallServiceFacade: WebRTCCallServiceFacade;

  constructor(webRTCCallServiceFacade: WebRTCCallServiceFacade) {
    this.webRTCCallServiceFacade = webRTCCallServiceFacade;
  }

  public SendMessage(newChatMessage: string) {
    if (newChatMessage === null || newChatMessage === undefined || newChatMessage === '')
      return null;

    newChatMessage = newChatMessage.trim();

    console.log('-------------> Sending message:', newChatMessage);

    // TODO: wrong, this is old code
    let callServiceFacade = this.webRTCCallServiceFacade;
    if (callServiceFacade === null || callServiceFacade === undefined) {
      console.error('Call service facade not found');
      return null;
    }

    // TODO: check why SendTextMessage is not used
    const isSent = callServiceFacade.SendMessage(newChatMessage);
    if (!isSent) {
      console.log('---------------> Sent message in Component:', newChatMessage);

      const dataChannelLabel = callServiceFacade.GetChannel();
      const msg: ChannelMessage = { type: ChannelMessageType.Text, dataChannel: dataChannelLabel!, channelmessage: newChatMessage, userName: '', timestamp: new Date().toLocaleTimeString(), direction: 'out' };

      return msg;
    }
    else {
      console.error('Failed to send message:', newChatMessage);
      return null;
    }
  }
}

export default WebRTCSendTextMessage;