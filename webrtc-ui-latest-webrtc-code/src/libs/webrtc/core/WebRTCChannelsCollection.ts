import WebRTCCallServiceFacade from './WebRTCCallServiceFacade';

import { WebRTCDataChannelLabel, WebRTCDataChannelType } from '../models/DataChannelLabel';
import { ChannelMessage } from '../models/ChannelMessage';
import { ChannelType } from '../models/Channel';

export class WebRTCChannelsCollection {
    // coolection of WebRTC Connections currently active on this browser
    // Typically one connection for each channel or peer
    private callServiceFacades: Map<string, WebRTCCallServiceFacade> = new Map<string, WebRTCCallServiceFacade>();

    // callbacks
    receiveChannelMessageCallback: (channelmessage: ChannelMessage) => void = () => { };
    receiveSystemCommandCallback: (channelmessage: ChannelMessage) => void = () => { };

    constructor(messagecallback: (channelmessage: ChannelMessage)=> void, commandcallback: (channelmessage: ChannelMessage) => void) {
        this.receiveChannelMessageCallback = messagecallback;
        this.receiveSystemCommandCallback = commandcallback;
    }

    // entry point
    public async Connect(dataChannelLabel: WebRTCDataChannelLabel) {
        if (dataChannelLabel === null || dataChannelLabel === undefined) {
            console.error('Connect: Invalid data channel label');
            return null;
        }

        if (dataChannelLabel.dataChannelName === null || dataChannelLabel.dataChannelName === undefined || dataChannelLabel.dataChannelName === '') {
            console.error('Connect: Invalid data channel name');
            return null;
        }

        // *********** create the facade ***********
        const callServiceFacade = this.createFacade(dataChannelLabel);

        if (callServiceFacade === null || callServiceFacade === undefined) {
            console.error('Call service facade not created');
            return null;
        }

        if (callServiceFacade.IsConnected() === true) {
            console.log('Connect: Already Connected to WebRTCCallServiceFacade', dataChannelLabel.dataChannelName);
            return callServiceFacade;
        }
        else {
            // *********** make the connection ***********
            await callServiceFacade.connect(dataChannelLabel);

            if (callServiceFacade.IsConnected() === true) {
                console.log('Connect: Connected to Data Channel:', dataChannelLabel.dataChannelName);
                return callServiceFacade;
            } else {
                console.error('Connect: Failed to connect to Data Channel', dataChannelLabel.dataChannelName);
                return null;
            }
        }
    }

    private createFacade(dataChannelLabel: WebRTCDataChannelLabel) {
        if (dataChannelLabel === null || dataChannelLabel === undefined) {
            console.error('createFacade: Invalid data channel label');
            return null;
        }

        if (dataChannelLabel.dataChannelName === null || dataChannelLabel.dataChannelName === undefined || dataChannelLabel.dataChannelName === '') {
            console.error('createFacade: Invalid data channel name');
            return null;
        }

        let callServiceFacade = this.callServiceFacades.get(dataChannelLabel.dataChannelName);

        if (callServiceFacade === null || callServiceFacade === undefined) {
            console.log('createFacade: Creating facade for channel:', dataChannelLabel.dataChannelName);

            callServiceFacade = new WebRTCCallServiceFacade(dataChannelLabel, this.onReceiveMessage.bind(this), this.onReceiveSystemCommand.bind(this) );

            this.callServiceFacades.set(dataChannelLabel.dataChannelName, callServiceFacade);
        }

        console.log('createFacade: Returning facade for channel:', dataChannelLabel.dataChannelName);
        return callServiceFacade;
    }

    // ---------------------------------------------------------------------------------------------
    private onReceiveMessage(channelMessage: ChannelMessage): void {
        if (channelMessage === null || channelMessage === undefined) {
            console.error('WebRTCChannelsCollection: channelMessage is null');
            return;
        }

        const message = channelMessage.channelmessage.trim();
        console.log('--------------> Received message in webRTCCollection:', message);
        console.log('--------------> Received message type in webRTCCollection:', channelMessage.type);

        this.receiveChannelMessageCallback(channelMessage);
    }

    private onReceiveSystemCommand(channelCommand: ChannelMessage): void {
        if (channelCommand === null || channelCommand === undefined) {
            console.error('WebRTCChannelsCollection: channelCommand is null');
            return;
        }

        console.log('--------------> Received System COmmand in webRTCCollection:', channelCommand.channelmessage);

        this.receiveChannelMessageCallback(channelCommand);
    }

    // get the call service facade for the given from and to peers
    public getCallServiceFacade(dataChannelLabel: WebRTCDataChannelLabel) {
        if (dataChannelLabel === null || dataChannelLabel === undefined) {
            console.error('getCallServiceFacade: Invalid data channel label');
            return null;
        }

        if (dataChannelLabel.dataChannelName === null || dataChannelLabel.dataChannelName === undefined || dataChannelLabel.dataChannelName === '') {
            console.error('getCallServiceFacade: : Invalid data channel name');
            return null;
        }

        if (this.callServiceFacades.has(dataChannelLabel.dataChannelName) === false) {
            console.log('getCallServiceFacade: Call service facade not found');
            return null;
        }


        const callServiceFacade = this.callServiceFacades.get(dataChannelLabel.dataChannelName);
        const dataChannel = callServiceFacade?.GetDataChannel();

        if (callServiceFacade !== null || callServiceFacade !== undefined) {
            if (dataChannel?.dataChannelType === WebRTCDataChannelType.P2P && dataChannelLabel?.dataChannelType === WebRTCDataChannelType.P2P) {
                if (dataChannel?.fromChannel?.id === dataChannelLabel.toChannel?.id && dataChannel?.toChannel?.id === dataChannelLabel.fromChannel?.id) {
                    callServiceFacade?.disconnect();
                    this.callServiceFacades.delete(dataChannelLabel.dataChannelName);
                    return null;
                }
            }
        }

        return callServiceFacade;
    }
}