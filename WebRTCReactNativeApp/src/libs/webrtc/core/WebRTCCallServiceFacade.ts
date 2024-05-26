import WebRTCCallService from './WebRTCCallService';

import { MsgData } from '../models/MsgData';

// a shim to handle methods in WebRTCCallService
class WebRTCCallServiceFacade {
    private callService: WebRTCCallService | null = null;

    // TODO: move to config file
    private signalingURL: string = 'http://192.168.0.124:3030/';

    // the channel id for the chat between 2 peers
    public from_user: string = '';
    public to_user: string = '';
    private chatChannelId: string = '';

    // peer connection properties
    private connected = false;

    // the messages received from the remote peer
    private remoteMessages: Array<string> = new Array<string>();

    // callbacks
    private receiveChannelMessageCallback: (channelName: string, type: string, message: string) => void = () => { };


    constructor(callback: (channelName: string, type: string, message: string) => void) {

        // initialize the call service
        if (this.callService === null || this.callService == undefined) {
            this.callService = new WebRTCCallService(this.signalingURL);
            this.callService.SetMessageReceivedCallBack(this.onReceivedMessage.bind(this));
            console.log('Call service initialized');
        }

        this.receiveChannelMessageCallback = callback;
    }

    public GetChannelId(): string {
        return this.chatChannelId;
    }

    // --------------------------------------------------------------------------------------------
    // connection methods
    public async connect(chatChannelId: string) {
        try {
            console.log('---------------> Connecting to chat channel:', chatChannelId);
            this.chatChannelId = chatChannelId;

            if (this.callService === null) {
                console.error('Call service not initialized');
                return false;
            }

            // start the call
            await this.callService.StartCall(this.chatChannelId);

            console.log('---------------> returned from call service start call');

            if (this.callService.IsConnected() === true) {
                this.connected = true;
                console.log('---------------> Connected to chat channel:', chatChannelId);
            }
            else {
                console.error('Failed to start call');
                this.connected = false;
            }
        }
        catch (e) {
            console.error('Error in connect:', e);
            this.connected = false;
        }

        return this.connected;
    }

    public disconnect() {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        this.callService.CloseCall();
        this.connected = false;
        this.callService = null;
    }

    public IsConnected(): boolean {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return false;
        }

        return this.callService.IsConnected();
    }

    // --------------------------------------------------------------------------------------------
    // start media messaging
    public async StartVideoMessaging(videoElement: HTMLVideoElement) {
        if (this.callService === null || this.callService == undefined) {
            console.error('Call service not initialized');
            return;
        }

        await this.callService.StartVideoMessaging(videoElement);
        console.log(`----------------> video call setup successfully`);
    }

    public async StartAudioMessaging(audioElement: HTMLAudioElement) {
        if (this.callService === null || this.callService == undefined) {
            console.error('Call service not initialized');
            return;
        }

        await this.callService.StartAudioMessaging(audioElement);
        console.log(`----------------> audio call setup successfully`);
    }

    public async StopVideo(): Promise<string> {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return '';
        }

        this.callService.StopRecording();

        return await this.callService.GetRecordedVideoURL('video/webm').then((videoUrl) => {
            console.log(`----------------> Recorded video url: ${videoUrl}`);
            return videoUrl;
        });
    }

    public async StopAudio(): Promise<string> {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return '';
        }

        this.callService.StopRecording();

        return await this.callService.GetRecordedVideoURL('audio/webm').then((audioUrl) => {
            console.log(`----------------> Recorded audio url: ${audioUrl}`);
            return audioUrl;
        });
    }

    public async SendVideo(): Promise<string> {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return '';
        }

        return await this.callService.SendVideo();
    }

    public async SendAudio(): Promise<string> {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return '';
        }

        return await this.callService.SendAudio();
    }

    // --------------------------------------------------------------------------------------------
    // message handling
    public GetRemoteMessages(): Array<string> {
        return this.remoteMessages;
    }

    public SendMessage(message: string) {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        this.callService.sendData(message);
        console.log("----------------> Local message sent:", message);
    }

    onReceivedMessage(messageData: MsgData) {
        console.log(`--------------> Remote message received by local: ${messageData.data}`);

        this.remoteMessages.push(messageData.data);
        this.receiveChannelMessageCallback(this.chatChannelId, messageData.type, messageData.data);

        console.log(this.remoteMessages);
    }

    // --------------------------------------------------------------------------------------------
    // start media streaming
    public async StartVideoStreaming(localVideoElement: HTMLVideoElement, remoteVideoElement: HTMLVideoElement) {
        if (this.callService === null || this.callService == undefined) {
            console.error('Call service not initialized');
            return;
        }

        if (localVideoElement === null || remoteVideoElement === null) {
            console.error('Video elements not found');
            return;
        }

        await this.callService.StartVideoStreaming(localVideoElement, remoteVideoElement);
        console.log(`----------------> video call setup successfully`);
    }

    public async StartAudioStreaming(localAudioElement: HTMLAudioElement, remoteAudioElement: HTMLAudioElement) {
        if (this.callService === null || this.callService == undefined) {
            console.error('Call service not initialized');
            return;
        }

        if (localAudioElement === null || remoteAudioElement === null) {
            console.error('Audio elements not found');
            return;
        }

        await this.callService.StartAudioStreaming(localAudioElement, remoteAudioElement);
        console.log(`----------------> video call setup successfully`);
    }

    public async StopStreaming() {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        this.callService.StopRecording();
    }
}

export default WebRTCCallServiceFacade;