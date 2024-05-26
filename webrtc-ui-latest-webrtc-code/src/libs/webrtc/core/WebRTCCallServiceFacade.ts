import WebRTCCallService from './WebRTCCallService';

import { WebRTCDataChannelLabel } from '../models/DataChannelLabel';
import { ChannelMessage, ChannelMessageType } from '../models/ChannelMessage';
import { SystemCommand } from '../models/SystemCommand';

// a shim to handle methods in WebRTCCallService
class WebRTCCallServiceFacade {
    private callService: WebRTCCallService | null = null;

    // TODO: move to config file
    //private signalingURL: string = 'http://192.168.0.124:3030/';
    private signalingURL: string = 'http://localhost:3030/';

    // the channel id for the chat between 2 peers
    public from_user: string = '';
    public to_user: string = '';
    private currentDataChannel?: WebRTCDataChannelLabel;

    // peer connection properties
    private connected = false;

    // the messages received from the remote peer
    private remoteMessages: Array<string> = new Array<string>();

    // callbacks
    private receiveChannelMessageCallback: (channelMessage: ChannelMessage) => void = () => { };
    private receiveSystemCommandCallback: (channelMessage: ChannelMessage) => void = () => { };

    constructor(channelName: WebRTCDataChannelLabel, messagecallback: (channelMessage: ChannelMessage) => void,
                                                     commandcallback: (channelMessage: ChannelMessage) => void) {

        if (channelName === null || channelName === undefined) {
            console.error('WebRTCCallServiceFacade: Invalid data channel label');
            return;
        }

        this.currentDataChannel = channelName;

        // initialize the call service
        if (this.callService === null || this.callService == undefined) {
            this.callService = new WebRTCCallService(this.signalingURL, this.currentDataChannel);
            this.callService.SetMessageReceivedCallBack(this.onReceivedMessage.bind(this));
            this.callService.SetSystemCommandCallBack(this.OnSystemCommandReceived.bind(this));
            console.log('Call service initialized');
        }

        this.receiveChannelMessageCallback = messagecallback;
        this.receiveSystemCommandCallback = commandcallback;
    }

    public GetDataChannel(): WebRTCDataChannelLabel {
        return this.currentDataChannel!;
    }

    public SetDataChannel(dataChannel: WebRTCDataChannelLabel) {
        this.currentDataChannel = dataChannel;
    }
    
    // --------------------------------------------------------------------------------------------
    // connection methods
    public async connect(currentDataChannel: WebRTCDataChannelLabel) {
        if (currentDataChannel === null || currentDataChannel === undefined) {
            console.error('connect: Invalid data channel label');
            return false;
        }

        if (currentDataChannel.dataChannelName === null || currentDataChannel.dataChannelName === undefined || currentDataChannel.dataChannelName === '') {
            console.error('connect: Invalid data channel name');
            return false;
        }

        try {
            this.currentDataChannel = currentDataChannel;

            console.log('connect: Connecting to chat channel:', this.currentDataChannel.dataChannelName);

            if (this.callService === null) {
                console.error('connect: Call service not initialized');
                return false;
            }

            // start the call
            await this.callService.StartCall(this.currentDataChannel);

            console.log('Connect: returned from call service start call');

            if (this.callService.IsConnected() === true) {
                this.connected = true;
                console.log('connect: Connected to chat channel:', this.currentDataChannel.dataChannelName);
            }
            else {
                console.error('connect: Failed to start call');
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
    public async StartVideoMessaging(videoElement: any) {
        if (this.callService === null || this.callService == undefined) {
            console.error('Call service not initialized');
            return;
        }

        await this.callService.StartVideoMessaging(videoElement);
        console.log(`----------------> video call setup successfully`);
    }

    public async StartAudioMessaging(audioElement: any) {
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

    public SendMessage(chatChannel: WebRTCDataChannelLabel, message: string) {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        if (chatChannel === null || chatChannel === undefined) {
            console.error('Invalid chat channel');
            return false;
        }

        if (chatChannel.dataChannelName !== this.currentDataChannel?.dataChannelName) {
            console.error('trying to send command on Invalid chat channel', chatChannel.dataChannelName, this.currentDataChannel?.dataChannelName); 
            return false;
        }

        this.callService.sendData(message, ChannelMessageType.Text);
        console.log("----------------> Local message sent:", message);

        return true;
    }

    onReceivedMessage(messageData: ChannelMessage) {
        console.log(`--------------> Remote message received by local: ${messageData.channelmessage}`);

        this.remoteMessages.push(messageData.channelmessage);
        this.receiveChannelMessageCallback(messageData);

        console.log(this.remoteMessages);
    }

    // system command handling
    public SendSystemCommand(chatChannel: WebRTCDataChannelLabel, command: SystemCommand) {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        if (chatChannel === null || chatChannel === undefined) {
            console.error('Invalid chat channel');
            return false;
        }

        if (chatChannel.dataChannelName !== this.currentDataChannel?.dataChannelName) {
            console.error('trying to send command on Invalid chat channel', chatChannel.dataChannelName, this.currentDataChannel?.dataChannelName); 
            return false;
        }

        if (this.callService.sendSystemCommand(command)) {
            console.log('--------------> Local system command sent:', command);
            return true;
        }

        console.error('Failed to send system command', command);
        return false;
    }

    OnSystemCommandReceived(channelMessage: ChannelMessage) {
        console.log('OnSystemCommandReceived: remote system command received', channelMessage);

        this.receiveSystemCommandCallback(channelMessage);
    }


    // --------------------------------------------------------------------------------------------
    // start media streaming
    public async StartVideoStreaming(dataChannel:WebRTCDataChannelLabel, localVideoElement: any, remoteVideoElement: any) {
        if (this.callService === null || this.callService == undefined) {
            console.error('Call service not initialized');
            return;
        }

        if (localVideoElement === null || remoteVideoElement === null) {
            console.error('Video elements not found');
            return;
        }

        await this.callService.StartVideoStreaming(dataChannel, localVideoElement, remoteVideoElement);
        console.log(`----------------> video call setup successfully`);
    }

    public async StartAudioStreaming(dataChannel: WebRTCDataChannelLabel, localAudioElement: any, remoteAudioElement: any) {
        if (this.callService === null || this.callService == undefined) {
            console.error('Call service not initialized');
            return;
        }

        if (localAudioElement === null || remoteAudioElement === null) {
            console.error('Audio elements not found');
            return;
        }

        await this.callService.StartAudioStreaming(dataChannel, localAudioElement, remoteAudioElement);
        console.log('----------------> video call setup successfully');
    }

    public async StopStreaming() {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        await this.callService.StopStreaming();
    }
}

export default WebRTCCallServiceFacade;