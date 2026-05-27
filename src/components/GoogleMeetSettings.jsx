// src/components/GoogleMeetSettings.jsx
// Generic video-link settings card.  Drives Google Meet AND Zoom from the
// same UI — pass `platform="zoom"` to switch.  Default stays `"google-meet"`
// so existing callers behave exactly as before.
import React, { useState } from 'react';
import { Video, Save, ExternalLink, X, Check } from 'lucide-react';
import api from '../api';

const PLATFORMS = {
  'google-meet': {
    title:        'Google Meet Link',
    description:  'Students will use this link to join your classes',
    placeholder:  'https://meet.google.com/xxx-xxxx-xxx',
    field:        'googleMeetLink',
    apiPath:      'google-meet',
    domainHint:   'meet.google.com',
    invalidMsg:   'Please enter a valid Google Meet link',
    iconGradient: 'from-green-500 to-emerald-600',
    saveButton:   'bg-green-600 hover:bg-green-700',
    focusRing:    'focus:ring-green-500',
    linkColor:    { light: 'text-green-600', dark: 'text-green-400' },
    addLabel:     'Add Google Meet Link',
    setupTitle:   '📋 How to set up:',
    setup: [
      { href: 'https://meet.google.com', text: 'Go to', linkText: 'meet.google.com' },
      'Click "New meeting" → "Create a meeting for later"',
      'Copy the meeting link',
      'Paste it here and save',
    ],
  },
  zoom: {
    title:        'Zoom Link',
    description:  'Students will use this link to join your classes',
    placeholder:  'https://zoom.us/j/123456789',
    field:        'zoomLink',
    apiPath:      'zoom',
    domainHint:   'zoom.us',
    invalidMsg:   'Please enter a valid Zoom link',
    iconGradient: 'from-blue-500 to-blue-600',
    saveButton:   'bg-blue-600 hover:bg-blue-700',
    focusRing:    'focus:ring-blue-500',
    linkColor:    { light: 'text-blue-600', dark: 'text-blue-400' },
    addLabel:     'Add Zoom Link',
    setupTitle:   '📋 How to set up:',
    setup: [
      { href: 'https://zoom.us/meeting', text: 'Go to', linkText: 'zoom.us/meeting' },
      'Schedule a meeting or use your Personal Meeting Room',
      'Copy the meeting join URL',
      'Paste it here and save',
    ],
  },
};

export default function GoogleMeetSettings({
  teacherId,
  initialLink,
  onUpdate,
  isDarkMode,
  platform = 'google-meet',
}) {
  const cfg = PLATFORMS[platform] || PLATFORMS['google-meet'];

  const [link, setLink]         = useState(initialLink || '');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [message, setMessage]   = useState({ type: '', text: '' });

  const handleSave = async () => {
    if (link && !link.includes(cfg.domainHint)) {
      setMessage({ type: 'error', text: cfg.invalidMsg });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const { data } = await api.patch(`/teachers/${teacherId}/${cfg.apiPath}`, {
        [cfg.field]: link.trim(),
      });

      setMessage({ type: 'success', text: data.message });
      setIsEditing(false);
      if (onUpdate) onUpdate(data[cfg.field]);

      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update link',
      });
    } finally {
      setSaving(false);
    }
  };

  const testLink = () => {
    if (link) window.open(link, '_blank');
  };

  return (
    <div className={`${
      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    } rounded-xl p-6 border shadow-lg`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 bg-gradient-to-br ${cfg.iconGradient} rounded-lg`}>
          <Video className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {cfg.title}
          </h3>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {cfg.description}
          </p>
        </div>
      </div>

      {message.text && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-green-100 text-green-800 border border-green-200'
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Current Link Display */}
        {!isEditing && link && (
          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <p className={`text-sm font-medium mb-2 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Current Link:
            </p>
            <div className="flex items-center gap-2">
              <code className={`flex-1 px-3 py-2 rounded ${
                isDarkMode ? `bg-gray-800 ${cfg.linkColor.dark}` : `bg-white ${cfg.linkColor.light}`
              } text-sm font-mono break-all`}>
                {link}
              </code>
              <button
                onClick={testLink}
                className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                title="Test link"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Editing Mode */}
        {isEditing && (
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              {cfg.title}
            </label>
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={cfg.placeholder}
              className={`w-full px-4 py-3 rounded-lg border-2 focus:outline-none focus:ring-2 ${cfg.focusRing} ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
            <p className={`text-xs mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              💡 Tip: Use a permanent / personal meeting room link so students can always rejoin
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`flex-1 px-4 py-2 ${cfg.saveButton} text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50`}
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save Link'}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setLink(initialLink || '');
                  setMessage({ type: '', text: '' });
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                isDarkMode
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {link ? 'Update Link' : cfg.addLabel}
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className={`p-4 rounded-lg border-2 ${
          isDarkMode ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'
        }`}>
          <h4 className={`font-semibold mb-2 ${isDarkMode ? 'text-blue-300' : 'text-blue-900'}`}>
            {cfg.setupTitle}
          </h4>
          <ol className={`text-sm space-y-1 list-decimal list-inside ${
            isDarkMode ? 'text-blue-200' : 'text-blue-800'
          }`}>
            {cfg.setup.map((step, i) => (
              <li key={i}>
                {typeof step === 'string' ? step : (
                  <>
                    {step.text}{' '}
                    <a href={step.href} target="_blank" rel="noopener noreferrer" className="underline">
                      {step.linkText}
                    </a>
                  </>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
