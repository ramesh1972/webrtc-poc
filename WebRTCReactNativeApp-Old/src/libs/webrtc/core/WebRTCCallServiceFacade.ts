import WebRTCCallService from './WebRTCCallService';

import colabLog from '../utils/colabLog';

import { WebRTCDataChannelLabel } from '../models/DataChannelLabel';
import { ChannelMessage, ChannelMessageType } from '../models/ChannelMessage';
import { SystemCommand } from '../models/SystemCommand';
import SignalingMessage from '../models/SignalingMessage';

// a shim to handle methods in WebRTCCallService
class WebRTCCallServiceFacade {
    private callService: WebRTCCallService | null = null;

    private dataChannelLabel: WebRTCDataChannelLabel | null = null;

    // the channel id for the chat between 2 peers
    public from_user: string = '';
    public to_user: string = '';

    // the messages received from the remote peer
    private remoteMessages: Array<string> = new Array<string>();

    // callbacks
    private receiveChannelMessageCallback: (channelMessage: ChannelMessage) => void = () => { };
    private receiveSystemCommandCallback: (channelMessage: ChannelMessage) => void = () => { };

    constructor(socket: any, channelName: WebRTCDataChannelLabel, messagecallback: (channelMessage: ChannelMessage) => void,
        commandcallback: (channelMessage: ChannelMessage) => void) {

        if (channelName === null || channelName === undefined) {
            console.error('WebRTCCallServiceFacade: Invalid data channel label');
            return;
        }

        this.dataChannelLabel = channelName;

        // initialize the call service
        if (this.callService === null || this.callService === undefined) {
            this.callService = new WebRTCCallService(socket, channelName);
            this.callService.SetMessageReceivedCallBack(this.onReceivedMessage.bind(this));
            this.callService.SetSystemCommandCallBack(this.OnSystemCommandReceived.bind(this));

            colabLog(this.dataChannelLabel, 'Call service initialized');
        }

        this.receiveChannelMessageCallback = messagecallback;
        this.receiveSystemCommandCallback = commandcallback;
    }

    // get methods
    public GetCallService(): WebRTCCallService | null {
        return this.callService;
    }

    public GetChannel(): WebRTCDataChannelLabel | null {
        if (this.callService === null) {
            console.log('WARN: Call service not initialized in GetChannel');
            return null;
        }

        return this.callService.GetChannel();
    }

    // --------------------------------------------------------------------------------------------
    // socket message handlers, called from WebRTCHandler, pass it on to the callService
    public async handleSystemCommand(command: SystemCommand) {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        await this.callService.handleSystemCommand(command).then(() => {
            console.debug('handleSystemCommand: success from call service');
        }).catch((error) => {
            console.error('handleSystemCommand: error from call service', error);
        });
    }

    public async handleOffer(offer: any) {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        await this.callService.handleOffer(offer).then(() => {
            console.debug('handleOffer: success from call service');
        }).catch((error) => {
            console.error('handleOffer: error from call service', error);
        });
    }

    public async handleAnswer(answer: any) {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        await this.callService.handleAnswer(answer).then(() => {
            console.debug('handleAnswer: success from call service');
        }).catch((error) => {
            console.error('handleAnswer: error from call service', error);
        });
    }

    public async handleCandidate(candidate: any) {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        await this.callService.handleCandidate(candidate).then(() => {
            console.debug('handleCandidate: success from call service');
        }).catch((error) => {
            console.error('handleCandidate: error from call service', error);
        });
    }

    public async handleReady(ready: any) {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        await this.callService.handleReady(ready).then(() => {
            console.debug('handleReady: success from call service');
        }).catch((error) => {
            console.error('handleReady: error from call service', error);
        });
    }

    public async handleBye(bye: any) {
        if (this.callService === null) {
            console.log('Call service not initialized');
            return;
        }

        await this.callService.handleBye(bye).then(() => {
            console.debug('handleBye: success from call service');
        }).catch((error) => {
            console.error('handleBye: error from call service', error);
        });
    }

    // --------------------------------------------------------------------------------------------

    // --------------------------------------------------------------------------------------------
    // use case specific commands
    public SendCallInitiatedMessage() {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        this.callService.SendCallInitiatedMessage();
    }
    // --------------------------------------------------------------------------------------------

    // --------------------------------------------------------------------------------------------
    // connect & disconnect webrtc peer connections
    public async init(isInitiator: boolean, localStreamObj?: any) {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return false;
        }

        return await this.callService.InitCall(isInitiator, localStreamObj);
    }

    public async connect() {
        try {
            if (this.callService === null) {
                console.error('connect: Call service not initialized');
                return false;
            }

            console.debug('Connect: returning from call service start call');

            // start the call
            return await this.callService.StartCall();
        }
        catch (e) {
            console.error('Error in connect:', e);
            return false;
        }

        return true;
    }

    public disconnect() {
        if (this.IsConnected() === false) {
            console.log('WARN Already disconnected');
            return true;
        }

        if (this.callService === null) {
            console.log('WARN: Call service not initialized');
            return true;
        }

        colabLog(this.dataChannelLabel, 'calling CloseCall');

        const isClosed = this.callService.CloseCall();

        if (!isClosed) {
            console.error('Failed to close the call');
            return false;
        }

        this.callService = null;

        return true;
    }

    public IsConnected(): boolean {
        if (this.callService === null) {
            console.log('WARN: Call service probably not initialized or destroyed');
            return false;
        }

        return this.callService.IsConnected();
    }

    public IsPeerConnected(): boolean {
        if (this.callService === null) {
            console.log('WARN: Call service probably not initialized or destroyed');
            return false;
        }

        return this.callService.IsPeerConnected();
    }
    // -------------------------------------------------------------------------------------------- 

    // --------------------------------------------------------------------------------------------
    // start media messaging
    public async StartVideoMessaging(videoElement: any) {
        if (this.callService === null || this.callService === undefined) {
            console.error('Call service not initialized');
            return;
        }

        await this.callService.StartVideoMessaging(videoElement);
        colabLog(this.dataChannelLabel, `----------------> video call setup successfully`);
    }

    public async StartAudioMessaging(audioElement: any) {
        if (this.callService === null || this.callService === undefined) {
            console.error('Call service not initialized');
            return;
        }

        await this.callService.StartAudioMessaging(audioElement);
        colabLog(this.dataChannelLabel, `----------------> audio call setup successfully`);
    }

    public async StopVideo(): Promise<string> {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return '';
        }

        await this.callService.StopRecording();

        return await this.callService.GetRecordedVideoURL('video/webm').then((videoUrl) => {
            colabLog(this.dataChannelLabel, `----------------> Recorded video url: ${videoUrl}`);
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
            colabLog(this.dataChannelLabel, `----------------> Recorded audio url: ${audioUrl}`);
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
            return false;
        }

        this.callService.sendData(message, ChannelMessageType.Text);
        colabLog(this.dataChannelLabel, "----------------> Local message sent:", message);

        return true;
    }

    public onReceivedMessage(dataChannelLabel: WebRTCDataChannelLabel, messageData: ChannelMessage) {
        colabLog(this.dataChannelLabel, `--------------> Remote message received by local: ${messageData.channelmessage}`);

        this.remoteMessages.push(messageData.channelmessage);
        this.receiveChannelMessageCallback(messageData);

        console.debug(this.remoteMessages);
    }
    // --------------------------------------------------------------------------------------------

    // --------------------------------------------------------------------------------------------
    // system command handling
    public SendSystemCommandViaSocket(command: SystemCommand, callback?: (dataChannel: WebRTCDataChannelLabel) => void) {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        if (this.callService.SendSystemCommandViaSocket(command, callback)) {
            colabLog(this.dataChannelLabel, '--------------> Local system command sent via Socket:', command);
            return true;
        }

        console.error('Failed to send system command via SOcket', command);
        return false;
    }

    public SendSystemCommand(command: SystemCommand) {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        if (this.callService.sendSystemCommand(command)) {
            colabLog(this.dataChannelLabel, '--------------> Local system command sent:', command);
            return true;
        }

        console.error('Failed to send system command', command);
        return false;
    }

    public OnSystemCommandReceived(dataChannelLabel: WebRTCDataChannelLabel, channelMessage: ChannelMessage) {
        colabLog(this.dataChannelLabel, 'OnSystemCommandReceived: remote system command received', channelMessage);

        this.receiveSystemCommandCallback(channelMessage);
    }
    // --------------------------------------------------------------------------------------------

    // --------------------------------------------------------------------------------------------
    // media streaming handling
    public SetMediaStreamReceiveCallback(callback: (stream: any) => void) {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return;
        }

        this.callService.SetRemoteStreamCallBack(callback);
    }

    public async StartVideoStreaming() {
        if (this.callService === null || this.callService === undefined) {
            console.error('Call service not initialized in facade');
            return false;
        }

        return await this.callService.StartVideoStreaming();
    }

    public async StartAudioStreaming(localStreamObj) {
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

    public StopStreaming() {
        if (this.callService === null) {
            console.error('Call service not initialized');
            return false;
        }

        return this.callService.StopStreaming();
    }
    // --------------------------------------------------------------------------------------------
}

export default WebRTCCallServiceFacade;