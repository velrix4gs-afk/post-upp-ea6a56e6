// Call signaling placeholders.
//
// The production calling stack uses GetStream Video SDK (see
// `src/hooks/useStreamVideoClient.ts` and `src/components/VoiceCall.tsx` /
// `VideoCall.tsx`). These functions exist as a clean, documented seam for
// any future migration to an alternative WebRTC / signaling provider
// (Agora, Twilio Programmable Video, LiveKit, a custom signaling broker).
//
// IMPORTANT: The Lovable build sandbox cannot host a media or signaling
// server. Real signaling MUST live behind an external infrastructure with
// its own credentials, accessed server-side via an edge function. Never
// embed signaling secrets in this file.

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
 * Placeholder for outbound call initiation.
 *
 * TODO: Wire to your chosen signaling provider (Agora / Twilio / LiveKit /
 * custom broker). Currently the live implementation lives in the Stream
 * SDK call hook — this stub exists for future providers and tests.
 */
export async function initiateWebRTCCall(target: CallTarget): Promise<{ ok: boolean }>
{
  // Intentionally a no-op stub. Real implementation must:
  //   1. Reach an edge function that holds provider credentials.
  //   2. Mint a per-call token scoped to the participants.
  //   3. Return the token to the caller for SDK join.
  console.info('[callSignaling] initiateWebRTCCall placeholder', target);
  return { ok: true };
}

/**
 * Placeholder for inbound signaling events (ringing, ICE, hang-up).
 *
 * TODO: Subscribe to provider events (Stream call.ring, Agora RTM, Twilio
 * Conversations, etc.) and dispatch into the app's call store.
 */
export function handleIncomingSignal(signal: IncomingSignal): void {
  console.info('[callSignaling] handleIncomingSignal placeholder', signal);
}

/**
 * Placeholder for graceful call termination.
 *
 * TODO: Notify the signaling provider, release local media tracks, and
 * tear down peer connections. Live teardown is handled by Stream today.
 */
export async function endCall(callId: string): Promise<void> {
  console.info('[callSignaling] endCall placeholder', callId);
}
