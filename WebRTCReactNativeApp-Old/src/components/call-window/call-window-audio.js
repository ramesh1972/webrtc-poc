import { View, Text, StyleSheet, Platform, Pressable } from "react-native";
import React, { useState } from "react";
import { useTheme } from "@react-navigation/native";

import AppText from "../app-text";
import AppImage from "../app-image";

import WebRTCHandler from '../../libs/webrtc/WebRTCHandler';
import { WebRTCDataChannelLabel, WebRTCDataChannelType, WebRTCDataChannelStreamType } from '../../libs/webrtc/models/DataChannelLabel';
import { Channel } from '../../libs/webrtc/models/Channel';

export default function CallWindowAudio(props) {
  console.log('CallWindowAudio props', props);

  const { colors } = useTheme();

  const [members, setMembers] = useState([]);
  const webRTCHandler = props.webRTCHandler;

  //const audioStreamingDataChannelLabel = webRTCHandler?.ConnectStreamDataChannel(WebRTCDataChannelType.P2P, WebRTCDataChannelStreamType.AUDIO, 1, channelfrom, channelto);

  // View related methods
  const renderItem = ({ item, index }) => {
    return (
      <View
        key={String(index)}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: wp("5%"),
        }}
      >
        <AppImage
          size={wp("25%")}
          source={
            item?.userpicture ? { uri: item?.userpicture } : Icons.userthumbnail
          }
          isRounded={true}
          style={{ marginBottom: hp("1%") }}
        />
        <AppText numberOfLines={1} size={hp("1.7%")}>
          {item?.fname ? item?.fname + " " + item?.lname : `User ${index + 1}`}
        </AppText>
      </View>
    );
  };

  const renderMembersView = () => {
    switch (members?.length) {
      case 1:
        return (
          <View style={{ flex: 1, paddingBottom: wp("25%") }}>
            {renderItem({ item: members[0], index: 0 })}
          </View>
        );

      case 2:
        return (
          <View style={{ flex: 1, paddingBottom: wp("25%") }}>
            {renderItem({ item: members[0], index: 0 })}
            {renderItem({ item: members[1], index: 1 })}
          </View>
        );

      default:
        return (
          <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap" }}>
            {members.slice(0, 6).map((item, index) => {
              return (
                <View
                  key={item?.id}
                  style={{ width: wp("50%"), height: "33%" }}
                >
                  {renderItem({ item: item, index: index })}
                </View>
              );
            })}
          </View>
        );
    }
  };

  return (
    <View style={{ flex: 1 }}>{renderMembersView()}</View>
  );
}