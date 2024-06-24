/* eslint-disable prettier/prettier */
/* eslint-disable react-native/no-inline-styles */
/* eslint-disable prettier/prettier */
import React, {Component} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';

import { Channel } from '../libs/webrtc/models/Channel';

interface Props {
  channelListType: string;
  selectedChannel: Channel;
  channelList: Channel[];
  headerText?: string;
  onChannelChange: (channel: any, channelType: string) => void; // Assuming there's an event to handle channel change
}

interface State {
  showChannelsPanel: boolean;
  selectedChannel?: Channel;
}

class ChannelList extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      showChannelsPanel: false,
    };
  }

  toggleChannelsPanel = () => {
    console.log('In toggleChannelsPanel');
    this.setState(prevState => ({
      showChannelsPanel: !prevState.showChannelsPanel,
    }));
  };

  async channelChanged(selChannel: Channel) {
    console.log('In channelChanged: ', selChannel);
    this.setState({
      selectedChannel: selChannel,
    });

    this.toggleChannelsPanel();
    await this.props.onChannelChange(selChannel, this.props.channelListType);
  }

  renderChannelItem = ({item}: ListRenderItemInfo<Channel>) => {
    const {selectedChannel} = this.props;
    console.log('selectedChannel', selectedChannel);
    console.log('item = ', item);

    return (
      <TouchableOpacity
        style={[
          styles.channelListItem,
          {
            backgroundColor:
              selectedChannel && item.name === selectedChannel.name
                ? 'rgba(0, 0, 255, 0.8)'
                : 'lightgray',
          },
        ]}
        onPress={() => this.channelChanged(item)}>
        <Text style={styles.channelListItemLabel}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  render() {
    let {showChannelsPanel} = this.state;
    const {channelList, headerText} = this.props;
    console.log('channelList=', channelList);

    return (
      <View style={styles.channelListContainer}>
        <Text style={styles.headerText}>{headerText}</Text>
        <TouchableOpacity
          style={styles.hamburgerButton}
          onPress={this.toggleChannelsPanel}>
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
        </TouchableOpacity>

        {showChannelsPanel && (
          <View style={styles.channelList}>
            <FlatList
              data={channelList}
              keyExtractor={item => item.id}
              renderItem={this.renderChannelItem}
            />
          </View>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  hamburgerButton: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    cursor: 'pointer',
    verticalAlign: 'middle',
    paddingTop: 5,
    color: 'white',
  },
  hamburgerLine: {
    width: 25,
    height: 2,
    backgroundColor: 'white',
    marginBottom: 4,
    color: 'white',
  },
  channelListContainer: {
    flex: 1,
    padding: 4,
    flexDirection: 'row',
  },
  headerText: {
    fontSize: 18,
    verticalAlign: 'middle',
    paddingRight: 20,
    color: 'white',
  },
  channelList: {
    opacity: 1,
    height: 300,
    zIndex: 99,
  },
  channelListLabel: {
    color: '#333',
    fontSize: 20,
    fontWeight: 'bold',
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 10,
  },
  channelListUl: {
    padding: 0,
  },
  channelListItem: {
    backgroundColor: 'rgba(0, 0, 255, 0.8)',
    cursor: 'pointer',
    padding: 5,
    fontSize: 16,
    height: 40,
    verticalAlign: 'middle',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 255, .2)',
    zIndex: 102,
  },
  channelListItemLabel: {
    color: 'black',
    fontSize: 16,
  },
  channelListItemActive: {
    backgroundColor: 'gray',
  },
});

export default ChannelList;
