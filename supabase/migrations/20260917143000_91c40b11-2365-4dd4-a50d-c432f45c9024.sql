ALTER TABLE public.call_signals
  DROP CONSTRAINT IF EXISTS call_signals_signal_type_check;

ALTER TABLE public.call_signals
  ADD CONSTRAINT call_signals_signal_type_check
  CHECK (signal_type IN ('offer', 'answer', 'ice-candidate', 'decline', 'cancel'));
