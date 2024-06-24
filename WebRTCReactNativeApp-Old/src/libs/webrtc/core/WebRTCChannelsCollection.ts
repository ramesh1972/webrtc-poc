import WebRTCCallServiceFacade from './WebRTCCallServiceFacade';

import colabLog from '../utils/colabLog';

import { WebRTCDataChannelLabel, WebRTCDataChannelType, WebRTCDataChannelStreamType } from '../models/DataChannelLabel';
import { ChannelMessage } from '../models/ChannelMessage';

// this class maintains a collection of WebRTC connections.
// each connection is identified by a unique data channel name and represents
//          - a connection between current user and colleague user
//          - a connection between current user and a group
//          - a connection between current user and a temporary group of users
// each connection is represented by a WebRTCCallServiceFacade object that manages the connection via its unique WebRTCCallService object
// this class also manages the store of messages sent & received on each connection
export class WebRTCChannelsCollection {
    // coolection of WebRTC Connections currently active on this browser
    // Typically one connection for each channel or peer
    private callServiceFacades: Map<string, WebRTCCallServiceFacade> = new Map<string, WebRTCCallServiceFacade>();

    // callbacks
    receiveChannelMessageCallback: (channelmessage: ChannelMessage) => void = () => { };
    receiveSystemCommandCallback: (channelmessage: ChannelMessage) => void = () => { };

    constructor(messagecallback: (channelmessage: ChannelMessage) => void, commandcallback: (channelmessage: ChannelMessage) => void) {
        this.receiveChannelMessageCallback = messagecallback;
        this.receiveSystemCommandCallback = commandcallback;
    }

    // --------------------------------------------------------------------------------------------
    // entry point to create a new connection or use an existing connection, i.e. callServiceFacade object
    public async Connect(socket: any, dataChannelLabel: WebRTCDataChannelLabel) {
        if (dataChannelLabel === null || dataChannelLabel === undefined) {
            console.error('Connect: Invalid data channel label');
            return null;
        }

        if (dataChannelLabel.dataChannelName === null || dataChannelLabel.dataChannelName === undefined || dataChannelLabel.dataChannelName === '') {
            console.error('Connect: Invalid data channel name');
            return null;
        }

        // *********** create the facade ***********
        const callServiceFacade = this.createCallServiceFacade(socket, dataChannelLabel);

        if (callServiceFacade === null || callServiceFacade === undefined) {
            console.error('Call service facade not created');
            return null;
        }

        if (callServiceFacade.IsConnected() === true) {
            colabLog(dataChannelLabel, 'Connect: Already Connected to WebRTCCallServiceFacade', dataChannelLabel.dataChannelName);
            return callServiceFacade;
        }
        else if (dataChannelLabel.streamType === WebRTCDataChannelStreamType.AUDIO || dataChannelLabel.streamType === WebRTCDataChannelStreamType.VIDEO) {
             colabLog('Connect: P2P channel with strema wil connect later when video/audio elements are created in the UI');
             
             return callServiceFacade;
        }
        else {
            // *********** make the connection ***********
            await callServiceFacade.connect().then((result) => {
                if (result === true) {
                    colabLog(dataChannelLabel, 'Connect: Connected to WebRTCCallServiceFacade', dataChannelLabel.dataChannelName);
                }
                else {
                    console.error('Connect: Failed to connect to WebRTCCallServiceFacade', dataChannelLabel.dataChannelName);
                    return null;
                }
            });
        }

        return callServiceFacade;
    }

    public async Init(isInitiator:boolean, datachannel: WebRTCDataChannelLabel, localStreamObj?: any) {
        if (datachannel === null || datachannel === undefined) {
            console.error('Init: Invalid data channel label');
            return null;
        }

        if (datachannel.dataChannelName === null || datachannel.dataChannelName === undefined || datachannel.dataChannelName === '') {
            console.error('Init: Invalid data channel name');
            return null;
        }

        const callServiceFacade = this.callServiceFacades.get(datachannel.dataChannelName);

        if (callServiceFacade === null || callServiceFacade === undefined) {
            console.error('Call service facade not created');
            return null;
        }

        return await callServiceFacade.init(isInitiator, localStreamObj);
    }

    private createCallServiceFacade(socket: any, dataChannelLabel: WebRTCDataChannelLabel) {
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
            colabLog(dataChannelLabel, 'createFacade: Creating facade for channel:', dataChannelLabel.dataChannelName);

            callServiceFacade = new WebRTCCallServiceFacade(socket, dataChannelLabel, this.onReceiveMessage.bind(this), this.onReceiveSystemCommand.bind(this));

            colabLog(dataChannelLabel, 'createFacade: Call service facade created for channel:');

            this.callServiceFacades.set(dataChannelLabel.dataChannelName, callServiceFacade);
        }

        return callServiceFacade;
    }

    public removeFacade(dataChannelLabel: WebRTCDataChannelLabel) {
        if (dataChannelLabel === null || dataChannelLabel === undefined) {
            console.error('removeFacade: Invalid data channel label');
            return;
        }

        if (dataChannelLabel.dataChannelName === null || dataChannelLabel.dataChannelName === undefined || dataChannelLabel.dataChannelName === '') {
            console.error('removeFacade: Invalid data channel name');
            return;
        }

        if (this.callServiceFacades.has(dataChannelLabel.dataChannelName) === false) {
            colabLog(dataChannelLabel, 'removeFacade: Call service facade not found');
            return;
        }

        const callServiceFacade = this.callServiceFacades.get(dataChannelLabel.dataChannelName);
        colabLog(dataChannelLabel, 'removeFacade: removing:', dataChannelLabel.dataChannelName);

        // gracefully disconnect before delete
        if (callServiceFacade !== null && callServiceFacade.GetCallService() !== null) {
            if (!callServiceFacade!.disconnect())
                console.log('WARN: removeFacade: Call service facade failed to disconnect:', dataChannelLabel.dataChannelName);
            else
                colabLog('removeFacade: Call service facade removed:', dataChannelLabel.dataChannelName);
        }

        this.callServiceFacades.delete(dataChannelLabel.dataChannelName);
    }

    // get the call service facade for the given from and to peers
    public GetCallServiceFacade(dataChannelLabel: WebRTCDataChannelLabel) {
        if (dataChannelLabel === null || dataChannelLabel === undefined) {
            console.error('GetCallServiceFacade: Invalid data channel label');
            return null;
        }

        console.debug('GetCallServiceFacade: Looking for:', dataChannelLabel.dataChannelName);
        if (dataChannelLabel.dataChannelName === null || dataChannelLabel.dataChannelName === undefined || dataChannelLabel.dataChannelName === '') {
            console.error('GetCallServiceFacade: : Invalid data channel name');
            return null;
        }

        if (this.callServiceFacades.has(dataChannelLabel.dataChannelName) === false) {
            colabLog(dataChannelLabel, 'GetCallServiceFacade: Call service facade not found');
            return null;
        }

        const callServiceFacade = this.callServiceFacades.get(dataChannelLabel.dataChannelName);
        colabLog('GetCallServiceFacade: found:', dataChannelLabel.dataChannelName);

        return callServiceFacade;
    }
    // --------------------------------------------------------------------------------------------

    // ---------------------------------------------------------------------------------------------
    // receive messages from the peer
    private onReceiveMessage(channelMessage: ChannelMessage): void {
        if (channelMessage === null || channelMessage === undefined) {
            console.error('WebRTCChannelsCollection: channelMessage is null');
            return;
        }

        const message = channelMessage.channelmessage.trim();
        colabLog(channelMessage.dataChannel, '--------------> Received message in webRTCCollection:', message);
        colabLog(channelMessage.dataChannel, '--------------> Received message type in webRTCCollection:', channelMessage.type);

        this.receiveChannelMessageCallback(channelMessage);
    }

    private onReceiveSystemCommand(channelCommand: ChannelMessage): void {
        if (channelCommand === null || channelCommand === undefined) {
            console.error('WebRTCChannelsCollection: channelCommand is null');
            return;
        }

        colabLog(channelCommand.dataChannel, '--------------> Received System COmmand in webRTCCollection:', channelCommand.channelmessage);

        this.receiveSystemCommandCallback(channelCommand);
    }
    // ---------------------------------------------------------------------------------------------
}   