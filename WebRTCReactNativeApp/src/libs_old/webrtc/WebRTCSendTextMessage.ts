import WebRTCCallServiceFacade from './core/WebRTCCallServiceFacade';
import { ChannelMessage } from '../../models/ChannelMessage';

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

    if (callServiceFacade.IsConnected() === false) {
      console.error('Call service facade not connected');
      return null;
    }

    callServiceFacade.SendMessage(newChatMessage);
    console.log('---------------> Sent message in Component:', newChatMessage);

    const msg: ChannelMessage = { type: 'text', channelmessage: newChatMessage, timestamp: new Date().toLocaleTimeString(), direction: 'out' };

    return msg;
  }
}

export default WebRTCSendTextMessage;