import { View, Text, StyleSheet, Pressable } from "react-native";
import React from "react";

import { CALL_EVENTS, Colors, FontTypes, Icons, hp, wp } from "../../constants";
import { useTheme } from "@react-navigation/native";
import AppText from "../app-text";
import AppImage from "../app-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { navigate } from "../../navigation/root-navigation";

export default function CallStripGlobal() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { callInfo } = useSelector((state) => state.chatState);

  //onPress event for global strip press
  const onGlobalCallHeaderPress = () => {
    console.log("onGlobalCallHeaderPress");
    navigate("OngoingCallScreen");
  };
  //to set the callers name
  const userName = () => {
    let userName = "Paul Smith";
    return userName;
  };
  //to set the total call time
  const callTimeCount = () => {
    let totalTime = "2:30";
    return totalTime;
  };

  return (
    <Pressable
      style={[styles.root, { backgroundColor: colors.green }]}
      onPress={onGlobalCallHeaderPress}
    >
      <View
        style={{
          height: insets.top,
          width: "100%",
          backgroundColor: colors.black,
        }}
      />
      <View style={[styles.rowcenter, { padding: 10 }]}>
        <AppImage
          source={Icons.phone_white}
          size={hp("1.5%")}
          tintColor={Colors.white}
          style={{ marginEnd: wp("2%") }}
        />
        <AppText
          size={hp("1.5%")}
          color={Colors.white}
          fontType={FontTypes.bold}
        >
          {callInfo?.event === CALL_EVENTS.incoming
            ? `${userName()}`
            : `${userName()}: Call in progress ${callTimeCount()}`}
        </AppText>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  root: {
    width: "100%",
    // height: hp("4.48%"),
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {},
  rowcenter: {
    flexDirection: "row",
    alignItems: "center",
  },
});
