import React, { useState, useEffect } from "react";

export default function StudentModal({ isOpen, onClose, onSave, initialData }) {
  const [formData, setFormData] = useState({
    firstName: "",
    surname: "",
    age: "",
    email: "",
    password: "",
  });

  const [tempPassword, setTempPassword] = useState(null); // <-- NEW

  useEffect(() => {
    if (initialData) {
      setFormData({
        firstName: initialData.firstName || "",
        surname: initialData.surname || "",
        age: initialData.age || "",
        email: initialData.email || "",
        password: "", // never pre-fill real password
      });
    } else {
      setFormData({ firstName: "", surname: "", age: "", email: "", password: "" });
    }
    setTempPassword(null); // reset when opening fresh
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    const result = await onSave(formData);

    if (result?.tempPassword) {
      setTempPassword(result.tempPassword); // Show password, stay open
      // Modal will close when user clicks "Done"
    } else {
      // Only close if no tempPassword (edit mode)
      onClose();
    }
  } catch (err) {
    console.error("Error creating/updating student:", err);
  }
};

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg p-6">
        <h2 className="text-xl font-bold mb-4">
          {initialData ? "Edit Student" : "Create Student"}
        </h2>

        {tempPassword ? (
          // ✅ SHOW GENERATED PASSWORD
          <div className="space-y-4">
            <p className="text-green-600 font-semibold">
              Student created successfully!
            </p>
            <p className="text-gray-700">
              Temporary Password:{" "}
              <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                {tempPassword}
              </span>
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 rounded bg-brand-primary text-white hover:bg-brand-secondary"
            >
              Done
            </button>
          </div>
        ) : (
          // ✅ NORMAL FORM
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* First Name */}
            <div>
              <label className="block text-sm font-medium mb-1">First Name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>

            {/* Surname */}
            <div>
              <label className="block text-sm font-medium mb-1">Surname</label>
              <input
                type="text"
                name="surname"
                value={formData.surname}
                onChange={handleChange}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>

            {/* Age */}
            <div>
              <label className="block text-sm font-medium mb-1">Age</label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleChange}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full border rounded px-3 py-2"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Password{" "}
                <span className="text-gray-500">(leave blank to auto-generate)</span>
              </label>
              <input
                type="text"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Optional"
                className="w-full border rounded px-3 py-2"
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded bg-gray-300 hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-brand-primary text-white hover:bg-brand-secondary"
              >
                {initialData ? "Update" : "Create"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
