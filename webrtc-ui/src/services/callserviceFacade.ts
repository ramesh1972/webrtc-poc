import { ChangeDetectorRef } from '@angular/core';
import CallService from './callservice';


class CallServiceFacade {
    private callService: CallService | null = null;
    private signalingURL: string = 'https://webrtc-signal.azurewebsites.net/';

    private connected = false;
    private remoteMessages: Array<string> = new Array<string>();
    private chatChannelId: string = '';
    private cdr: ChangeDetectorRef;
    public from_user: string = '';
    public to_user: string = '';

    private receiveChannelMessageCallback: (channelName: string, message: string) => void = () => { };
    
    constructor(private changeDetectorRef: ChangeDetectorRef, callback: (channelName: string, message: string) => void) {
        this.cdr = changeDetectorRef;
        
        if (this.callService === null || this.callService == undefined) {
            this.callService = new CallService(this.signalingURL);
            this.callService.setMessageReceivedCallBack(this.onRemoteMessageReceived.bind(this));
            console.log('Call service initialized');
        }

        this.receiveChannelMessageCallback = callback;
    }

    public async connect(chatChanneId: string) {
        console.log('---------------> Connecting to chat channel:', chatChanneId);
        this.chatChannelId = chatChanneId;

        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        await this.callService.startCall(this.chatChannelId);

        if (this.callService.isConnected() === true) {
            this.connected = true;
            console.log('---------------> Connected to chat channel:', chatChanneId);
        }
        else {
            console.error('Failed to start call');
            this.connected = false;
        }
    }

    public disconnect() {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        this.callService.closeCall();
        this.connected = false;
    }

    public isConnected(): boolean {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return false;
        }
        
        return this.callService.isConnected();
    }

    public getRemoteMessages(): Array<string> {
        return this.remoteMessages;
    }

    public sendMessage(message: string) {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        this.callService.sendData(message);
        console.log(`----------------> Local message sent: ${message}`);
    }

    onRemoteMessageReceived(event: MessageEvent) {
        console.log(`--------------> Remote message received by local: ${event.data}`);

        this.remoteMessages.push(event.data);
        this.cdr.detectChanges();
        this.receiveChannelMessageCallback(this.chatChannelId, event.data);

        console.log(this.remoteMessages);
    }
}

export default CallServiceFacade;