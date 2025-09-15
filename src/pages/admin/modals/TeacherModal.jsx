import React, { useEffect, useState } from "react";

export default function TeacherModal({ isOpen, onClose, onSave, initialData }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [ratePerClass, setRatePerClass] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (initialData) {
      setFirstName(initialData.firstName || "");
      setLastName(initialData.lastName || "");
      setEmail(initialData.email || "");
      setRatePerClass(initialData.ratePerClass ?? "");
      setPassword(""); // we don't prefill password for safety (admin can set if needed)
    } else {
      setFirstName("");
      setLastName("");
      setEmail("");
      setRatePerClass("");
      setPassword("");
    }
  }, [initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      id: initialData?.id, // present when editing
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      ratePerClass: parseFloat(ratePerClass) || 0,
      password: password.trim() || undefined, // undefined means "auto-generate"
    };
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4">{initialData ? "Edit Teacher" : "Create Teacher"}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">First name</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full border rounded px-3 py-2" required />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Last name</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)} className="w-full border rounded px-3 py-2" required />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full border rounded px-3 py-2" required />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Rate per class (USD)</label>
            <input value={ratePerClass} onChange={e => setRatePerClass(e.target.value)} type="number" step="0.01" className="w-full border rounded px-3 py-2" placeholder="e.g. 10.00" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password (optional)</label>
            <input value={password} onChange={e => setPassword(e.target.value)} type="text" className="w-full border rounded px-3 py-2" placeholder="leave blank to auto-generate" />
            <p className="text-xs text-gray-500 mt-1">If left empty, a random password will be generated and shown once.</p>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-brand-primary text-white rounded hover:bg-brand-secondary">{initialData ? "Save" : "Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
