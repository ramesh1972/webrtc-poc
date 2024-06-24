import { group } from '@angular/animations';
import { Channel, WebRTCChannelType } from '../libs/webrtc/models/Channel';

const channelsJSON = [
    {
        id: 1,
        name: 'Ramesh Viswanathan'
    },
    {
        id: 2,
        name: 'Arunova Chakravarthy'
    },
    {
        id: 3,
        name: 'Soumen Sarkar'
    },
    {
        id: 4,
        name: 'John Smith'
    },
    {
        id: 5,
        name: 'Jane Doe'
    },
    {
        id: 6,
        type: WebRTCChannelType.GROUP,
        members: [1, 2, 5],
        name: 'Core Group'
    }
];

function getChannels(): Channel[] {
    return getDummyChannels();
}

function getDummyChannels(): Channel[] {
    // convert json array to ChannelList
    let userChannels: Channel[] = [];

    // create users first
    for (let i = 0; i < channelsJSON.length; i++) {

        if (channelsJSON[i].type === null || channelsJSON[i].type === undefined || channelsJSON[i].type === WebRTCChannelType.USER) {
            userChannels.push({
                id: channelsJSON[i].id.toString(),
                channelType: WebRTCChannelType.USER,
                name: channelsJSON[i].name,
                groupMembers: []
            });
        }
    }

    // create groups
    let groupChannels: Channel[] = [];
    for (let i = 0; i < channelsJSON.length; i++) {

        if (channelsJSON[i].type === WebRTCChannelType.GROUP) {
            const groupChannel = {
                id: channelsJSON[i].toString(),
                channelType: WebRTCChannelType.GROUP,
                name: channelsJSON[i].name,
                groupMembers: channelsJSON[i].members !== undefined && channelsJSON[i].members !== null ? createMemberList(userChannels, channelsJSON[i].members!) : undefined
            }

            groupChannels.push(groupChannel);
        }
    }

    let channels = userChannels.concat(groupChannels);
    console.log("channels in store=" + channels.length);
    return channels;
}

function createMemberList(allUsers: Channel[], members: number[]): Channel[] {
    let memberList: Channel[] = [];
    for (let i = 0; i < members.length; i++) {
        memberList.push(getChannelById(allUsers, members[i].toString())!);
    }

    return memberList;
}

function getChannelById(allUsers: Channel[], id: string): Channel | undefined {
    return allUsers.find(channel => channel.id === id);
}

export default getChannels;