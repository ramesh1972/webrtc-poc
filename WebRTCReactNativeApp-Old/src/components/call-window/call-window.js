import React, { useState } from 'react';
import { View } from 'react-native';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useDispatch } from 'react-redux';

import {
	CALL_EVENTS, getIncomingCallInfo
} from "../call-strip/call-events";

import CallWindowAudio from './call-window-audio';
import CallWindowVideo from './call-window-video';
import { CallStripChat } from '../call-strip';

import { set } from 'lodash';
import { call } from 'react-native-reanimated';

const CallWindow = (props) => {
	console.debug('CallWindow props', props);

	// basic props
	const { callInfo, webRTCHandler } = useSelector((state) => state.callState);
	console.debug('CallWindow callInfo', callInfo);

	const { currrentCollague } = useSelector((state) => state.colleagueState);

	// state
	const [isAudioCall, setIsAudioCall] = useState(false);
	const [isVideoCall, setIsVideoCall] = useState(false);

	const [inCommingCallInfo, setInCommingCallInfo] = useState(null);
	const [onGoingCallInfo, setOnGoingCallInfo] = useState(null);

	useEffect(() => {
		console.log('CallWindow useEffect init');

		setIsAudioCall(false);
		setIsVideoCall(false);

		// set callback for receiver to handle incoming call
		webRTCHandler?.SetCallReceivedCallBack(callReceived);

	}, []);

	// effect actions on change in callInfo
	useEffect(() => {
		console.log('CallWindow useEffect callInfo', callInfo);

		if (callInfo !== null && callInfo !== undefined && callInfo?.event === CALL_EVENTS.outgoing) {
			console.log('callInfo event is outgoing');
			if (callInfo?.callType === 'audio') {
				setIsAudioCall(true);
				setIsVideoCall(false);
			}
			else if (callInfo?.callType === 'video') {
				setIsAudioCall(false);
				setIsVideoCall(true);
			}

			setOnGoingCallInfo(callInfo); // initiator of call
		}
		else if (onGoingCallInfo !== null && onGoingCallInfo !== undefined) {
			console.debug('registerProperties onGoingCallInfo', onGoingCallInfo);

			if (onGoingCallInfo.event === CALL_EVENTS.incoming) {
				console.debug('registerProperties onGoingCallInfo CALL_EVENTS.incoming');

				if (onGoingCallInfo?.callType === 'audio') {
					setIsAudioCall(true);
					setIsVideoCall(false);
				}
				else if (onGoingCallInfo?.callType === 'video') {
					setIsAudioCall(false);
					setIsVideoCall(true);
				}
			}
		}
		else if (callInfo === null || callInfo.event === 'closed') { // handle call closed event
			console.log('callInfo is null or call is closed');

			setIsAudioCall(false);
			setIsVideoCall(false);
			setOnGoingCallInfo(null);
		}
	}, [callInfo, callInfo?.event, onGoingCallInfo]);

	function callReceived(dataChannel) {
		// do the UI stuff of showing call strip with Accept button in current window or global strip
		console.log(dataChannel?.toChannel?.name, ' --> CallWindow callReceived');

		console.log(dataChannel?.toChannel?.name, ' --> CallWindow callReceived: video call is set to true');

		// set the call event to incoming
		let callingInfo = getIncomingCallInfo(dataChannel);
		console.log('callReceived callingInfo', callingInfo);

		// trigger useEffect to receive call
		setOnGoingCallInfo(callingInfo); // TODO to see why dipatchCallInfo doesnt' work

		setIsVideoCall(true);
		setIsAudioCall(false);
	}

	return (
		<View style={{ flex: 1, backgroundColor: 'red' }}>
			{(isVideoCall || isAudioCall) && (
				<View style={{ flex: 1 }}>
					<CallStripChat />
					<View style={{ flex: 1, backgroundColor: 'yellow' }}>
						{isAudioCall && <CallWindowAudio onGoingCallInfo={onGoingCallInfo} />}
						{isVideoCall && <CallWindowVideo onGoingCallInfo={onGoingCallInfo} />}
					</View>
				</View>
			)}
		</View>
	);
}

export default CallWindow;