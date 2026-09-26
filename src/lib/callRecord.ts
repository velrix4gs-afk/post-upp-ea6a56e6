export type CallKind = 'voice' | 'video';
export type CallStatus = 'completed' | 'missed' | 'declined' | 'incoming' | 'outgoing' | 'unknown';

export interface CallRecord {
  kind: CallKind;
  status: CallStatus;
  durationSec?: number;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const readString = (...values: unknown[]): string | undefined =>
  values.find((value): value is string => typeof value === 'string' && value.length > 0);

const callKind = (value: unknown): CallKind | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes('video')) return 'video';
  if (normalized.includes('voice') || normalized.includes('audio')) return 'voice';
  return undefined;
};

const normalizeStatus = (value: unknown): CallStatus => {
  if (typeof value !== 'string') return 'unknown';
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (['completed', 'complete', 'connected', 'ended', 'finished'].some((term) => normalized.includes(term))) return 'completed';
  if (['declined', 'decline', 'rejected', 'reject'].some((term) => normalized.includes(term))) return 'declined';
  if (['missed', 'unanswered', 'no_answer', 'noanswer', 'not_answered', 'timeout', 'timed_out', 'cancelled', 'canceled'].some((term) => normalized.includes(term))) return 'missed';
  if (['incoming', 'inbound', 'ringing'].some((term) => normalized.includes(term))) return 'incoming';
  if (['outgoing', 'outbound', 'initiated', 'calling', 'started'].some((term) => normalized.includes(term))) return 'outgoing';
  return 'unknown';
};

const durationValue = (...values: unknown[]): number | undefined => {
  const duration = values.find((value) => typeof value === 'number' || (typeof value === 'string' && value.trim() !== ''));
  if (duration === undefined) return undefined;
  const parsed = Number(duration);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

export function parseCallRecord(content: unknown): CallRecord | null {
  let parsed: unknown = content;
  for (let depth = 0; depth < 3 && typeof parsed === 'string'; depth += 1) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  const root = asRecord(parsed);
  if (!root) return null;

  const nested = [root.call, root.callInfo, root.call_info, root.metadata, root.data, root.payload]
    .map(asRecord)
    .filter((value): value is Record<string, unknown> => value !== null);
  const sources = [root, ...nested];

  const kindValue = sources
    .map((source) => callKind(source.kind ?? source.call_type ?? source.callType ?? source.media_type ?? source.mediaType ?? source.type))
    .find((value): value is CallKind => value !== undefined);
  const eventText = sources
    .map((source) => readString(source.event, source.action, source.type))
    .find((value): value is string => value !== undefined);
  const inferredKind = callKind(eventText);
  const kind = kindValue ?? inferredKind ?? (sources.some((source) => source.video === true) ? 'video' : undefined);

  const statusValue = sources
    .map((source) => source.status ?? source.call_status ?? source.callStatus ?? source.result)
    .find((value) => typeof value === 'string');
  const status = normalizeStatus(statusValue) === 'unknown'
    ? normalizeStatus(eventText)
    : normalizeStatus(statusValue);
  const hasCallMarker = sources.some((source) =>
    [source.call_id, source.callId, source.call, source.event, source.action].some(
      (value) => typeof value === 'string' && value.toLowerCase().includes('call'),
    ),
  );
  if (!kind && !hasCallMarker) return null;

  const durationSec = durationValue(
    ...sources.flatMap((source) => [source.durationSec, source.duration_sec, source.duration, source.call_duration]),
  );
  return { kind: kind ?? 'voice', status, durationSec };
}

export function formatCallDuration(durationSec?: number): string {
  const seconds = Math.max(0, Math.round(durationSec || 0));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function formatCallRecord(
  record: CallRecord,
  options: { isOwn?: boolean; includeDirection?: boolean } = {},
): string {
  const { kind, status } = record;
  const callKindLabel = kind === 'video' ? 'Video' : 'Voice';
  const direction = status === 'incoming' || status === 'outgoing'
    ? status
    : options.isOwn === undefined
      ? undefined
      : options.isOwn
        ? 'outgoing'
        : 'incoming';
  const prefix = options.includeDirection && direction
    ? `${direction === 'outgoing' ? 'Outgoing' : 'Incoming'} ${callKindLabel.toLowerCase()} call`
    : `${callKindLabel} call`;

  if (status === 'completed') return `${prefix} · ${formatCallDuration(record.durationSec)}`;
  if (status === 'declined') {
    if (direction === 'outgoing') return `${prefix} · declined`;
    return `Declined ${callKindLabel.toLowerCase()} call`;
  }
  if (status === 'missed') {
    return direction === 'outgoing'
      ? `${prefix} · no answer`
      : `Missed ${callKindLabel.toLowerCase()} call`;
  }
  if (status === 'incoming' || status === 'outgoing') return prefix;
  return prefix;
}
