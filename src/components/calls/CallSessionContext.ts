import { createContext, useContext } from 'react';

export interface CallSession {
  chatId: string;
  kind: 'voice' | 'video';
  isInitiator: boolean;
  participantName: string;
  participantAvatar?: string;
}

export interface CallSessionContextValue {
  activeCall: CallSession | null;
  startCall: (session: CallSession) => boolean;
}

export const CallSessionContext = createContext<CallSessionContextValue | null>(null);

export const useCallSession = () => {
  const context = useContext(CallSessionContext);
  if (!context) throw new Error('useCallSession must be used within CallSessionProvider');
  return context;
};
