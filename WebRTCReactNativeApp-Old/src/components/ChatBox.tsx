import React, { Component } from 'react';
import { View, TextInput, Button, StyleSheet } from 'react-native';

import { ChannelMessage } from '../libs/webrtc/models/ChannelMessage';
import WebRTCHandler from '../libs/webrtc/WebRTCHandler';
import { mediaDevices } from 'react-native-webrtc';
import { WebRTCDataChannelLabel } from '../libs/webrtc/models/DataChannelLabel';

interface Props {
  webRTCHandler: WebRTCHandler | null;
  currentDataChannelName: string;
  currentDataChannel: WebRTCDataChannelLabel | null | undefined;
  onSentMessage: (dataChannelName: string, msg: ChannelMessage) => void;
}

interface ChatBoxState {
  newChatMessage: string;
  recordingURL: string;
}

class ChatBox extends Component<Props, ChatBoxState> {
  constructor(props: Props) {
    super(props);
    this.state = {
      newChatMessage: '',
      recordingURL: '',
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

/*     const videoElement = this.el.nativeElement.querySelector('.send-video-input') as HTMLVideoElement;

    if (this.isVideoRecordingOn) {
      console.log('Stopping video messaging');
      await this.props.webRTCHandler?.StopVideo().then((url) => {
        this.setState({ recordingURL: url });
      });
    }
 */
    console.log('Starting video messaging');

    this.isVideoMessage = true;
    this.isAudioMessage = false;
    this.isVideoRecordingOn = true;
    this.isAudioRecordingOn = false;

    //this.props.webRTCHandler.StartVideoMessaging(videoElement);
  }

  public async handleAudioMessaging() {
    this.isVideoMessage = false;
    this.isAudioMessage = true;

    this.isAudioInputVisible = true;
    this.isVideoInputVisible = false;

    /* let audioElement = this.el.nativeElement.querySelector('.send-audio-input') as HTMLAudioElement;

    if (this.isAudioRecordingOn) {
      console.log('Stopping audio messaging');
      let url = await this.props.webRTCHandler.StopAudio().then((url) => {
        this.recordingURL = url;
      });

      if (audioElement) { this.renderer.removeChild(this.el.nativeElement, audioElement); } */
    //}

    console.log('Starting audio messaging');

    this.isVideoMessage = false;
    this.isAudioMessage = true;
    this.isVideoRecordingOn = false;
    this.isAudioRecordingOn = true;
    this.setState({ recordingURL: '' });
    //this.props.webRTCHandler.StartAudioMessaging(audioElement);
  }

  async sendMessage() {
    console.log('++++++++++++++++++++++++++++++++++sending messge');
    let sentMsg: ChannelMessage | null | undefined;

    if (this.isTextMessage === false && this.isVideoMessage === false && this.isAudioMessage === false) {
      console.error('No message type selected');
      return;
    }

    console.log('sendMessage 1');
    this.isVideoInputVisible = false;
    this.isAudioInputVisible = false;

    // if video
    if (this.isVideoMessage) {
      console.log('----------------> Sending video message');
      sentMsg = await this.props.webRTCHandler!.SendVideoMessage(this.props.currentDataChannel!);
      console.log('----------------> Sent video message', sentMsg?.channelmessage);
    }
    else if (this.isAudioMessage) { // if audio
      console.log('----------------> Sending audio message');
      sentMsg = await this.props.webRTCHandler!.SendAudioMessage(this.props.currentDataChannel!); // Await the promise
      console.log('----------------> Sent audio message', sentMsg?.channelmessage);
    }

    console.log('sendMessage 2');

    // if there was a text message add it to the global message collection
    console.log('sendMessage 3: ', this.state.newChatMessage);

    const newTextMessage = this.state.newChatMessage.trim();
    console.log('-------------> Sending message:', newTextMessage);

    if (newTextMessage !== null && newTextMessage !== undefined && newTextMessage !== '') {
      sentMsg = await this.props.webRTCHandler!.SendTextMessage(this.props.currentDataChannel!, newTextMessage);

      this.isAudioMessage = false;
      this.isVideoMessage = false;
      this.setState({ newChatMessage: '' });
    }

    if (sentMsg === null || sentMsg === undefined) {
      console.error('Failed to send message');
      return;
    }

    console.log('sendMessage 4 channel', this.props.currentDataChannelName);
    this.props.onSentMessage(this.props.currentDataChannelName, sentMsg);
    console.log('sendMessage 5');
  }

  // -------------------------------------------------------------------------------------
  // audio & video streaming
  public async handleVideoStreaming() {
    console.log('Starting video streaming');
    this.isAudioStreamingOn = false;

    if (this.isVideoStreamingOn) { this.isVideoStreamingOn = false; }
    else { this.isVideoStreamingOn = true; }

    // get the local & remote video elements
    const localStream = mediaDevices.getUserMedia({ video: true, audio: true });

    const remoteStream = await this.props.webRTCHandler?.StartVideoStreaming(this.props.currentDataChannel!);

    console.log('Video streaming started:', remoteStream);
  }

  async handleAudioStreaming() {
    console.log('Starting audio streaming');
    this.isVideoStreamingOn = false;

    if (this.isAudioStreamingOn) { this.isAudioStreamingOn = false; }
    else { this.isAudioStreamingOn = true; }

    // get the local & remote Audio elements
    const localStream = mediaDevices.getUserMedia({ video: false, audio: true });

    const remoteStream = await this.props.webRTCHandler?.StartAudioStreaming(this.props.currentDataChannel!, localStream);

    console.log('Audio streaming started', remoteStream);
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
            <Button title="Send" onPress={this.sendMessage}/>
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
  },
});

export default ChatBox;
