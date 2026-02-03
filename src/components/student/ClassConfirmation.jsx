import React, { useState } from 'react';
import { Check, X, AlertTriangle, Clock } from 'lucide-react';
import api from '../../api';

export default function ClassConfirmation({ booking, onConfirm, onDispute, onClose, isDarkMode }) {
  const [loading, setLoading] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await api.patch(`/api/bookings/${booking.bookingId}/student-confirm`);
      onConfirm();
    } catch (err) {
      console.error('Error confirming:', err);
      alert('Failed to confirm class. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) {
      alert('Please provide a reason for the dispute');
      return;
    }

    try {
      setLoading(true);
      await api.patch(`/api/bookings/${booking.bookingId}/dispute`, { 
        reason: disputeReason 
      });
      onDispute();
    } catch (err) {
      console.error('Error disputing:', err);
      alert('Failed to submit dispute. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getTimeRemaining = () => {
    if (!booking.autoConfirmAt) return "Unknown";
    const now = new Date();
    const confirmTime = new Date(booking.autoConfirmAt);
    const diff = confirmTime - now;
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      } rounded-2xl shadow-2xl max-w-lg w-full p-6`}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            Confirm Class Completion
          </h2>
          <button
            onClick={onClose}
            className={`p-2 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg transition-colors`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Class Details */}
        <div className={`${
          isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
        } rounded-lg p-4 mb-4`}>
          <div className="space-y-2">
            <div>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Class</p>
              <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                {booking.title}
              </p>
            </div>
            <div>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Teacher</p>
              <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                {booking.teacher}
              </p>
            </div>
            <div>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Date & Time</p>
              <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                {formatDate(booking.scheduledTime)}
              </p>
            </div>
            <div>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Duration</p>
              <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                {booking.duration} minutes
              </p>
            </div>
          </div>
        </div>

        {/* Timer Warning */}
        <div className={`${
          isDarkMode ? 'bg-yellow-900/30 border-yellow-700' : 'bg-yellow-50 border-yellow-200'
        } border rounded-lg p-3 mb-6 flex items-center gap-2`}>
          <Clock className={`w-5 h-5 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
          <p className={`text-sm ${isDarkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
            Auto-confirms in: <strong>{getTimeRemaining()}</strong>
          </p>
        </div>

        {!showDisputeForm ? (
          <>
            {/* Question */}
            <p className={`text-center ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-6`}>
              Did you attend this class successfully?
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-5 h-5" />
                {loading ? 'Confirming...' : 'Yes, Confirm'}
              </button>
              
              <button
                onClick={() => setShowDisputeForm(true)}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <AlertTriangle className="w-5 h-5" />
                Report Issue
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Dispute Form */}
            <div className="mb-4">
              <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                Please explain the issue:
              </label>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                className={`w-full px-3 py-2 ${
                  isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500`}
                rows={4}
                placeholder="Example: Class was cancelled, technical issues, teacher didn't show up, etc."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDisputeForm(false)}
                disabled={loading}
                className={`flex-1 ${
                  isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                } px-4 py-3 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Back
              </button>
              
              <button
                onClick={handleDispute}
                disabled={loading || !disputeReason.trim()}
                className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : 'Submit Dispute'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}