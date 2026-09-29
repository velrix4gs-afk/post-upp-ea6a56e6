// The live calling path uses GetStream Video SDK. These legacy seams remain
// exported for compatibility, but fail closed rather than claiming a call
// succeeded without contacting a signaling provider.

export interface CallTarget {
  callId: string;
  participants: string[];
  kind: 'voice' | 'video';
}

export interface IncomingSignal {
  callId: string;
  fromUserId: string;
  kind: 'voice' | 'video';
  payload?: Record<string, unknown>;
}

/**
 * Legacy API retained for compatibility. Initiate calls through the Stream
 * SDK call components instead.
 */
export async function initiateWebRTCCall(_target: CallTarget): Promise<{ ok: boolean }> {
  throw new Error('Legacy WebRTC signaling is not configured. Use the Stream Video SDK call flow.');
}

/** Legacy API retained for compatibility; inbound calls use Stream + call_signals. */
export function handleIncomingSignal(_signal: IncomingSignal): void {
  throw new Error('Legacy WebRTC signaling is not configured. Use the Stream Video SDK call flow.');
}

/** Legacy API retained for compatibility; active calls leave through Stream. */
export async function endCall(_callId: string): Promise<void> {
  throw new Error('Legacy WebRTC signaling is not configured. End calls through the Stream Video SDK.');
}
