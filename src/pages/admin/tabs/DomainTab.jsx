import { useState, useEffect } from 'react';
import api from '../../../api';
import { useTranslation } from "react-i18next";

export default function DomainTab() {
  const { t: tr } = useTranslation("admin");
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
      setMessage({ type: 'error', text: err.response?.data?.message || tr("domainTab.failedToSubmitDomain") });
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
        <h2 className="text-xl font-semibold text-stone-800">{tr("domainTab.customDomain")}</h2>
        <p className="text-sm text-stone-500 mt-1">
          {tr("domainTab.pointYourOwnDomainTo")}
        </p>
      </div>

      {/* Current status */}
      {status?.customDomain && (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-stone-700">{tr("domainTab.currentDomain")}</span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                status.domainVerified
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {status.domainVerified ? tr("domainTab.verified") : tr("domainTab.pendingVerification")}
            </span>
          </div>
          <p className="text-base font-mono text-stone-900">{status.customDomain}</p>

          {!status.domainVerified && status.instructions && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium text-stone-700">{tr("domainTab.addTheseDnsRecordsAt")}</p>
              <table className="w-full text-xs border border-stone-200 rounded-lg overflow-hidden">
                <thead className="bg-stone-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-stone-600">{tr("domainTab.type")}</th>
                    <th className="px-3 py-2 text-left text-stone-600">{tr("domainTab.name")}</th>
                    <th className="px-3 py-2 text-left text-stone-600">{tr("domainTab.value")}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-stone-100">
                  <tr>
                    <td className="px-3 py-2 font-mono">A</td>
                    <td className="px-3 py-2 font-mono">@</td>
                    <td className="px-3 py-2 font-mono">{status.instructions.value || 'YOUR_SERVER_IP'}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono">{tr("domainTab.cname")}</td>
                    <td className="px-3 py-2 font-mono">{tr("domainTab.www")}</td>
                    <td className="px-3 py-2 font-mono">{status.customDomain}</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-stone-500">
                {tr("domainTab.dnsPropagationCanTakeUp")}
              </p>
            </div>
          )}

          {status.domainVerified && (
            <p className="text-sm text-green-700">
              {tr("domainTab.yourCustomDomainIsLive")}
            </p>
          )}
        </div>
      )}

      {/* Submit / change domain */}
      <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-stone-700">
          {status?.customDomain ? tr("domainTab.changeDomain") : tr("domainTab.addACustomDomain")}
        </h3>

        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">{tr("domainTab.domainName")}</label>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder={tr("domainTab.yourdomainCom")}
            required
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-stone-400 mt-1">{tr("domainTab.enterWithoutHttpsEG")}</p>
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
          {saving ? tr("domainTab.submitting") : tr("domainTab.submitDomain")}
        </button>
      </form>

      <p className="text-xs text-stone-400">
        {tr("domainTab.afterSubmittingYouWillReceive")}
      </p>
    </div>
  );
}
