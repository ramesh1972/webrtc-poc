import WebRTCCallServiceFacade from './core/WebRTCCallServiceFacade';

import { WebRTCDataChannelLabel, WebRTCDataChannelType } from './models/DataChannelLabel'
import { ChannelMessage, ChannelMessageType } from './models/ChannelMessage';
import { SystemCommand } from './models/SystemCommand';

class WebRTCSendSystemCommandMessage {
  webRTCCallServiceFacade: WebRTCCallServiceFacade;

  constructor(webRTCCallServiceFacade: WebRTCCallServiceFacade) {
    this.webRTCCallServiceFacade = webRTCCallServiceFacade;
  }

  public async SendSystemCommand(command: SystemCommand) {
    if (command === null || command === undefined)
      return false;

    console.log('-------------> Sending command:', command);

    let callServiceFacade = this.webRTCCallServiceFacade;
    if (callServiceFacade === null || callServiceFacade === undefined) {
      console.error('Call service facade not found');
      return false;
    }

    if (callServiceFacade.SendSystemCommand(command)) {
      console.log('---------------> Sent message in Component:', command);
      return true;
    }

    return true;
  }
}

export default WebRTCSendSystemCommandMessage;