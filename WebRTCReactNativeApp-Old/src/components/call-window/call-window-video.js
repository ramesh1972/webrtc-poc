import { View, Text, StyleSheet, Platform, Pressable } from "react-native";
import React, { useEffect, useState } from "react";
import { useTheme } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { mediaDevices, RTCView } from "react-native-webrtc";
import { Colors, Icons, Images, hp, wp } from "../../constants";
import AppText from "../app-text";
import AppImage from "../app-image";

import {
  widthPercentageToDP,
  heightPercentageToDP,
} from "react-native-responsive-screen";

import { get, set } from "lodash";
import { call } from "react-native-reanimated";
import { checkPluginState } from "react-native-reanimated/lib/reanimated2/core";

import colabLog from "../../libs/webrtc/utils/colabLog";

import { setCallInfo, setNewRemoteStreamConnected } from "../../redux/actions/call-action";
import WebRTCHandler from '../../libs/webrtc/WebRTCHandler';
import { WebRTCDataChannelLabel, WebRTCDataChannelType, WebRTCDataChannelStreamType } from '../../libs/webrtc/models/DataChannelLabel';
import { CALL_EVENTS, getClosedCallInfo } from "../call-strip/call-events";

const CallWindowVideo = (props) => {
  console.log('CallWindowVideo props', props);

  const dispatch = useDispatch();

  // store
  const { webRTCHandler, callInfo } = new useSelector((state) => state.callState);

  console.debug('CallWindowVideo webRTCHandler', webRTCHandler);

  // state
  const [isVideoStreamingOn, setIsVideoStreamingOn] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [videoStreamingDCLabel, setVideoStreamingDCLabel] = useState(null);
  const [members, setMembers] = useState([]);

  // ui related
  const { colors } = useTheme();
  const wp =
    widthPercentageToDP("100%") < heightPercentageToDP("100%")
      ? widthPercentageToDP
      : heightPercentageToDP;
  const hp =
    widthPercentageToDP("100%") > heightPercentageToDP("100%")
      ? widthPercentageToDP
      : heightPercentageToDP;

  // effect init
  useEffect(() => {
    console.log('CallWindowVideo useEffect init');

    if (props.onGoingCallInfo !== null && props.onGoingCallInfo !== undefined) {
      console.log(props.onGoingCallInfo.fromChannel?.name, ' --> CallWindowVideo useEffect onGoingCallInfo', props.onGoingCallInfo);
      console.log(props.onGoingCallInfo.fromChannel?.name, ' --> CallWindowVideo useEffect onGoingCallInfo event', props.onGoingCallInfo.event);

      if (props.onGoingCallInfo.event === CALL_EVENTS.outgoing) {
        console.log('CallWindowVideo useEffect event outgoing');

        const isSuccess = handleVideoStreamingByIntiator(props.onGoingCallInfo);

        if (isSuccess) {
          console.log('CallWindowVideo useEffect handleVideoStreamingByIntiator completed');
        } else {
          console.error('CallWindowVideo useEffect handleVideoStreamingByIntiator failed', error);
        }
      }
      else if (props.onGoingCallInfo.event === CALL_EVENTS.incoming) {
        console.log('CallWindowVideo useEffect event incoming');

        const isSuccess = handleVideoStreamingByReceiver(props.onGoingCallInfo);

        if (isSuccess) {
          console.log('CallWindowVideo useEffect handleVideoStreamingByReceiver completed');
        } else {
          console.error('CallWindowVideo useEffect handleVideoStreamingByReceiver failed', error);
        }
      }
    }
  }, [props.onGoingCallInfo]);

  useEffect(() => {
    console.log('CallWindowVideo useEffect props.OnGoingCallInfo.event');

    if (props.onGoingCallInfo !== null && props.onGoingCallInfo !== undefined) {
      console.log(props.onGoingCallInfo.fromChannel?.name, ' --> CallWindowVideo useEffect onGoingCallInfo', props.onGoingCallInfo);
      console.log(props.onGoingCallInfo.fromChannel?.name, ' --> CallWindowVideo useEffect onGoingCallInfo event', props.onGoingCallInfo.event);

      if (props.onGoingCallInfo.event === CALL_EVENTS.disconnecting) {
        console.log('---------------------------------------> CallWindowVideo useEffect event disconnecting');
        StopStreaming(false);
      }
    }
  }, [props.onGoingCallInfo?.event]);

  // IMPORTANT: handle video streaming setup and call
  // when the current user clicks on the video call button
  async function handleVideoStreamingByIntiator(callingInfo) {
    console.log(callingInfo?.fromChannel?.name, ' --> CallWindowVideo: Starting video streaming');

    if (videoStreamingDCLabel !== null && videoStreamingDCLabel !== undefined) {
      console.log('CallWindowVideo: Video streaming already on');
      return false;
    }

    if (webRTCHandler === null) {
      console.error('WebRTC handler not found');
      return false;
    }

    if (callingInfo === null || callingInfo === undefined) {
      console.error('Calling info is null');
      return false;
    }

    // create the video channel label
    console.log(callingInfo?.fromChannel?.name, ' --> CallWindowVideo: You are the initiator of the call');

    // create this user's side of the peer connection
    // NOTE: the data used here is from callInfo which is set on call button click in chat header component
    await webRTCHandler.ConnectDataChannel(WebRTCDataChannelType.P2P, 1,
      callingInfo?.fromChannel, callingInfo?.toChannel, WebRTCDataChannelStreamType.VIDEO).then(async (videoStreamingDataChannelLabel) => {
        if (videoStreamingDataChannelLabel === null || videoStreamingDataChannelLabel === undefined) {
          console.error('CallWindowVideo: videoStreamingDataChannelLabel is null');
          return false;
        }
        else {
          colabLog(videoStreamingDataChannelLabel, 'CallWindowVideo: videoStreamingDataChannelLabel', videoStreamingDataChannelLabel.dataChannelName);
          colabLog(videoStreamingDataChannelLabel, 'CallWindowVideo: from User', videoStreamingDataChannelLabel.fromChannel?.id);

          // set it prt of the state used for stopping the video streaming
          setVideoStreamingDCLabel(videoStreamingDataChannelLabel);

          // setup and handle video streaming callbacks when the other peer accepts the video call
          // set remoteStream on receive remote stream callback
          webRTCHandler.SetMediaStreamReceiveCallback(videoStreamingDataChannelLabel, receiveRemoteStream);

          // start the video streaming setup and call
          // get access to camera and microphone
          var strm = await mediaDevices.getUserMedia({
            audio: true,
            video: { width: 320, height: 320 }
          });

          console.debug('CallWindowVideo: handleVideoStreaming: local stream', strm);
          setLocalStream(strm);
          setRemoteStream(null);

          // init the event handlers for peer connection callbacks
          await webRTCHandler.Init(true, videoStreamingDataChannelLabel, strm).then(async (isSuccess) => {
            console.log(videoStreamingDataChannelLabel.toChannel?.name, ' --> CallWindowVideo: handleVideoStreaming: Init', isSuccess);

            // set the initiate video streaming callback which is called when the other peer accepts the video call
            webRTCHandler.SetStartCallCallBack(videoStreamingDataChannelLabel, initiateVideoStreamingHandler);

            // this callback will be called when peer sends call stopped message
            webRTCHandler.SetStopCallCallBack(videoStreamingDataChannelLabel, StopStreaming);

            // send to the other peer that the call is initiated on my end
            webRTCHandler.SendInitiateCallMessage(videoStreamingDataChannelLabel);

            colabLog(videoStreamingDataChannelLabel, 'CallWindowVideo: completed handleVideoStreamingByIntiator');

            return true;
          }).catch((error) => {
            console.error('CallWindowVideo: Init failed', error);
            console.error('CallWindowVideo: Video streaming setup failed at the initiator end');
            return false;
          });
        }
      }).catch((error) => {
        console.error('CallWindowVideo: ConnectDataChannel failed', error);
        console.error('CallWindowVideo: Video streaming setup failed at the initiator end');
        return false;
      });
  }

  async function handleVideoStreamingByReceiver(callingInfo) {
    console.log(callingInfo?.toChannel?.name, ' --> CallWindowVideo: You are the receiver of the call');

    if (videoStreamingDCLabel !== null && videoStreamingDCLabel !== undefined) {
      console.log('CallWindowVideo: Video streaming already on');
      return false;
    }

    if (callingInfo === null || callingInfo === undefined) {
      console.error('callinginfo is null in receiver end');
      return false
    }

    await webRTCHandler.ConnectDataChannel(WebRTCDataChannelType.P2P, 1,
      callingInfo?.fromChannel, callingInfo?.toChannel, WebRTCDataChannelStreamType.VIDEO).then(async (videoStreamingDataChannelLabel) => {
        if (videoStreamingDataChannelLabel === null || videoStreamingDataChannelLabel === undefined) {
          console.error('CallWindowVideo: videoStreamingDataChannelLabel is null');
          return false;
        }
        else {
          colabLog(videoStreamingDataChannelLabel, 'CallWindowVideo: videoStreamingDataChannelLabel', videoStreamingDataChannelLabel.dataChannelName);

          // set it prt of the state used for stopping the video streaming
          setVideoStreamingDCLabel(videoStreamingDataChannelLabel);

          // start the video streaming setup and call
          // get access to camera and microphone
          var strm = await mediaDevices.getUserMedia({
            audio: true,
            video: { width: 320, height: 320 }
          });

          console.debug('CallWindowVideo: handleVideoStreaming: local stream', strm);
          setLocalStream(strm);
          setRemoteStream(null);

          // setup and handle video streaming callbacks when the other peer accepts the video call
          // set remoteStream on receive remote stream callback
          webRTCHandler.SetMediaStreamReceiveCallback(videoStreamingDataChannelLabel, receiveRemoteStream);

          // init the connetion
          //await webRTCHandler.Init(videoStreamingDataChannelLabel, strm)
          await webRTCHandler.Init(false, videoStreamingDataChannelLabel, strm).then(async (isSuccess) => {
            console.log(videoStreamingDataChannelLabel.toChannel?.name, ' --> CallWindowVideo: handleVideoStreaming: Init', isSuccess);

            // this callback will be called when peer sends call started message
            webRTCHandler.SetStartCallCallBack(videoStreamingDataChannelLabel, initiateVideoStreaming);

            // this callback will be called when peer sends call stopped message
            webRTCHandler.SetStopCallCallBack(videoStreamingDataChannelLabel, StopStreaming);

            // let the peer know that the call is initiated on my end
            webRTCHandler.SendCallInitiatedlMessage(videoStreamingDataChannelLabel);

            colabLog(videoStreamingDataChannelLabel, 'CallWindowVideo: completed handleVideoStreamingByReceiver');
            return true;
          }).catch((error) => {
            console.error('CallWindowVideo: Init failed', error);
            console.error('CallWindowVideo: Video streaming setup failed at the receiver end');
            return false;
          });
        }
      }).catch((error) => {
        console.error('CallWindowVideo: ConnectDataChannel failed', error);
        console.error('CallWindowVideo: Video streaming setup failed at the initiator end');
        return false;
      });
  }

  async function initiateVideoStreamingHandler(videoStreamingDataChannelLabel) {
    console.log(videoStreamingDataChannelLabel.toChannel?.name, ' --> CallWindowVideo: In initiateVideoStreamingHandler');

    await initiateVideoStreaming(videoStreamingDataChannelLabel).then((isSuccess) => {

      console.log(videoStreamingDataChannelLabel.toChannel?.name, ' --> CallWindowVideo: initiateVideoStreamingHandler: initiated video streaming');

      webRTCHandler.SendCallStartedMessage(videoStreamingDataChannelLabel);

    }).catch((error) => {
      console.error(videoStreamingDataChannelLabel.toChannel?.name, ' --> CallWindowVideo: initiateVideoStreamingHandler: failed to initiate video streaming', error);
    });
  }

  // initiate video streaming
  async function initiateVideoStreaming(videoStreamingDataChannelLabel) {
    console.log(videoStreamingDataChannelLabel.toChannel?.name, ' -- >CallWindowVideo: In initiateVideoStreaming');

    colabLog(videoStreamingDataChannelLabel, 'CallWindowVideo: initiateVideoStreaming: isvideostreamingon', isVideoStreamingOn);

    if (isVideoStreamingOn) {
      console.log('CallWindowVideo: Video streaming already on');
      return false;
    }

    if (videoStreamingDataChannelLabel === null || videoStreamingDataChannelLabel === undefined) {
      console.error('CallWindowVideo: videoStreamingDataChannelLabel is null');
      return false;
    }

    console.debug(videoStreamingDataChannelLabel.toChannel?.name, ' --> CallWindowVideo: initiateVideoStreaming: videoStreamingDataChannelLabel', videoStreamingDataChannelLabel?.dataChannelName);

    // !!! initiate video streaming
    await webRTCHandler?.StartVideoStreaming(videoStreamingDataChannelLabel).then((isSuccess) => {
      console.log(videoStreamingDataChannelLabel.toChannel?.name, ' --> CallWindowVideo: initiateVideoStreaming: StartVideoStreaming', isSuccess);
    }).catch((error) => {
      console.error(videoStreamingDataChannelLabel.toChannel?.name, ' --> CallWindowVideo: initiateVideoStreaming: StartVideoStreaming failed', error);
    });

    //    if (isSuccess == true) {
    setIsVideoStreamingOn(true);

    console.log(videoStreamingDataChannelLabel.toChannel?.name, 'Video streaming setup completed!!!!');

    return true;
    // TODO: to check the reture value
  /*   } else {
      console.error(videoStreamingDataChannelLabel.fromChannel?.name, ' --> Video streaming setup failed');
      setIsVideoStreamingOn(false);
      return false;
    }
 */  }

  // callback from webrtc handler when remote stream is created/received from the peer
  function receiveRemoteStream(remoteStream) {
    console.log('CallWindowVideo: receiveRemoteStream: OnRemoteStream', remoteStream);

    //const newMember = {};
    //newMember.stream = remoteStream;

    setRemoteStream(remoteStream);
    console.log('CallWindowVideo: receiveRemoteStream: remoteStream is set');
  }

  // called when cancel or leave button is clicked on the call strip
  function StopStreaming(force) {
    console.log('CallWindowVideo: Stopping video streaming');

    colabLog(videoStreamingDCLabel, 'CallWindowVideo: StopStreaming: isvideostreamingon', isVideoStreamingOn);

    if (!force && !isVideoStreamingOn) {
      console.log('CallWindowVideo: Video streaming already off');
    }
    else if (webRTCHandler === null) {
      console.error('WebRTC handler not found');
    }
    else {
      console.log('CallWindowVideo: Stopping video streaming');

      if (webRTCHandler.IsConnected()) {
        
        // before you destroy yourself, send a message to your peer 
        if (videoStreamingDCLabel !== null && videoStreamingDCLabel !== undefined) {
          colabLog(videoStreamingDCLabel, 'CallWindowVideo: signaling to the peer to stop video streaming');
          webRTCHandler.SendCallStoppedMessage(videoStreamingDCLabel);
        }

        // start shutdown process
        const isStopped = webRTCHandler?.StopVideoStreaming();
        console.log('CallWindowVideo: StopVideoStreaming', isStopped);

        if (isStopped) {
          setIsVideoStreamingOn(false);
          console.log('CallWindowVideo: StopStreaming isVideoStreamingOn', isVideoStreamingOn);

          DestroyStreams();

          setMembers([]);
          setVideoStreamingDCLabel(null);

          const closedCallInfo = getClosedCallInfo(videoStreamingDCLabel);
          dispatch(setCallInfo(closedCallInfo));

          console.log('Video streaming stopped');
        }
        else {
          console.error('Video streaming stop failed');
        }
      }
      else
        colabLog(videoStreamingDCLabel, 'CallWindowVideo: StopStreaming: already disconnected');
    }
  }

  function DestroyStreams() {
    console.log('CallWindowVideo: Destroying streams');

    if (localStream !== null) {
      localStream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    if (remoteStream !== null) {
      remoteStream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    setLocalStream(null);
    setRemoteStream(null);
  }

  // rendeer UI based on members list and their streams set at different stages of connection
  return (
    <View style={{
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "center",
      width: '100%',
      height: 320,
    }}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          width: 220,
          height: 160,
        }}
      >
        {localStream && <RTCView style=
          {{
            width: 220,
            height: 150,
            borderColor: 'red',
            borderWidth: 4
          }}
          mirror={true}
          streamURL={localStream.toURL()}
        />}
      </View>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          width: 220,
          height: 160,
        }}
      >
        {remoteStream && <RTCView style=
          {{
            width: 220,
            height: 150,
            borderColor: 'red',
            borderWidth: 4
          }}
          mirror={true}
          streamURL={remoteStream.toURL()} />}

      </View>
    </View>
  );
}

export default CallWindowVideo;