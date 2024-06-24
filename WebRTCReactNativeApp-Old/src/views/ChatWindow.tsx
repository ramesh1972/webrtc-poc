/* eslint-disable prettier/prettier */
/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  PermissionsAndroid,
} from 'react-native';

import { Channel } from '../libs/webrtc/models/Channel';
import { ChannelMessage } from '../libs/webrtc/models/ChannelMessage';
import getChannels from '../store/channelList';

import WebRTCHandler from '../libs/webrtc/WebRTCHandler';

import ChannelList from '../components/ChannelList'; // Import your custom component
import ChatMessagesWindow from '../components/ChatMessagesWindow'; // Import your custom component
import ChatBox from '../components/ChatBox'; // Import your custom component
import { WebRTCDataChannelStreamType, WebRTCDataChannelType, WebRTCDataChannelLabel } from '../libs/webrtc/models/DataChannelLabel';

interface Props { }

interface State {
  currentDataChannelName: string;
  currentDataChannel?: WebRTCDataChannelLabel | null;
  selectedUser: string;

  channels: Channel[];
  visibleChannels: Channel[];
  myChannel: Channel;
  toChannel: Channel;
  chatWindowChatInfo: string;

  currentChannelChatMessages: ChannelMessage[];
}

class ChatWindow extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      selectedUser: '',
      currentDataChannelName: '',
      currentDataChannel: null, // Assign initial value of null
      channels: getChannels(),
      myChannel: getChannels()[0],
      toChannel: getChannels()[1],
      visibleChannels: [],
      chatWindowChatInfo: '',
      currentChannelChatMessages: [],
    };

    this.onChannelChange = this.onChannelChange.bind(this);
  }

  private webRTCHandler: WebRTCHandler | null = null;

  // ---------------------------------------------------------------------------------------
  // init routines
  async requestPermissions() {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
    }
  }

  async componentDidMount() {
    await this.requestPermissions();

    // create the singleton webRTCHandler
    this.webRTCHandler = WebRTCHandler.getInstance(
      this.onReceiveMessage.bind(this),
      this.onReceiveCommand.bind(this),
    );
    if (this.webRTCHandler === null || this.webRTCHandler === undefined) {
      console.error('WebRTC handler not initialized');
      return;
    }

    // set basic state
    this.initChannelProperties(null);

    console.log('done componentDidMount');
  }

  async initChannelProperties(fromChannel: Channel | null) {
    // set all channels
    let allChannels = getChannels();
    if (this.state.channels === null || this.state.channels === undefined) {
      this.setState({ channels: allChannels });
    } else {
      allChannels = this.state.channels;
    }

    console.log('All channels:', this.state.channels);

    // set my channel
    let myChnl : Channel | null = null;
    if (fromChannel !== null && fromChannel !== undefined) {
      this.setState({ myChannel: fromChannel });
      myChnl = fromChannel
      this.setState({ selectedUser: fromChannel.name });
    } else if (
      this.state.myChannel === null ||
      this.state.myChannel === undefined
    ) {
      this.setState({ myChannel: allChannels[0] });
      this.setState({ selectedUser: allChannels[0].name });
      myChnl = allChannels[0];
    } else {
      this.setState({ selectedUser: this.state.myChannel.name });
      myChnl = this.state.myChannel;
    }

    // set toChannels
    const toChannelsList = allChannels.filter(
      channel => channel.name !== myChnl.name,
    );
    this.setState({ visibleChannels: toChannelsList });
    this.setState({ toChannel: toChannelsList[0] });

    const toChnl = toChannelsList[0];
    this.setState({
      chatWindowChatInfo: this.getChatWindowChatInfo(myChnl, toChnl),
    });

    // set the initial WebRTC objects
    this.setState({currentDataChannel: await this.webRTCHandler!.ConnectDataChannel(WebRTCDataChannelType.P2P, 1, myChnl, toChnl)});
    const channelName = this.webRTCHandler!.GetDataChannelName(WebRTCDataChannelType.P2P, WebRTCDataChannelStreamType.NONE, 1, myChnl, toChnl) || '';
    this.setState({ currentDataChannelName: channelName });

    // set the initial messages
    this.setMessages(channelName);
    console.log('done initChannelProperties');
    return toChnl;
  }

  setMessages(channelName: string = '') {
    if (this.webRTCHandler === null || this.webRTCHandler === undefined) {
      console.error('WebRTC handler not initialized');
      return;
    }

    if (channelName === '') {
      console.error('Channel name is empty');
      return;
    }

    let messages: ChannelMessage[] =
      this.webRTCHandler.getChannelMessages(channelName) || [];

    this.setState({ currentChannelChatMessages: messages });
  }

  getChatWindowChatInfo(user: Channel, toChannel: Channel) {
    console.log('getChatWindowChatInfo:', user, toChannel);
    if (user && toChannel) {
      return user.name + ' is chatting with ' + toChannel.name;
    }

    return 'Unknown people chatting...  ';
  }

  // ---------------------------------------------------------------------------------------
  // events
  async onChannelChange(channel: Channel, channelListType: string) {
    console.log('OnChannelChange type:', channelListType);
    console.log('OnChannelChange channel:', channel);

    if (channelListType === 'Users') {
      console.log('OnChannelChange in users:');
      this.setState({ myChannel: channel });
    }
    else if (channelListType === 'Channels') {
      this.setState({ toChannel: channel });
      this.setState({
        chatWindowChatInfo: this.getChatWindowChatInfo(
          this.state.myChannel,
          channel,
        ),
      });

      // set the initial WebRTC objects
      console.log(
        'Creating data channel:',
        this.state.myChannel.id,
        channel.id,
      );
      await this.webRTCHandler!.ConnectDataChannel(WebRTCDataChannelType.P2P, 1, this.state.myChannel, channel);

      const channelName = this.webRTCHandler?.GetDataChannelName(WebRTCDataChannelType.P2P, WebRTCDataChannelStreamType.NONE, 1, this.state.myChannel, channel) || '';
      this.setState({ currentDataChannelName: channelName });
      this.setMessages(channelName);
    }
  }

  // ---------------------------------------------------------------------------------------
  // messaging routines
  // to be called (via props usually) when a message is sent
  onSentMessage = (channelName: string, msg: ChannelMessage) => {
    console.log('OnSentMessage:', channelName, msg);
    console.log(
      'OnSentMessage:',
      this.state.currentDataChannelName,
      channelName,
    );
    if (this.state.currentDataChannelName === channelName) {
      console.log('OnSentMessage: setting currentChannelChatMessages');
      this.setState({
        currentChannelChatMessages:
          this.webRTCHandler!.getChannelMessages(channelName) || [],
      });
    }
  };

  // receive any type of message
  onReceiveMessage(
    channelMessage: ChannelMessage
  ): void {
    if (channelMessage === null || channelMessage === undefined) {
      console.error('Channel message is null');
      return;
    }

    if (channelMessage.dataChannel === null || channelMessage.dataChannel === undefined) {
      console.error('data Channel label is empty');
      return;
    }

    const messages = this.webRTCHandler!.getChannelMessages(channelMessage.dataChannel.dataChannelName!);
    this.setState({ currentChannelChatMessages: messages! });
  }

  onReceiveCommand(
    commandMessage: ChannelMessage
  ): void {
    if (commandMessage === null || commandMessage === undefined) {
      console.error('Channel message is null');
      return;
    }

    if (commandMessage.dataChannel === null || commandMessage.dataChannel === undefined) {
      console.error('data Channel label is empty');
      return;
    }

    // do some processing based on command
  }


  // ---------------------------------------------------------------------------------------
  // UI
  render() {
    const {
      channels,
      visibleChannels,
      myChannel,
      toChannel,
      currentChannelChatMessages,
    } = this.state;

    return (
      <View style={styles.chatWindowContainer}>
        <View style={styles.chatWindowHeader}>
          <View style={[styles.channelList, { zIndex: 101 }]}>
            <ChannelList
              channelListType="Users"
              headerText="Select a User"
              selectedChannel={myChannel}
              channelList={channels}
              onChannelChange={this.onChannelChange}
            />
          </View>
          <View style={[styles.channelList, { zIndex: 100 }]}>
            <ChannelList
              channelListType="Channels"
              headerText="Select a Channel"
              selectedChannel={toChannel}
              channelList={visibleChannels}
              onChannelChange={this.onChannelChange}
            />
          </View>
        </View>

        <View style={styles.chatBodyContainer}>
          <Text style={styles.chatWindowInfoText}>
            {this.state.chatWindowChatInfo}
          </Text>

          <View style={styles.chatWindow}>
            <ChatMessagesWindow
              chatMessages={currentChannelChatMessages}
              dataChannelName={this.state.currentDataChannelName}
            />
          </View>

          <View style={styles.chatBox}>
            <ChatBox
              webRTCHandler={this.webRTCHandler}
              onSentMessage={this.onSentMessage}
              currentDataChannel={this.state.currentDataChannel}
              currentDataChannelName={this.state.currentDataChannelName}
            />
          </View>
        </View>
      </View>
    );
  }
}

// -------------------------------------------------------------------------------
// styles
const styles = StyleSheet.create({
  chatWindowContainer: {
    flex: 1,
    flexDirection: 'column',
    padding: 0,

    height: '100%',
  },
  chatWindowHeader: {
    padding: 0,
    flex: 1,
    flexDirection: 'column',
    width: '100%',
  },
  channelList: {
    height: 30,
    padding: 0,
    backgroundColor: 'black',
  },
  chatBodyContainer: {
    flex: 1,
    flexDirection: 'column',
    padding: 1,
    position: 'absolute',
    top: 60,
    width: '100%',
  },
  chatWindowInfoText: {
    padding: 1,
    fontSize: 20,
    backgroundColor: 'yellow',
    color: 'black',
  },
  chatWindow: {
    flex: 2,
    backgroundColor: 'white',
    minHeight: 200,
  },
  chatBox: {
    width: '100%',
    height: 60,
  },
});

export default ChatWindow;
