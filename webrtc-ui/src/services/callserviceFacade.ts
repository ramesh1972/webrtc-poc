import { ChangeDetectorRef } from '@angular/core';
import CallService from './callservice';
import { MsgData } from '../store/msg-data';


class CallServiceFacade {
    private callService: CallService | null = null;
    //private signalingURL: string = 'http://localhost:3030/';
    private signalingURL: string = 'http://localhost:3030/';

    private connected = false;
    private remoteMessages: Array<string> = new Array<string>();
    private chatChannelId: string = '';
    private cdr: ChangeDetectorRef;
    public from_user: string = '';
    public to_user: string = '';

    private receiveChannelMessageCallback: (channelName: string, type: string, message: string) => void = () => { };

    constructor(private changeDetectorRef: ChangeDetectorRef, callback: (channelName: string, type: string, message: string) => void) {
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

    public async startVideoMessaging(videoElement: HTMLVideoElement) {
        if (this.callService === null || this.callService == undefined) {
            console.error('Call service not initialized');
            return;
        }

        await this.callService.startVideoMessaging(videoElement);
        console.log(`----------------> video call setup successfully`);
    }

    public async startAudioMessaging(audioElement: HTMLAudioElement) {
        if (this.callService === null || this.callService == undefined) {
            console.error('Call service not initialized');
            return;
        }

        await this.callService.startAudioMessaging(audioElement);
        console.log(`----------------> video call setup successfully`);
    }

    public async stopVideo(): Promise<string> {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return '';
        }

        this.callService.stopRecording();

        return await this.callService.getRecordedVideoURL('video/webm').then((videoUrl) => {
            console.log(`----------------> Recorded video url: ${videoUrl}`);
            return videoUrl;
        });
    }

    public async stopAudio(): Promise<string> {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return '';
        }

        this.callService.stopRecording();

        return await this.callService.getRecordedVideoURL('audio/webm').then((audioUrl) => {
            console.log(`----------------> Recorded video url: ${audioUrl}`);
            return audioUrl;
        });
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

    public async sendVideo(): Promise<string> {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return '';
        }

        return await this.callService.sendVideo();
    }

    public async sendAudio(): Promise<string> {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return '';
        }

        return await this.callService.sendAudio();
    }

    public isConnectionEstablished(): boolean {
        return this.connected;
    }

    onRemoteMessageReceived(messageData: MsgData) {
        console.log(`--------------> Remote message received by local: ${messageData.data}`);

        this.remoteMessages.push(messageData.data);
        this.cdr.detectChanges();
        this.receiveChannelMessageCallback(this.chatChannelId, messageData.type, messageData.data);

        console.log(this.remoteMessages);
    }
}

export default CallServiceFacade;