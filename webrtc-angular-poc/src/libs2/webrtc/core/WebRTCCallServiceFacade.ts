import WebRTCCallService from './WebRTCCallService';

import { WebRTCDataChannelLabel } from '../models/DataChannelLabel';
import { ChannelMessage, ChannelMessageType } from '../models/ChannelMessage';
import { SystemCommand } from '../models/SystemCommand';

// a shim to handle methods in WebRTCCallService
class WebRTCCallServiceFacade {
    private callService: WebRTCCallService | null = null;

    // TODO: move to config file
    private signalingURL: string = 'http://192.168.100.8:3030/';
    //private signalingURL: string = 'http://13.232.40.67:3030/';

    // the channel id for the chat between 2 peers
    public from_user: string = '';
    public to_user: string = '';

    // peer connection properties
    private connected = false;

    // the messages received from the remote peer
    private remoteMessages: Array<string> = new Array<string>();

    // callbacks
    private receiveChannelMessageCallback: (channelMessage: ChannelMessage) => void = () => { };
    private receiveSystemCommandCallback: (channelMessage: ChannelMessage) => void = () => { };
    private receiveMediaStreamCallback: (channelMessage: ChannelMessage) => void = () => { };

    constructor(channelName: WebRTCDataChannelLabel, messagecallback: (channelMessage: ChannelMessage) => void,
        commandcallback: (channelMessage: ChannelMessage) => void, streamcallback: (stream: any) => void) {

        if (channelName === null || channelName === undefined) {
            console.error('WebRTCCallServiceFacade: Invalid data channel label');
            return;
        }

        // initialize the call service
        if (this.callService === null || this.callService === undefined) {
            this.callService = new WebRTCCallService(this.signalingURL, channelName);
            this.callService.SetMessageReceivedCallBack(this.onReceivedMessage.bind(this));
            this.callService.SetSystemCommandCallBack(this.OnSystemCommandReceived.bind(this));
            this.callService.SetRemoteStreamCallBack(this.OnReceivedMediaStream.bind(this));

            console.log('Call service initialized');
        }

        this.receiveChannelMessageCallback = messagecallback;
        this.receiveSystemCommandCallback = commandcallback;
        this.receiveMediaStreamCallback = streamcallback;
    }

    // --------------------------------------------------------------------------------------------
    // connection methods
    public async connect() {
        try {
            if (this.callService === null) {
                console.error('connect: Call service not initialized');
                return false;
            }

            // start the call
            await this.callService.StartCall();

            console.debug('Connect: returned from call service start call');
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

        this.callService.handleBye(null);
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

    public GetChannel(): WebRTCDataChannelLabel | null {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return null;
        }

        return this.callService.GetChannel();
    }

    // --------------------------------------------------------------------------------------------
    // start media messaging
    public async StartVideoMessaging(videoElement: any) {
        if (this.callService === null || this.callService === undefined) {
            console.error('Call service not initialized');
            return;
        }

        await this.callService.StartVideoMessaging(videoElement);
        console.log(`----------------> video call setup successfully`);
    }

    public async StartAudioMessaging(audioElement: any) {
        if (this.callService === null || this.callService === undefined) {
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

        await this.callService.StopRecording();

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

        await this.callService.StopRecording();

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

        this.callService.sendData(message, ChannelMessageType.Text);
        console.log("----------------> Local message sent:", message);

        return true;
    }

    onReceivedMessage(dataChannelLabel: WebRTCDataChannelLabel, messageData: ChannelMessage) {
        console.log(`--------------> Remote message received by local: ${messageData.channelmessage}`);

        this.remoteMessages.push(messageData.channelmessage);
        this.receiveChannelMessageCallback(messageData);

        console.debug(this.remoteMessages);
    }

    // system command handling
    public SendSystemCommand(command: SystemCommand) {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        if (this.callService.sendSystemCommand(command)) {
            console.log('--------------> Local system command sent:', command);
            return true;
        }

        console.error('Failed to send system command', command);
        return false;
    }

    OnSystemCommandReceived(dataChannelLabel: WebRTCDataChannelLabel, channelMessage: ChannelMessage) {
        console.log('OnSystemCommandReceived: remote system command received', channelMessage);

        this.receiveSystemCommandCallback(channelMessage);
    }

    OnReceivedMediaStream(stream: any) {
        console.log('OnReceivedMediaStream: remote media stream received', stream);

        this.receiveMediaStreamCallback(stream);
    }

    // --------------------------------------------------------------------------------------------
    // start media streaming
    public async StartVideoStreaming(localStreamObj: any) {
        if (this.callService === null || this.callService === undefined) {
            console.error('Call service not initialized');
            return null;
        }

        if (localStreamObj === null || localStreamObj === undefined) {
            console.error('Invalid local stream object');
            return null;
        }

        return await this.callService.StartVideoStreaming(localStreamObj);
    }

    public async StartAudioStreaming(localStreamObj: any) {
        if (this.callService === null || this.callService === undefined) {
            console.error('Call service not initialized');
            return null;
        }

        if (localStreamObj === null || localStreamObj === undefined) {
            console.error('Invalid local stream object');
            return null;
        }

        return await this.callService.StartAudioStreaming(localStreamObj);
    }

    public async StopStreaming() {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        return await this.callService.StopStreaming();
    }
}

export default WebRTCCallServiceFacade;