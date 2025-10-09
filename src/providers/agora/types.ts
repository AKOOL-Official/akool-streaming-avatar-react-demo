import { IAgoraRTCClient } from 'agora-rtc-sdk-ng';

export interface RTCClient extends IAgoraRTCClient {
  sendStreamMessage(msg: Uint8Array | string, flag: boolean): Promise<void>;
}
