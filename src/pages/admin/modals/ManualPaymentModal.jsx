import React, { useState, useEffect } from "react";

export default function ManualPaymentModal({ isOpen, onClose, onSave, student }) {
  const [amount, setAmount] = useState("");
  const [classes, setClasses] = useState("");

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setClasses("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!amount || !classes) {
      alert("Please enter both amount and classes");
      return;
    }

    onSave({ amount, classes });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white w-full max-w-md rounded-lg shadow-lg p-6">
        <h2 className="text-lg font-bold mb-4 text-brand-primary">Manual Payment</h2>

        <div className="mb-4">
          <label className="block mb-1 text-sm font-medium">Student</label>
          <input
            type="text"
            value={student ? `${student.firstName} ${student.surname}` : ""}
            readOnly
            className="w-full border p-2 rounded bg-gray-100"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1 text-sm font-medium">Amount Paid (₦)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1 text-sm font-medium">Number of Classes</label>
          <input
            type="number"
            value={classes}
            onChange={(e) => setClasses(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Save Payment
          </button>
        </div>
      </div>
    </div>
  );
}
