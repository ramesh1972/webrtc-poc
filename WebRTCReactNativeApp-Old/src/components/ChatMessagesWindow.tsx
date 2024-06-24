/* eslint-disable prettier/prettier */
/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
import React, { Component } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

import { ChannelMessage} from '../libs/webrtc/models/ChannelMessage';

interface ChatWindowProps {
	dataChannelName: string;
  chatMessages: ChannelMessage[];
}

class ChatMessagesWindow extends Component<ChatWindowProps> {
  render() {
    const { chatMessages } = this.props;
    if (!chatMessages) {
			return <Text>No messages</Text>;
		}

    return (
      <ScrollView contentContainerStyle={styles.chatWindow}>
        {chatMessages.map((message, index) => (
          <View key={index} style={styles.messageContainer}>
            {message.type === 'text' && (
              <View style={{ alignItems: message.direction === 'in' ? 'flex-start' : 'flex-end' }}>
                {message.direction === 'in' ? (
                  <View style={styles.messageReceived}>
                    <Text>{message.channelmessage}</Text>
                    <Text style={[styles.messageTime, { textAlign: 'left' }]}>{message.timestamp}</Text>
                  </View>
                ) : (
                  <View style={styles.messageSent}>
                    <Text style={styles.messageSentText}>{message.channelmessage}</Text>
                    <Text style={[styles.messageTime, { textAlign: 'right' }]}>{message.timestamp}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  chatWindow: {
    padding: 10,
  },
  messageContainer: {
    marginVertical: 5,
  },
  messageReceived: {
    backgroundColor: '#e1ffc7',
    padding: 10,
    borderRadius: 5,
  },
  messageSent: {
    backgroundColor: '#d1e7ff',
    padding: 10,
    borderRadius: 5,
  },
  messageSentText: {
    color: '#000',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 5,
  },
});

export default ChatMessagesWindow;
