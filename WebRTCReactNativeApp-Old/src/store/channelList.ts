import { Channel, ChannelType } from '../libs/webrtc/models/Channel';

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
    }
];

function getChannels() : Channel[]{
    return getDummyChannels();
}

function getDummyChannels() : Channel[] {
    // convert json array to ChannelList
    let channels: Channel[] = [];
    for (let i = 0; i < channelsJSON.length; i++) {
        channels.push({
            id: channelsJSON[i].id,
            channelType: ChannelType.P2P,
            name: channelsJSON[i].name
        });
    }

    console.log("channels in store=" + channels.length);
    return channels;
}

export default getChannels;