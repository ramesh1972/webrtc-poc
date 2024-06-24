import { View, Text, StyleSheet, Platform, Pressable } from "react-native";
import React, { useState } from "react";
import {
  CALL_EVENTS,
  Colors,
  DIMENSIONS,
  Icons,
  hp,
  wp,
} from "../../constants";
import { useTheme } from "@react-navigation/native";
import AppText from "../app-text";
import { TouchableOpacity } from "react-native-gesture-handler";
import AppImage from "../app-image";
import { Menu } from "react-native-material-menu";
import { useDispatch, useSelector } from "react-redux";
import { setCallInfo } from "../../redux/actions/chat-action";

export default function CallStripChat() {
  const { colors } = useTheme();

  const dispatch = useDispatch();

  const { currentTeam } = useSelector((state) => state.teamState);
  const { callInfo } = useSelector((state) => state.chatState);

  const isCaller = currentTeam ? true : false;

  const [isLeaveCallMenuVisible, setIsLeaveCallMenuVisible] = useState(false);

  const text = () => {
    switch (callInfo?.event) {
      case CALL_EVENTS.outgoing:
        return "Calling...";
      case CALL_EVENTS.incoming:
        return "Incoming Call...";
      case CALL_EVENTS.activeconnected:
        return "Call in Progress";
      case CALL_EVENTS.activenotconnected:
        return "Call in Progress";
      case CALL_EVENTS.reconnecting:
        return "Reconnecting...";
      default:
        return "";
    }
  };

  const buttonTitle = () => {
    switch (callInfo?.event) {
      case CALL_EVENTS.outgoing:
        return "Cancel";
      case CALL_EVENTS.incoming:
        return "Join";
      case CALL_EVENTS.activeconnected:
        return "Leave";
      case CALL_EVENTS.activenotconnected:
        return "Join";
      case CALL_EVENTS.reconnecting:
        return "Leave";
      default:
        return "";
    }
  };

  const onButtonPress = () => {
    if (isCaller && callInfo?.event != CALL_EVENTS.outgoing) {
      setIsLeaveCallMenuVisible(true);
    } else {
      dispatch(setCallInfo(null));
    }
    console.log("onButtonPress");
  };

  const onLeavePress = () => {
    console.log("onLeavePress");
    setIsLeaveCallMenuVisible(false);
    dispatch(setCallInfo(null));
  };

  const onEndCallPress = () => {
    console.log("onEndCallPress");
    setIsLeaveCallMenuVisible(false);
    dispatch(setCallInfo(null));
  };

  if (callInfo) {
    return (
      <View style={[styles.root, { backgroundColor: colors.toast_bg }]}>
        <AppText size={hp("1.8%")}>{text()}</AppText>
        <View>
          <Menu
            visible={isLeaveCallMenuVisible}
            style={{
              backgroundColor: colors.transparent,
              elevation: 0,
            }}
            anchor={
              <TouchableOpacity
                style={[
                  styles.buttonContainer,
                  {
                    backgroundColor:
                      buttonTitle() == "Join"
                        ? Colors.green
                        : colors.file_upload_error,
                  },
                ]}
                onPress={onButtonPress}
              >
                <AppText size={hp("1.8%")} color={Colors.white}>
                  {buttonTitle()}
                </AppText>
                {isCaller && callInfo?.event != CALL_EVENTS.outgoing ? (
                  <AppImage
                    size={wp("3.07%")}
                    source={Icons.back_arrow}
                    style={{
                      transform: [{ rotate: "270deg" }],
                      marginStart: 10,
                    }}
                  />
                ) : null}
              </TouchableOpacity>
            }
            onRequestClose={() => setIsLeaveCallMenuVisible(false)}
          >
            <View
              style={[
                styles.menu,
                { backgroundColor: colors.leave_call_menu_bg },
              ]}
            >
              <Pressable style={styles.iconTitleRow} onPress={onLeavePress}>
                <AppImage
                  size={wp("4%")}
                  source={Icons.phone_white}
                  tintColor={colors.white}
                  style={{
                    marginEnd: wp("3%"),
                    transform: [{ rotate: "135deg" }],
                  }}
                />
                <AppText>{"Leave"}</AppText>
              </Pressable>
              <Pressable
                style={[styles.iconTitleRow, { paddingTop: wp("3%") }]}
                onPress={onEndCallPress}
              >
                <AppImage
                  size={wp("4%")}
                  source={Icons.phone_white}
                  tintColor={colors.white}
                  style={{
                    marginEnd: wp("3%"),
                    transform: [{ rotate: "135deg" }],
                  }}
                />
                <AppText>{"End Call"}</AppText>
              </Pressable>
            </View>
          </Menu>
        </View>
      </View>
    );
  }
  return <></>;
}
const styles = StyleSheet.create({
  root: {
    width: "100%",
    paddingVertical: hp("1.28%"),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: wp("3%"),
  },
  buttonContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: wp("5%"),
    paddingVertical: wp("1.5%"),
    borderRadius: DIMENSIONS.WIDTH,
  },
  menu: {
    padding: wp("2%"),
    borderRadius: wp("2%"),
    marginTop: Platform.OS === "ios" ? hp("4%") : hp("4.5%"),
    marginEnd: hp("1%"),
  },
  iconTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: wp("1%"),
    paddingVertical: wp("1.5%"),
  },
});
