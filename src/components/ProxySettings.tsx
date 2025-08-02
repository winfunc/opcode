import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/lib/i18n';

export interface ProxySettings {
  http_proxy: string | null;
  https_proxy: string | null;
  no_proxy: string | null;
  all_proxy: string | null;
  enabled: boolean;
}

interface ProxySettingsProps {
  setToast: (toast: { message: string; type: 'success' | 'error' } | null) => void;
  onChange?: (hasChanges: boolean, getSettings: () => ProxySettings, saveSettings: () => Promise<void>) => void;
}

export function ProxySettings({ setToast, onChange }: ProxySettingsProps) {
  const { t } = useI18n();
  const [settings, setSettings] = useState<ProxySettings>({
    http_proxy: null,
    https_proxy: null,
    no_proxy: null,
    all_proxy: null,
    enabled: false,
  });
  const [originalSettings, setOriginalSettings] = useState<ProxySettings>({
    http_proxy: null,
    https_proxy: null,
    no_proxy: null,
    all_proxy: null,
    enabled: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  // Save settings function
  const saveSettings = async () => {
    try {
      await invoke('save_proxy_settings', { settings });
      setOriginalSettings(settings);
      setToast({
        message: t.proxy.settingsSaved,
        type: 'success',
      });
    } catch (error) {
      console.error('Failed to save proxy settings:', error);
      setToast({
        message: t.proxy.settingsFailed,
        type: 'error',
      });
      throw error; // Re-throw to let parent handle the error
    }
  };

  // Notify parent component of changes
  useEffect(() => {
    if (onChange) {
      const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
      onChange(hasChanges, () => settings, saveSettings);
    }
  }, [settings, originalSettings, onChange]);

  const loadSettings = async () => {
    try {
      const loadedSettings = await invoke<ProxySettings>('get_proxy_settings');
      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
    } catch (error) {
      console.error('Failed to load proxy settings:', error);
      setToast({
        message: t.proxy.loadFailed,
        type: 'error',
      });
    }
  };


  const handleInputChange = (field: keyof ProxySettings, value: string) => {
    setSettings(prev => ({
      ...prev,
      [field]: value || null,
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">{t.proxy.title}</h3>
        <p className="text-sm text-muted-foreground">
          {t.proxy.subtitle}
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="proxy-enabled">{t.proxy.enableProxy}</Label>
            <p className="text-sm text-muted-foreground">
              {t.proxy.enableProxyDesc}
            </p>
          </div>
          <Switch
            id="proxy-enabled"
            checked={settings.enabled}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enabled: checked }))}
            variant="high-contrast"
          />
        </div>

        <div className="space-y-4" style={{ opacity: settings.enabled ? 1 : 0.5 }}>
          <div className="space-y-2">
            <Label htmlFor="http-proxy">{t.proxy.httpProxy}</Label>
            <Input
              id="http-proxy"
              placeholder={t.proxy.httpProxyPlaceholder}
              value={settings.http_proxy || ''}
              onChange={(e) => handleInputChange('http_proxy', e.target.value)}
              disabled={!settings.enabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="https-proxy">{t.proxy.httpsProxy}</Label>
            <Input
              id="https-proxy"
              placeholder={t.proxy.httpsProxyPlaceholder}
              value={settings.https_proxy || ''}
              onChange={(e) => handleInputChange('https_proxy', e.target.value)}
              disabled={!settings.enabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="no-proxy">{t.proxy.noProxy}</Label>
            <Input
              id="no-proxy"
              placeholder={t.proxy.noProxyPlaceholder}
              value={settings.no_proxy || ''}
              onChange={(e) => handleInputChange('no_proxy', e.target.value)}
              disabled={!settings.enabled}
            />
            <p className="text-xs text-muted-foreground">
              {t.proxy.noProxyDesc}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="all-proxy">{t.proxy.allProxy}</Label>
            <Input
              id="all-proxy"
              placeholder={t.proxy.allProxyPlaceholder}
              value={settings.all_proxy || ''}
              onChange={(e) => handleInputChange('all_proxy', e.target.value)}
              disabled={!settings.enabled}
            />
            <p className="text-xs text-muted-foreground">
              {t.proxy.allProxyDesc}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}