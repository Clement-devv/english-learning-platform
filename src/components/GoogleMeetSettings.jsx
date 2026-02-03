// src/components/GoogleMeetSettings.jsx
import React, { useState } from 'react';
import { Video, Save, ExternalLink, X, Check } from 'lucide-react';
import api from '../api';

export default function GoogleMeetSettings({ teacherId, initialLink, onUpdate, isDarkMode }) {
  const [googleMeetLink, setGoogleMeetLink] = useState(initialLink || '');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSave = async () => {
    if (googleMeetLink && !googleMeetLink.includes('meet.google.com')) {
      setMessage({ 
        type: 'error', 
        text: 'Please enter a valid Google Meet link' 
      });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const { data } = await api.patch(`/api/teachers/${teacherId}/google-meet`, {
        googleMeetLink: googleMeetLink.trim()
      });

      setMessage({ 
        type: 'success', 
        text: data.message 
      });
      setIsEditing(false);
      if (onUpdate) onUpdate(data.googleMeetLink);

      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      setMessage({ 
        type: 'error', 
        text: err.response?.data?.message || 'Failed to update link' 
      });
    } finally {
      setSaving(false);
    }
  };

  const testLink = () => {
    if (googleMeetLink) {
      window.open(googleMeetLink, '_blank');
    }
  };

  return (
    <div className={`${
      isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    } rounded-xl p-6 border shadow-lg`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
          <Video className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Google Meet Link
          </h3>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Students will use this link to join your classes
          </p>
        </div>
      </div>

      {message.text && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-200'
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <Check className="w-5 h-5" />
          ) : (
            <X className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Current Link Display */}
        {!isEditing && googleMeetLink && (
          <div className={`p-4 rounded-lg ${
            isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
          }`}>
            <p className={`text-sm font-medium mb-2 ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Current Link:
            </p>
            <div className="flex items-center gap-2">
              <code className={`flex-1 px-3 py-2 rounded ${
                isDarkMode ? 'bg-gray-800 text-green-400' : 'bg-white text-green-600'
              } text-sm font-mono break-all`}>
                {googleMeetLink}
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
              Google Meet Link
            </label>
            <input
              type="text"
              value={googleMeetLink}
              onChange={(e) => setGoogleMeetLink(e.target.value)}
              placeholder="https://meet.google.com/xxx-xxxx-xxx"
              className={`w-full px-4 py-3 rounded-lg border-2 focus:outline-none focus:ring-2 focus:ring-green-500 ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
            <p className={`text-xs mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              💡 Tip: Create a permanent meeting in Google Meet and paste the link here
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
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save Link'}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setGoogleMeetLink(initialLink || '');
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
              {googleMeetLink ? 'Update Link' : 'Add Google Meet Link'}
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className={`p-4 rounded-lg border-2 ${
          isDarkMode 
            ? 'bg-blue-900/20 border-blue-700' 
            : 'bg-blue-50 border-blue-200'
        }`}>
          <h4 className={`font-semibold mb-2 ${isDarkMode ? 'text-blue-300' : 'text-blue-900'}`}>
            📋 How to set up:
          </h4>
          <ol className={`text-sm space-y-1 list-decimal list-inside ${
            isDarkMode ? 'text-blue-200' : 'text-blue-800'
          }`}>
            <li>Go to <a href="https://meet.google.com" target="_blank" rel="noopener noreferrer" className="underline">meet.google.com</a></li>
            <li>Click "New meeting" → "Create a meeting for later"</li>
            <li>Copy the meeting link</li>
            <li>Paste it here and save</li>
          </ol>
        </div>
      </div>
    </div>
  );
}