"use client";
import { useEffect, useState } from 'react';
import { getApiMode } from '@/lib/api/factory';

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const [apiMode, setApiMode] = useState<'http' | 'ipc'>('http');

  useEffect(() => {
    setApiMode(getApiMode());
  }, []);

  const getAdapterLabel = () => {
    if (apiMode === 'ipc') {
      return 'IPC (Electron)';
    }
    return 'HTTP (Web)';
  };

  const getAdapterDescription = () => {
    if (apiMode === 'ipc') {
      return 'Communication via Electron IPC (native application)';
    }
    return 'Communication via HTTP (web/development mode)';
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#1e1f20] rounded-2xl shadow-2xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2e2f30]">
          <h2 className="text-xl font-semibold">Einstellungen</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* API Adapter Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              API-Verbindung
            </h3>
            <div className="bg-[#2e2f30] rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <div>
                  <p className="font-medium text-white">
                    {getAdapterLabel()}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {getAdapterDescription()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Informationen
            </h3>
            <div className="space-y-2 text-sm text-gray-400">
              <p>
                <span className="text-gray-500">Umgebung:</span> {process.env.NODE_ENV === 'production' ? 'Produktion' : 'Entwicklung'}
              </p>
              <p>
                <span className="text-gray-500">Version:</span> 1.0.0
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#2e2f30]">
          <button
            onClick={onClose}
            className="w-full bg-[#2e2f30] hover:bg-[#37393b] text-white font-medium py-2 rounded-lg transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
