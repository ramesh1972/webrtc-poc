import WebRTCCallServiceFacade from './core/WebRTCCallServiceFacade';

import { WebRTCDataChannelLabel } from './models/DataChannelLabel'
import { ChannelMessage, ChannelMessageType } from './models/ChannelMessage';

class WebRTCSendTextMessage {
  webRTCCallServiceFacade: WebRTCCallServiceFacade;

  constructor(webRTCCallServiceFacade: WebRTCCallServiceFacade) {
    this.webRTCCallServiceFacade = webRTCCallServiceFacade;
  }

  public async SendMessage(newChatMessage: string) {
    if (newChatMessage === null || newChatMessage === undefined || newChatMessage === '')
      return null;

    newChatMessage = newChatMessage.trim();

    console.log('-------------> Sending message:', newChatMessage);

    let callServiceFacade = this.webRTCCallServiceFacade;
    if (callServiceFacade === null || callServiceFacade === undefined) {
      console.error('Call service facade not found');
      return null;
    }

    callServiceFacade.SendMessage(newChatMessage);
    console.log('---------------> Sent message in Component:', newChatMessage);

    const dataChannelLabel = callServiceFacade.GetChannel();
    const msg: ChannelMessage = { type: ChannelMessageType.Text, dataChannel: dataChannelLabel!, channelmessage: newChatMessage, userName: '', timestamp: new Date().toLocaleTimeString(), direction: 'out' };

    return msg;
  }
}

export default WebRTCSendTextMessage;