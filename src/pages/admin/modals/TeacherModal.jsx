import React, { useState, useEffect } from "react";

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
      setRatePerClass(initialData.ratePerClass || "");
      setPassword(initialData.password || "");
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
    onSave({
      firstName,
      lastName,
      email,
      ratePerClass: parseFloat(ratePerClass) || 0,
      password,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-4 text-brand-primary">
          {initialData ? "Edit Teacher" : "Create Teacher"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-brand-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-brand-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-brand-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Rate per Class ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={ratePerClass}
              onChange={(e) => setRatePerClass(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-brand-primary"
              placeholder="e.g. 10"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:ring-brand-primary"
              placeholder="Leave blank to auto-generate"
            />
            <p className="text-xs text-gray-500 mt-1">
              If left empty, a password will be generated automatically.
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-primary text-white rounded hover:bg-brand-secondary"
            >
              {initialData ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
