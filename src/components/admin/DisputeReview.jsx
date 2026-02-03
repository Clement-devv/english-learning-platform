import { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User,
  Calendar,
  FileText,
  TrendingUp
} from 'lucide-react';
import api from '../../api';

export default function DisputeReview() {
  const [disputes, setDisputes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolution, setResolution] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    fetchDisputes();
    fetchStats();
  }, []);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/api/disputes');
      setDisputes(data.disputes);
      console.log('📋 Loaded disputes:', data.disputes);
    } catch (error) {
      console.error('❌ Error fetching disputes:', error);
      alert('Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/api/disputes/stats');
      setStats(data.stats);
    } catch (error) {
      console.error('❌ Error fetching stats:', error);
    }
  };

  const handleResolve = (dispute) => {
    setSelectedDispute(dispute);
    setShowResolveModal(true);
    setResolution('');
    setAdminNotes('');
  };

  const submitResolution = async () => {
    if (!resolution) {
      alert('Please select a resolution');
      return;
    }

    try {
      setResolving(true);
      const { data } = await api.patch(`/api/disputes/${selectedDispute._id}/resolve`, {
        resolution,
        adminNotes
      });

      alert(`✅ ${data.message}`);
      setShowResolveModal(false);
      fetchDisputes();
      fetchStats();
    } catch (error) {
      console.error('❌ Error resolving dispute:', error);
      alert(`Failed to resolve dispute: ${error.response?.data?.message || error.message}`);
    } finally {
      setResolving(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Dispute Review</h1>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
          <span>{disputes.length} Pending Disputes</span>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-600 font-medium">Pending</p>
                <p className="text-2xl font-bold text-yellow-700">{stats.pendingDisputes}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 font-medium">Teacher Wins</p>
                <p className="text-2xl font-bold text-green-700">{stats.teacherWins}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Student Wins</p>
                <p className="text-2xl font-bold text-blue-700">{stats.studentWins}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Total Resolved</p>
                <p className="text-2xl font-bold text-purple-700">{stats.resolvedDisputes}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      )}

      {/* Disputes List */}
      <div className="bg-white rounded-xl shadow-md">
        {disputes.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">No Pending Disputes</h3>
            <p className="text-gray-600">All disputes have been resolved!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {disputes.map((dispute) => (
              <div key={dispute._id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-6">
                  {/* Left: Dispute Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <AlertTriangle className="w-6 h-6 text-yellow-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-800">
                          {dispute.classTitle}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Booking ID: {dispute._id.slice(-8)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">Teacher:</span>
                        <span className="font-medium text-gray-800">
                          {dispute.teacherId.firstName} {dispute.teacherId.lastName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">Student:</span>
                        <span className="font-medium text-gray-800">
                          {dispute.studentId.firstName} {dispute.studentId.lastName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">Scheduled:</span>
                        <span className="font-medium text-gray-800">
                          {formatDate(dispute.scheduledTime)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">Disputed:</span>
                        <span className="font-medium text-gray-800">
                          {formatDate(dispute.disputedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Dispute Reason */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <FileText className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-yellow-800 mb-1">
                            Dispute Reason ({dispute.disputedBy}):
                          </p>
                          <p className="text-sm text-yellow-900">
                            {dispute.disputeReason}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Action Button */}
                  <div>
                    <button
                      onClick={() => handleResolve(dispute)}
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium shadow-lg transition-all"
                    >
                      Resolve Dispute
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolution Modal */}
      {showResolveModal && selectedDispute && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              Resolve Dispute
            </h2>

            {/* Dispute Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-bold text-gray-800 mb-2">{selectedDispute.classTitle}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Teacher:</span>
                  <p className="font-medium text-gray-800">
                    {selectedDispute.teacherId.firstName} {selectedDispute.teacherId.lastName}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Student:</span>
                  <p className="font-medium text-gray-800">
                    {selectedDispute.studentId.firstName} {selectedDispute.studentId.lastName}
                  </p>
                </div>
              </div>
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-900">
                  <strong>Reason:</strong> {selectedDispute.disputeReason}
                </p>
              </div>
            </div>

            {/* Resolution Options */}
            <div className="space-y-4 mb-6">
              <h3 className="font-bold text-gray-800">Select Resolution:</h3>
              
              <label className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                resolution === 'approve_teacher' 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200 hover:border-green-300'
              }`}>
                <input
                  type="radio"
                  name="resolution"
                  value="approve_teacher"
                  checked={resolution === 'approve_teacher'}
                  onChange={(e) => setResolution(e.target.value)}
                  className="mr-3"
                />
                <span className="font-medium text-gray-800">Approve Teacher</span>
                <p className="text-sm text-gray-600 ml-6">
                  Class will be marked as completed. Teacher gets paid, student loses 1 class.
                </p>
              </label>

              <label className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
                resolution === 'approve_student' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-blue-300'
              }`}>
                <input
                  type="radio"
                  name="resolution"
                  value="approve_student"
                  checked={resolution === 'approve_student'}
                  onChange={(e) => setResolution(e.target.value)}
                  className="mr-3"
                />
                <span className="font-medium text-gray-800">Approve Student</span>
                <p className="text-sm text-gray-600 ml-6">
                  Class will be cancelled. Student gets refunded 1 class, teacher gets no payment.
                </p>
              </label>
            </div>

            {/* Admin Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Notes (Optional)
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add any notes about this resolution..."
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowResolveModal(false)}
                disabled={resolving}
                className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitResolution}
                disabled={resolving || !resolution}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resolving ? 'Resolving...' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}