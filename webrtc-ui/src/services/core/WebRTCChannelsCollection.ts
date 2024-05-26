import { ChangeDetectorRef } from '@angular/core';
import WebRTCCallServiceFacade from './WebRTCCallServiceFacade';

export class WebRTCChannelsCollection {
    // coolection of WebRTC Connections currently active on this browser
    // Typically one connection for each channel or peer
    callServiceFacades: Map<string, WebRTCCallServiceFacade> = new Map<string, WebRTCCallServiceFacade>();

    // callbacks
    receiveChannelMessageCallback: (channelName: string, type: string, message: string) => void = () => { };

    constructor(private cdr: ChangeDetectorRef, callback: (channelName: string, type: string, message: string) => void) {
        this.receiveChannelMessageCallback = callback;
    }

    // entry point
    public async Connect(fromChannelId: number, toChannelId: number): Promise<WebRTCCallServiceFacade | null | undefined> {

        // *********** create the data channel id ***********
        let dataChannelId = this.createDataChannelId(fromChannelId, toChannelId);

        // *********** create the facade ***********
        this.createFacade(dataChannelId);

        let callServiceFacade = this.callServiceFacades.get(dataChannelId);
        if (callServiceFacade === null || callServiceFacade === undefined) {
            console.error('Call service facade not found');
            return null;
        }

        if (callServiceFacade.IsConnected() === true) {
            console.log('-----------------> Already Connected to WebRTCCallServiceFacade', dataChannelId);
            return callServiceFacade;
        } else {
            // *********** make the connection ***********
            await callServiceFacade.connect(dataChannelId);

            if (callServiceFacade.IsConnected() === true) {
                console.log('------------------->  Connected to Data Channel:', dataChannelId);
                return callServiceFacade;
            } else {
                console.error('Failed to connect to Data Channel', dataChannelId);
                return null;
            }
        }
    }

    private createDataChannelId(fromChannelId: number, toChannelId: number): string {
        let firstId = fromChannelId <= toChannelId ? fromChannelId : toChannelId
        let secondId = firstId === toChannelId ? fromChannelId : toChannelId;

        let cuurentChannelId = "tenant-1-" + "usr-" + firstId + "-" + "usr-" + secondId;

        console.log("Created datachannel id string", cuurentChannelId);

        return cuurentChannelId;
    }

    private createFacade(dataChannelId: string) {
        let callServiceFacade = this.callServiceFacades.get(dataChannelId);

        if (callServiceFacade === null || callServiceFacade === undefined) {
            console.log('-----> Creating facade for channel:', dataChannelId);

            callServiceFacade = new WebRTCCallServiceFacade(this.cdr, this.onReceiveMessage.bind(this));

            this.callServiceFacades.set(dataChannelId, callServiceFacade);
        }
    }

    // ---------------------------------------------------------------------------------------------
    private onReceiveMessage(channelName: string, type: string, message: string): void {
        message = message.trim();
        console.log('--------------> Received message in component:', message);
        console.log('--------------> Received message type in component:', type);

        this.receiveChannelMessageCallback(channelName, type, message);
    }

    // get the call service facade for the given from and to peers
    public GetCallServiceFacade(fromChannelId: number, toChannelId: number): WebRTCCallServiceFacade | null | undefined {
        let dataChannelId = this.createDataChannelId(fromChannelId, toChannelId);

        if (this.callServiceFacades.has(dataChannelId) === false) {
            console.error('Call service facade not found');
            return null;
        }

        return this.callServiceFacades.get(dataChannelId);
    }
}