// all system commands exchanged either via
//  - WebRTC data channels
//  - Sockets
export enum SystemCommand {
    SYS_CMD_VIDEO_CHUNKS_SENT = 'video-chunks-sent',
    SYS_CMD_AUDIO_CHUNKS_SENT = 'audio-chunks-sent',

    // ----------------- streaming Calls -----------------
    SYS_CMD_INITIATE_CALL_CONNECTION = 'initiate-call-connection',
    SYS_CMD_INITIATED_CALL_CONNECTION = 'call-connection-initiated',
    SYS_CMD_CALL_CONNECTION_STARTED = 'call-connection-started',
    SYS_CMD_CALL_CONNECTION_STOPPED = 'call-connection-stopped',

    SYS_CMD_VIDEO_CALL_REQUESTED = 'video-call-requested',
    SYS_CMD_AUDIO_CALL_REQUESTED = 'audio-call-requested',

    SYS_CMD_GROUP_VIDEO_CALL_REQUESTED = 'group-video-call-requested',
    SYS_CMD_GROUP_AUDIO_CALL_REQUESTED = 'group-audio-call-requested',

    SYS_CMD_VIDEO_CALL_REQUEST_TIMEOUT = 'video-call-request-timeout',
    SYS_CMD_AUDIO_CALL_REQUEST_TIMEOUT = 'audio-call-request-timeout',

    SYS_CMD_VIDEO_CALL_REQUEST_REJECTED = 'video-call-request-rejected',
    SYS_CMD_AUDIO_CALL_REQUEST_REJECTED = 'audio-call-request-rejected',

    SYS_CMD_VIDEO_CALL_REQUEST_ACCEPTED = 'video-call-request-accepted',
    SYS_CMD_AUDIO_CALL_REQUEST_ACCEPTED = 'audio-call-request-accepted',

    SYS_CMD_VIDEO_CALL_STARTED = 'video-call-started',
    SYS_CMD_AUDIO_CALL_STARTED = 'audio-call-started',

    SYS_CMD_VIDEO_CALL_USER_LEFT = 'video-call-user-left',
    SYS_CMD_AUDIO_CALL_USER_LEFT = 'audio-call-user-left',

    SYS_CMD_VIDEO_CALL_ENDED = 'video-call-ended',
    SYS_CMD_AUDIO_CALL_ENDED = 'audio-call-ended',

    SYS_CMD_VIDEO_CALL_ALL_USERS_LEFT = 'video-call-all-users-left',
    SYS_CMD_AUDIO_CALL_ALL_USERS_LEFT = 'audio-call-all-users-left',

    // ----------------- Participants -----------------
    SYS_CMD_USER_VIDEO_HIDDEN = 'video-hidden',
    SYS_CMD_USER_AUDIO_MUTED = 'audio-muted',

    SYS_CMD_USER_VIDEO_MADE_VISIBLE = 'video-made-visible',
    SYS_CMD_USER_AUDIO_UNMUTED = 'audio-unmuted',

    // ----------------- User Join Request -----------------
    SYS_CMD_VIDEO_CALL_USER_JOIN_REQUEST = 'video-call-user-join-request',
    SYS_CMD_AUDIO_CALL_USER_JOIN_REQUEST = 'audio-call-user-join-request',

    SYS_CMD_VIDEO_CALL_USER_JOIN_REQUEST_TIMEOUT = 'video-call-user-join-request-timeout',
    SYS_CMD_AUDIO_CALL_USER_JOIN_REQUEST_TIMEOUT = 'audio-call-user-join-request-timeout',

    SYS_CMD_VIDEO_CALL_USER_JOIN_REQUEST_REJECTED = 'video-call-user-join-request-rejected',
    SYS_CMD_AUDIO_CALL_USER_JOIN_REQUEST_REJECTED = 'audio-call-user-join-request-rejected',

    SYS_CMD_VIDEO_CALL_USER_JOIN_REQUEST_ACCEPTED = 'video-call-user-join-request-accepted',
    SYS_CMD_AUDIO_CALL_USER_JOIN_REQUEST_ACCEPTED = 'audio-call-user-join-request-accepted',

    SYS_CMD_VIDEO_CALL_USER_JOINED = 'video-call-user-joined',
    SYS_CMD_AUDIO_CALL_USER_JOINED = 'audio-call-user-joined',
}