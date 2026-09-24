import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bot, Key, MessageSquare, CheckCircle, XCircle, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useAISettings, AISettings as AISettingsType, AVAILABLE_MODELS } from '@/hooks/useAISettings';
import { toast } from '@/hooks/use-toast';

export const AISettings = () => {
  const { settings, loading, saving, saveAllSettings, testConnection } = useAISettings();
  const [localSettings, setLocalSettings] = useState<AISettingsType>(settings);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleProviderChange = (provider: 'lovable' | 'openai' | 'anthropic' | 'google' | 'openrouter') => {
    const models = AVAILABLE_MODELS[provider];
    setLocalSettings(prev => ({
      ...prev,
      provider,
      model: models[0].value
    }));
  };

  const handleSave = async () => {
    const success = await saveAllSettings(localSettings);
    if (success) {
      setTestResult(null);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const success = await testConnection();
    setTestResult(success);
    setTesting(false);

    toast({
      title: success ? 'Connection Successful' : 'Connection Failed',
      description: success
        ? 'AI is working correctly'
        : 'Failed to connect to AI. Check your settings.',
      variant: success ? 'default' : 'destructive'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Provider
          </CardTitle>
          <CardDescription>
            Choose which AI service to use for the assistant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select
              value={localSettings.provider}
              onValueChange={handleProviderChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lovable">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    Lovable AI (Default - No API Key Required)
                  </div>
                </SelectItem>
                <SelectItem value="google">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-blue-500" />
                    Google Gemini (Direct API)
                  </div>
                </SelectItem>
                <SelectItem value="openai">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-green-500" />
                    OpenAI (GPT Models)
                  </div>
                </SelectItem>
                <SelectItem value="anthropic">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-orange-500" />
                    Anthropic (Claude Models)
                  </div>
                </SelectItem>
                <SelectItem value="openrouter">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-pink-500" />
                    OpenRouter (Qwen, Llama & more)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Model</Label>
            <Select
              value={localSettings.model}
              onValueChange={(model) => setLocalSettings(prev => ({ ...prev, model }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS[localSettings.provider].map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {localSettings.provider !== 'lovable' && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                API Key
              </Label>
              <div className="relative">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={localSettings.custom_api_key}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, custom_api_key: e.target.value }))}
                  placeholder={`Enter your ${localSettings.provider === 'openai' ? 'OpenAI' :
                      localSettings.provider === 'google' ? 'Google AI' :
                        localSettings.provider === 'openrouter' ? 'OpenRouter' : 'Anthropic'
                    } API key`}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {localSettings.provider === 'google'
                  ? 'Get your API key from Google AI Studio (aistudio.google.com)'
                  : localSettings.provider === 'openrouter'
                    ? 'Get your API key from openrouter.ai/keys — Qwen 2.5 7B is one of the cheapest models there'
                    : 'Your API key is stored securely and only used for AI requests'}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : testResult === true ? (
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
              ) : testResult === false ? (
                <XCircle className="h-4 w-4 text-red-500 mr-2" />
              ) : null}
              Test Connection
            </Button>
            {testResult !== null && (
              <Badge variant={testResult ? 'default' : 'destructive'}>
                {testResult ? 'Connected' : 'Failed'}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* System Prompts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            System Prompts
          </CardTitle>
          <CardDescription>
            Customize how the AI assistant behaves for users and admins
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>User Assistant Prompt</Label>
            <Textarea
              value={localSettings.system_prompt_user}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, system_prompt_user: e.target.value }))}
              placeholder="Enter the system prompt for regular users..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              This prompt guides the AI when chatting with regular users
            </p>
          </div>

          <div className="space-y-2">
            <Label>Admin Assistant Prompt</Label>
            <Textarea
              value={localSettings.system_prompt_admin}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, system_prompt_admin: e.target.value }))}
              placeholder="Enter the system prompt for administrators..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              This prompt guides the AI when assisting administrators
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save AI Settings
        </Button>
      </div>
    </div>
  );
};

export default AISettings;