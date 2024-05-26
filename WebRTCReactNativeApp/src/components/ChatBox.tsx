import React, { Component } from 'react';
import { View, TextInput, Button, StyleSheet, Alert } from 'react-native';

import { MsgData } from '../models/MsgData';

import { WebRTCCallServiceFacade } from '../libs/webrtc/core/WebRTCCallServiceFacade';

import { WebRTCHandler } from '../libs/webrtc/WebRTCHandler';

interface Props {
	webRTCHandler: WebRTCHandler;
	currentDataChannelName: string;
	onSentMessage: (dataChannelName: string, msg: ChannelMessage) => void;
}

interface ChatBoxState {
  newChatMessage: string;
	recordingURL: string;
}

class ChatBox extends Component<{}, ChatBoxState> {
  constructor(props: {}) {
    super(props);
    this.state = {
      newChatMessage: '',
      recordingURL: ''
    };

    this.sendMessage = this.sendMessage.bind(this);
    this.handleMessageChange = this.handleMessageChange.bind(this);
  }

  // audio & video messaging
  isVideoMessage: boolean = false;
  isAudioMessage: boolean = false;
  isTextMessage: boolean = true;
  isVideoRecordingOn: boolean = false;
  isAudioRecordingOn: boolean = false;

  isVideoInputVisible: boolean = false;
  isAudioInputVisible: boolean = false;

  // audio & video streaming
  isVideoStreamingOn: boolean = false;
  isAudioStreamingOn: boolean = false;

  // image capture
  isImageCaptureVisible: boolean = false;

	// -------------------------------------------------------------------------------------
  // audio & video messaging
  public async handleVideoMessaging() {
    this.isVideoMessage = true;
    this.isAudioMessage = false;

    this.isAudioInputVisible = false;
    this.isVideoInputVisible = true;

    const videoElement = this.el.nativeElement.querySelector('.send-video-input') as HTMLVideoElement;

    if (this.isVideoRecordingOn) {
      console.log('Stopping video messaging');
      let url = await this.props.webRTCHandler?.StopVideo().then((url) => {
        this.recordingURL = url;
      });

      if (videoElement)
        this.renderer.removeChild(this.el.nativeElement, videoElement);
    }

    console.log('Starting video messaging');

    this.isVideoMessage = true;
    this.isAudioMessage = false;
    this.isVideoRecordingOn = true;
    this.isAudioRecordingOn = false;
    this.recordingURL = '';

    this.props.webRTCHandler.StartVideoMessaging(videoElement);
  }

  public async handleAudioMessaging() {
    this.isVideoMessage = false;
    this.isAudioMessage = true;

    this.isAudioInputVisible = true;
    this.isVideoInputVisible = false;

    let audioElement = this.el.nativeElement.querySelector('.send-audio-input') as HTMLAudioElement;

    if (this.isAudioRecordingOn) {
      console.log('Stopping audio messaging');
      let url = await this.props.webRTCHandler.StopAudio().then((url) => {
        this.recordingURL = url;
      });

      if (audioElement)
        this.renderer.removeChild(this.el.nativeElement, audioElement);
    }

    console.log('Starting audio messaging');

    this.isVideoMessage = false;
    this.isAudioMessage = true;
    this.isVideoRecordingOn = false;
    this.isAudioRecordingOn = true;
    this.recordingURL = '';

    this.props.webRTCHandler.StartAudioMessaging(audioElement);
  }

  async sendMessage() {
		console.log("++++++++++++++++++++++++++++++++++sending messge")
    let sentMsg: ChannelMessage | null | undefined = undefined;

    if (this.isTextMessage === false && this.isVideoMessage === false && this.isAudioMessage === false) {
      console.error('No message type selected');
      return;
    }

		console.log("sendMessage 1");
    this.isVideoInputVisible = false;
    this.isAudioInputVisible = false;

    // if video
    if (this.isVideoMessage) {
      console.log('----------------> Sending video message');
      sentMsg = await this.props.webRTCHandler.SendVideoMessage(this.props.currentDataChannelName);
      console.log('----------------> Sent video message', sentMsg?.channelmessage);
    }
    else if (this.isAudioMessage) { // if audio
      console.log('----------------> Sending audio message');
      sentMsg = await this.props.webRTCHandler.SendAudioMessage(this.props.currentDataChannelName); // Await the promise
      console.log('----------------> Sent audio message', sentMsg?.channelmessage);
    }

		console.log("sendMessage 2");

    // if there was a text message add it to the global message collection
		console.log("sendMessage 3: ", this.state.newChatMessage);

    const newTextMessage = this.state.newChatMessage.trim();
    console.log('-------------> Sending message:', newTextMessage);

    if (newTextMessage !== null && newTextMessage !== undefined && newTextMessage !== '') {
      sentMsg = await this.props.webRTCHandler.SendTextMessage(this.props.currentDataChannelName, newTextMessage);

      this.isAudioMessage = false;
      this.isVideoMessage = false;
      this.state.newChatMessage = '';
    }

    if (sentMsg === null || sentMsg === undefined) {
    	console.error('Failed to send message');
			return;
		}

		console.log("sendMessage 4 channel", this.props.currentDataChannelName);
    this.props.onSentMessage(this.props.currentDataChannelName, sentMsg);
    console.log('sendMessage 5');
  }

  // -------------------------------------------------------------------------------------
  // audio & video streaming
  public async handleVideoStreaming() {
    console.log('Starting video streaming');
    this.isAudioStreamingOn = false;

    if (this.isVideoStreamingOn)
      this.isVideoStreamingOn = false;
    else
      this.isVideoStreamingOn = true;

    // get the local & remote video elements
    let localVideoElement = document.getElementById('localVideo') as HTMLVideoElement;
    let remoteVideoElement = document.getElementById('remoteVideo') as HTMLVideoElement;

    if (localVideoElement === null || remoteVideoElement === null) {
      console.error('Video elements not found');
      return;
    }

    await this.callServiceFacade?.StartVideoStreaming(localVideoElement, remoteVideoElement);

    console.log('Video streaming started');
  }

  handleAudioStreaming() {
    console.log('Starting audio streaming');
    this.isVideoStreamingOn = false;

    if (this.isAudioStreamingOn)
      this.isAudioStreamingOn = false;
    else
      this.isAudioStreamingOn = true;

    // get the local & remote Audio elements
    let localAudioElement = document.getElementById('localAudio') as HTMLAudioElement;
    let remoteAudioElement = document.getElementById('remoteAudio') as HTMLAudioElement;

    if (localAudioElement === null || remoteAudioElement === null) {
      console.error('Audio elements not found');
      return;
    }

    this.callServiceFacade?.StartAudioStreaming(localAudioElement, remoteAudioElement);
    console.log('Audio streaming started');
  }

  handleMessageChange = (text: string) => {
    this.setState({ newChatMessage: text });
    console.log('-------------> Message changed:', text);
  };

  render() {
    const { newChatMessage } = this.state;

    return (
      <View style={styles.chatBoxContainer}>
        <View style={styles.chatBox}>
          <TextInput
            style={styles.messageInput}
            value={newChatMessage}
            placeholder="Type your message..."
            onChangeText={this.handleMessageChange}
          />
          <View style={styles.chatButtons}>
            <Button title="Send" style={styles.sendButton} onPress={this.sendMessage} />
          </View>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  chatBoxContainer: {
    padding: 10,
    backgroundColor: 'lightgray',
  },
  chatBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginRight: 10,
    backgroundColor: 'white',
  },
  chatButtons: {
    justifyContent: 'center',
  },
  sendButton: {
    justifyContent: 'center',
  }
});

export default ChatBox;
