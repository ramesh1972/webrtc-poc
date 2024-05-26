export class DataChannelService {
    private dataChannel: RTCDataChannel | null = null;
  
    constructor(private readonly peerConnection: RTCPeerConnection) {
      this.setupDataChannel(peerConnection);
    }
  
    private setupDataChannel(peerConnection: RTCPeerConnection) {
      this.dataChannel = peerConnection.createDataChannel('dataChannel');
  
      if (this.dataChannel) {
        this.dataChannel.onopen = () => {
          console.log('Data channel opened');
        };
  
        this.dataChannel.onclose = () => {
          console.log('Data channel closed');
        };
  
/*         this.dataChannel.onmessage = (event) => {
          console.log('Received message:', event.data);
        }; */
      }
    }
  
    public setChannel(channel: RTCDataChannel) {
        this.dataChannel = channel;
    }

    public SetMessageReceivedCallBack(callback: (event: MessageEvent) => void) {
      console.log('Setting message received callback');
      if (this.dataChannel) {
        console.log('Setting message received callback sucess');
        this.dataChannel.onmessage = callback;
      }
    }
    
    public sendData(message: string) {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(message);
      } else {
        console.warn('Data channel is not open');
      }
    }
  }
  