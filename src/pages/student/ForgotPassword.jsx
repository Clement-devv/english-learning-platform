import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, BookOpen } from 'lucide-react';
import api from '../../api';
import { useTranslation } from "react-i18next";

export default function StudentForgotPassword() {
  const { t: tr } = useTranslation("student");
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email) {
      setError(tr("forgotPassword.emailIsRequired"));
      setLoading(false);
      return;
    }

    try {
      await api.post('/auth/student/forgot-password', {
        email: email.trim()
      });

      setSuccess(true);
      
    } catch (err) {
      console.error('Forgot password error:', err);
      setError(err.response?.data?.message || tr("forgotPassword.failedToSendResetEmail"));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{tr("forgotPassword.checkYourEmail")}</h1>
            <p className="text-gray-600 mb-6">
              {tr("forgotPassword.aPasswordResetLinkHas")} <strong>{email}</strong>{tr("forgotPassword.checkYourInboxAndSpam")}
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>{tr("forgotPassword.nextSteps")}</strong>
              </p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1 text-left">
                <li>{tr("forgotPassword.checkYourEmailInbox")}</li>
                <li>{tr("forgotPassword.lookForAnEmailFrom")}</li>
                <li>{tr("forgotPassword.clickTheResetLinkValid")}</li>
                <li>{tr("forgotPassword.createYourNewPassword")}</li>
              </ul>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              {tr("forgotPassword.didnTReceiveTheEmail")}
            </p>

            <button
              onClick={() => navigate('/student/login')}
              className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition"
            >
              {tr("forgotPassword.backToLogin")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{tr("forgotPassword.forgotPassword")}</h1>
          <p className="text-gray-600">
            {tr("forgotPassword.enterYourEmailAndWe")}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                {tr("forgotPassword.emailAddress")}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={tr("forgotPassword.yourEmailExampleCom")}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? tr("forgotPassword.sending") : tr("forgotPassword.sendResetLink")}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/student/login')}
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              {tr("forgotPassword.backToLogin")}
            </button>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            {tr("forgotPassword.needHelpContactYourTeacher")}
          </p>
        </div>
      </div>
    </div>
  );
}