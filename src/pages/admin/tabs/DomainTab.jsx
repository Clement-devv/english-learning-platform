import { useState, useEffect } from 'react';
import api from '../../../api';

export default function DomainTab() {
  const [status, setStatus]     = useState(null);
  const [domain, setDomain]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [message, setMessage]   = useState(null); // { type: 'success'|'error', text }

  const fetchStatus = async () => {
    try {
      const res = await api.get('/center/domain/status');
      setStatus(res.data);
    } catch {
      // no domain yet — that's fine
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.post('/center/domain', { domain });
      setMessage({ type: 'success', text: res.data.message });
      fetchStatus();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to submit domain' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Custom Domain</h2>
        <p className="text-sm text-gray-500 mt-1">
          Point your own domain to this platform. Requires a Pro or Enterprise plan.
        </p>
      </div>

      {/* Current status */}
      {status?.customDomain && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Current domain</span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                status.domainVerified
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {status.domainVerified ? 'Verified' : 'Pending verification'}
            </span>
          </div>
          <p className="text-base font-mono text-gray-900">{status.customDomain}</p>

          {!status.domainVerified && status.instructions && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-gray-700">Add these DNS records at your registrar:</p>
              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-600">Type</th>
                    <th className="px-3 py-2 text-left text-gray-600">Name</th>
                    <th className="px-3 py-2 text-left text-gray-600">Value</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  <tr>
                    <td className="px-3 py-2 font-mono">A</td>
                    <td className="px-3 py-2 font-mono">@</td>
                    <td className="px-3 py-2 font-mono">{status.instructions.value || 'YOUR_SERVER_IP'}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono">CNAME</td>
                    <td className="px-3 py-2 font-mono">www</td>
                    <td className="px-3 py-2 font-mono">{status.customDomain}</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-gray-500">
                DNS propagation can take up to 48 hours. Once your DNS is set, contact support to complete verification.
              </p>
            </div>
          )}

          {status.domainVerified && (
            <p className="text-sm text-green-700">
              Your custom domain is live. Make sure you have SSL (HTTPS) configured via your hosting panel.
            </p>
          )}
        </div>
      )}

      {/* Submit / change domain */}
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">
          {status?.customDomain ? 'Change domain' : 'Add a custom domain'}
        </h3>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Domain name</label>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="yourdomain.com"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Enter without https:// — e.g. myschool.com</p>
        </div>

        {message && (
          <p className={`text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
        >
          {saving ? 'Submitting…' : 'Submit domain'}
        </button>
      </form>

      <p className="text-xs text-gray-400">
        After submitting, you will receive an email with DNS setup instructions. Once your DNS is configured,
        contact your platform administrator to verify the domain.
      </p>
    </div>
  );
}
