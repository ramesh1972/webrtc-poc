import { Channel } from './Channel';


export enum WebRTCDataChannelType {
    P2P = "p2p",
    GROUP = "group",
    BROADCAST = "broadcast"
}

export class WebRTCDataChannelLabel {
    tenantId?: number;
    dataChannelType?: WebRTCDataChannelType;
    fromChannel?: Channel; // if GROUP, then fromChannel is the group id and toChannel is the group user id
                           // if BRAODCAST, then fromChannel is the broadcaster group id 
    toChannel?: Channel;
    dataChannelName?: string;

    constructor(dataChannelType: WebRTCDataChannelType, tenantId: number, fromChannel?: Channel, toChannel?: Channel) {
        this.dataChannelType = dataChannelType;

        this.tenantId = tenantId;
        this.fromChannel = fromChannel;
        this.toChannel = toChannel;

        this.dataChannelName = this.createDataChannelId()
    }

    private createDataChannelId() {
        if (this.tenantId === null || this.tenantId === undefined) {
            console.error('createDataChannelId: Invalid tenant id');
            return;
        }

        if (this.fromChannel === null || this.fromChannel === undefined) {
            console.error('createDataChannelId: Invalid from channel');
            return;
        }


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

            this.dataChannelName = "tenant-" + this.tenantId + "-" + "usr-" + firstId + "-" + "usr-" + secondId;
        }
        else if (this.dataChannelType === WebRTCDataChannelType.GROUP) {
            if (this.fromChannel === null || this.fromChannel === undefined) {
                console.error('createDataChannelId: Invalid group id channel');
                return;
            }

            let fromChannelId = this.fromChannel.id;
            this.dataChannelName = "tenant-" + this.tenantId + "-" + "grp-" + fromChannelId;
        }
        else if (this.dataChannelType === WebRTCDataChannelType.BROADCAST) {
            if (this.fromChannel === null || this.fromChannel === undefined) {
                console.error('createDataChannelId: Invalid from braodacast channel');
                return;
            }

            let fromChannelId = this.fromChannel.id;
            this.dataChannelName = "tenant-" + this.tenantId + "-" + "broadcast-" + fromChannelId;
        }

        return this.dataChannelName!;
    }
}