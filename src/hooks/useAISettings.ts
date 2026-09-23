import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from './useAdmin';
import { toast } from './use-toast';

export interface AISettings {
  provider: 'lovable' | 'openai' | 'anthropic' | 'google';
  model: string;
  custom_api_key: string;
  system_prompt_user: string;
  system_prompt_admin: string;
}

const DEFAULT_SETTINGS: AISettings = {
  provider: 'lovable',
  model: 'google/gemini-2.5-flash',
  custom_api_key: '',
  system_prompt_user: 'You are Post Up AI - a friendly and helpful assistant for the Post Up social media platform. Help users navigate the app, answer questions about features, and provide tips for better engagement. Be conversational and friendly. Use emojis occasionally.',
  system_prompt_admin: 'You are Post Up Admin AI - an intelligent assistant for administrators. Summarize user feedback, identify patterns in complaints or suggestions, provide actionable insights, and help draft responses to user issues. Be concise, professional, and data-driven.'
};

export const AVAILABLE_MODELS = {
  lovable: [
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Fast)' },
    { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (Best)' },
    { value: 'openai/gpt-5', label: 'GPT-5' },
    { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
  ],
  openai: [
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  ],
  google: [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ]
};

export const useAISettings = () => {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { isAdmin } = useAdmin();

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ai_settings')
        .select('setting_key, setting_value');

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedSettings: Partial<AISettings> = {};
        data.forEach((row) => {
          const key = row.setting_key as keyof AISettings;
          try {
            loadedSettings[key] = JSON.parse(row.setting_value as string);
          } catch {
            loadedSettings[key] = row.setting_value as any;
          }
        });
        setSettings({ ...DEFAULT_SETTINGS, ...loadedSettings });
      }
    } catch (error) {
      console.error('Error fetching AI settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const updateSetting = async (key: keyof AISettings, value: any) => {
    if (!isAdmin) {
      toast({
        title: 'Access Denied',
        description: 'Only admins can update AI settings',
        variant: 'destructive'
      });
      return false;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('ai_settings')
        .upsert({
          setting_key: key,
          setting_value: JSON.stringify(value),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;

      setSettings(prev => ({ ...prev, [key]: value }));
      return true;
    } catch (error) {
      console.error('Error updating AI setting:', error);
      toast({
        title: 'Error',
        description: 'Failed to save AI setting',
        variant: 'destructive'
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveAllSettings = async (newSettings: AISettings) => {
    if (!isAdmin) {
      toast({
        title: 'Access Denied',
        description: 'Only admins can update AI settings',
        variant: 'destructive'
      });
      return false;
    }

    try {
      setSaving(true);

      const updates = Object.entries(newSettings).map(([key, value]) => ({
        setting_key: key,
        setting_value: JSON.stringify(value),
        updated_at: new Date().toISOString()
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('ai_settings')
          .upsert(update, { onConflict: 'setting_key' });
        if (error) throw error;
      }

      setSettings(newSettings);
      toast({
        title: 'Settings Saved',
        description: 'AI settings have been updated successfully'
      });
      return true;
    } catch (error) {
      console.error('Error saving AI settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save AI settings',
        variant: 'destructive'
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [{ role: 'user', content: 'Hello, this is a test.' }],
          isAdmin: false,
          testConnection: true
        }
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('AI connection test failed:', error);
      return false;
    }
  };

  return {
    settings,
    loading,
    saving,
    updateSetting,
    saveAllSettings,
    testConnection,
    refetch: fetchSettings
  };
};