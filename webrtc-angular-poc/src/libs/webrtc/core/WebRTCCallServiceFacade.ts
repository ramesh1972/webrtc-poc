import WebRTCCallService from './WebRTCCallService';

import { WebRTCDataChannelLabel, WebRTCDataChannelType } from '../models/DataChannelLabel';
import { ChannelMessage, ChannelMessageType } from '../models/ChannelMessage';
import { SystemCommand } from '../models/SystemCommand';

// a shim to handle methods in WebRTCCallService
class WebRTCCallServiceFacade {
    private callService: WebRTCCallService | null = null;
    private memberCallServices: Map<string, WebRTCCallService> = new Map<string, WebRTCCallService>(); // if part of group

    // TODO: move to config file
    private signalingURL: string = 'http://192.168.100.4:3030/';
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

    constructor(channelName: WebRTCDataChannelLabel, messagecallback: (channelMessage: ChannelMessage) => void,
        commandcallback: (channelMessage: ChannelMessage) => void) {

        if (channelName === null || channelName === undefined) {
            console.error('WebRTCCallServiceFacade: Invalid data channel label');
            return;
        }

        if (channelName.dataChannelType == WebRTCDataChannelType.P2P)
            this.setupP2PCallFacade(channelName);
        else if (channelName.dataChannelType == WebRTCDataChannelType.GROUP)
            this.setupGroupCallFacade(channelName);

        this.receiveChannelMessageCallback = messagecallback;
        this.receiveSystemCommandCallback = commandcallback;
    }

    private setupP2PCallFacade(dataChannelLabel: WebRTCDataChannelLabel) {
        // initialize the call service
        if (this.callService === null || this.callService === undefined) {
            this.callService = new WebRTCCallService(this.signalingURL, dataChannelLabel);
            this.callService.SetMessageReceivedCallBack(this.onReceivedMessage.bind(this));
            this.callService.SetSystemCommandCallBack(this.OnSystemCommandReceived.bind(this));

            console.log('Call service initialized');
        }
    }

    private setupGroupCallFacade(dataChannelLabel: WebRTCDataChannelLabel) {
        console.log('setting up group call services')
        // create a call service facade for the group for each member
        const groupMembers = dataChannelLabel!.toChannel!.groupMembers;
        if (groupMembers === null || groupMembers === undefined) {
            console.error('ConnectDataChannel: Invalid group members');
            return;
        }

        for (let i = 0; i < groupMembers.length; i++) {
            const member = groupMembers[i];
            if (member === null || member === undefined) {
                console.error('ConnectDataChannel: Invalid group member');
                continue;
            }

            console.log('ConnectDataChannel: Creating call service facade for member:', member.name);

            const memberCallService = new WebRTCCallService(this.signalingURL, dataChannelLabel, member);
            memberCallService.SetMessageReceivedCallBack(this.onReceivedMessage.bind(this));
            memberCallService.SetSystemCommandCallBack(this.OnSystemCommandReceived.bind(this));

            this.memberCallServices.set(member.id, memberCallService);
        }
    }

    // --------------------------------------------------------------------------------------------
    // connection methods
    public async connect() {
        console.log('callServiceFacade connect')
        try {
            console.log("member services length", this.memberCallServices?.size);

            if (this.memberCallServices.size > 0) {
                console.log('Connect: Connecting to group members', this.memberCallServices.size);

                this.memberCallServices.forEach(async (value: WebRTCCallService, key: string) => {
                    console.log('connect:', key);
                    await value.StartCall();
                });

                return;
            }

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
            console.log('WARN: Call service not initialized');
            return;
        }

        this.callService.handleBye(null);
        this.connected = false;
        this.callService = null;
    }

    public IsConnected(): boolean {
        if (this.memberCallServices!.size > 0)
            return false; // TODO check connection of passed memberId

        if (this.callService === null) {
            console.error('Call service not initialized');
            return false;
        }

        return this.callService.IsConnected();
    }

    public GetChannel(): WebRTCDataChannelLabel | null {
        if (this.memberCallServices!.size > 0)
            return null; // TODO check connection of passed memberId

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

    // --------------------------------------------------------------------------------------------
    // start media streaming
    public SetMediaStreamReceiveCallback(callback: (stream: any) => void) {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        this.callService.SetRemoteStreamCallBack(callback);
    }

    public async StartVideoStreaming(localStreamObj: any) {
        if (this.callService === null || this.callService === undefined) {
            console.error('Call service not initialized');
            return false;
        }

        if (localStreamObj === null || localStreamObj === undefined) {
            console.error('Invalid local stream object');
            return false;
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
            return false;
        }

        return await this.callService.StopStreaming();
    }
}

export default WebRTCCallServiceFacade;