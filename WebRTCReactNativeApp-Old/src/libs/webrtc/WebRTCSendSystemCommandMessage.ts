import WebRTCCallServiceFacade from './core/WebRTCCallServiceFacade';

import { SystemCommand } from './models/SystemCommand';

// internal class to send a system command to a WebRTC connection
// use WebRTCHandler to send a system command that in turn uses this object to send a system command
class WebRTCSendSystemCommandMessage {
  webRTCCallServiceFacade: WebRTCCallServiceFacade;

  constructor(webRTCCallServiceFacade: WebRTCCallServiceFacade) {
    this.webRTCCallServiceFacade = webRTCCallServiceFacade;
  }

  public SendSystemCommand(command: SystemCommand) {
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