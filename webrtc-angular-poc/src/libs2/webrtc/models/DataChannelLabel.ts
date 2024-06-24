import { Channel } from './Channel';


export enum WebRTCDataChannelType {
    P2P = "p2p",
    GROUP = "group",
    TEMP_GROUP = "temp-group",
    BROADCAST = "broadcast"
}

export enum WebRTCDataChannelStreamType {
    NONE = "none",
    AUDIO = "audio",
    VIDEO = "video",
    SCREEN = "screen"
}

export class WebRTCDataChannelLabel {
    tenantId?: number;
    dataChannelType?: WebRTCDataChannelType;
    fromChannel?: Channel; // if GROUP, then fromChannel is the group id and toChannel is the group user id
    // if BRAODCAST, then fromChannel is the broadcaster group id 
    toChannel?: Channel;
    otherChannels?: Channel[]; // other channels that are added on the fly to the group/stream group
    dataChannelName?: string;

    streamType?: WebRTCDataChannelStreamType;

    constructor(dataChannelType: WebRTCDataChannelType, tenantId: number, fromChannel?: Channel, toChannel?: Channel, streamType: WebRTCDataChannelStreamType = WebRTCDataChannelStreamType.NONE) {
        this.dataChannelType = dataChannelType;

        this.tenantId = tenantId;
        this.fromChannel = fromChannel;
        this.toChannel = toChannel;

        this.streamType = streamType;

        this.dataChannelName = this.createDataChannelId()
    }

    private createDataChannelId() {
        // set tenant part of the data channel name
        if (this.tenantId === null || this.tenantId === undefined) {
            console.error('createDataChannelId: Invalid tenant id');
            return;
        }

        this.dataChannelName = "tenant-" + this.tenantId;


        // set the stream type part of the data channel name, if any
        if (this.streamType !== null && this.streamType !== undefined)
            if (this.streamType !== WebRTCDataChannelStreamType.NONE)
                this.dataChannelName += "-stream-" + this.streamType;
            else
                this.dataChannelName += "-data";

        // if dataChannelType is P2P, then fromChannel is the lesser user id and toChannel is the greater user id
        // if dataChannelType is GROUP, then fromChannel is the group id and its channel type is GROUP
        // if dataChannelType is BRAODCAST, then fromChannel is the broadcaster group id and its channel type is BROADCAST
        if (this.dataChannelType === null || this.dataChannelType === undefined) {
            console.error('createDataChannelId: Invalid data channel type');
            return;
        }

        if (this.dataChannelType === WebRTCDataChannelType.P2P) {
            if (this.fromChannel === null || this.fromChannel === undefined || this.toChannel === null || this.toChannel === undefined) {
                console.error('createDataChannelId: Invalid channel ids');
                return;
            }

            let fromChannelId = this.fromChannel.id;
            let toChannelId = this.toChannel.id;

            // create the same id for the pair of users which is p2p-usr-lesseruseridnumber-usr-greateruseridnumber
            const firstId = fromChannelId <= toChannelId ? fromChannelId : toChannelId
            const secondId = firstId === toChannelId ? fromChannelId : toChannelId;

            this.dataChannelName += "-p2p-" + "usr-" + firstId + "-" + "usr-" + secondId;
            console.log('createDataChannelId: P2P channel name:', this.dataChannelName);
        }
        else if (this.dataChannelType === WebRTCDataChannelType.GROUP) {
            if (this.fromChannel === null || this.fromChannel === undefined) {
                console.error('createDataChannelId: Invalid group id channel');
                return;
            }

            let fromChannelId = this.fromChannel.id;
            this.dataChannelName += "-grp-" + fromChannelId;
        }
        else if (this.dataChannelType === WebRTCDataChannelType.BROADCAST) {
            if (this.fromChannel === null || this.fromChannel === undefined) {
                console.error('createDataChannelId: Invalid from braodacast channel');
                return;
            }

            let fromChannelId = this.fromChannel.id;
            this.dataChannelName += "-broadcast-" + fromChannelId;
        }
        else if (this.dataChannelType === WebRTCDataChannelType.TEMP_GROUP) {
            if (this.fromChannel === null || this.fromChannel === undefined || this.toChannel === null || this.toChannel === undefined) {
                console.error('createDataChannelId: Invalid channel ids');
                return;
            }

            let fromChannelId = this.fromChannel.id;
            let toChannelId = this.toChannel.id;

            // create the same id for the pair of users which is p2p-usr-lesseruseridnumber-usr-greateruseridnumber
            const firstId = fromChannelId <= toChannelId ? fromChannelId : toChannelId
            const secondId = firstId === toChannelId ? fromChannelId : toChannelId;

            this.dataChannelName += "-tempgrp-" + "usr-" + firstId + "-" + "usr-" + secondId;
        }

        return this.dataChannelName!;
    }
}