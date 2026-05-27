import React, { useEffect, useState } from "react";
import { User, DollarSign, BookOpen, Award, X, ChevronDown, Banknote } from "lucide-react";
import { TIMEZONE_OPTIONS } from "../../../utils/timezone";

const SPECIALIZATIONS = [
  "General English", "Business English", "Conversation",
  "IELTS Prep", "TOEFL Prep", "Grammar", "Pronunciation",
  "Kids & Young Learners", "Academic Writing", "Interview Coaching",
];

const CERTIFICATIONS = ["CELTA", "TEFL", "TESOL", "PGCE", "Delta", "Trinity CertTESOL"];

const CONTINENTS = ["Africa", "Americas", "Asia", "Europe", "Oceania"];


const EMPTY = {
  firstName: "", lastName: "", email: "", phone: "", country: "",
  continent: "", ratePerClass: "", yearsOfExperience: "",
  googleMeetLink: "", zoomLink: "", timezone: "", bio: "", displayName: "",
  specializations: [], certifications: [], password: "",
};

function Section({ icon: Icon, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-brand-primary bg-opacity-10 dark:bg-opacity-20 flex items-center justify-center flex-shrink-0">
          <Icon size={14} className="text-brand-primary" />
        </div>
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-3 pl-9">{children}</div>
    </div>
  );
}

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm " +
  "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 " +
  "placeholder-gray-400 dark:placeholder-gray-500 " +
  "focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition";

function CheckGroup({ options, selected, onChange }) {
  const toggle = (val) =>
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            selected.includes(opt)
              ? "bg-brand-primary text-white border-brand-primary"
              : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-brand-primary hover:text-brand-primary"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function TeacherModal({ isOpen, onClose, onSave, initialData }) {
  const [form, setForm] = useState(EMPTY);
  const isEdit = !!initialData;

  useEffect(() => {
    if (initialData) {
      setForm({
        firstName:         initialData.firstName || "",
        lastName:          initialData.lastName || "",
        email:             initialData.email || "",
        phone:             initialData.phone || "",
        country:           initialData.country || "",
        continent:         initialData.continent || "",
        ratePerClass:      initialData.ratePerClass ?? "",
        yearsOfExperience: initialData.yearsOfExperience ?? "",
        googleMeetLink:    initialData.googleMeetLink || "",
        zoomLink:          initialData.zoomLink || "",
        timezone:          initialData.timezone || "",
        bio:               initialData.bio || "",
        displayName:       initialData.displayName || "",
        specializations:   initialData.specializations || [],
        certifications:    initialData.certifications || [],
        password:          "",
      });
    } else {
      setForm(EMPTY);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setVal = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      id:                initialData?.id || initialData?._id,
      firstName:         form.firstName.trim(),
      lastName:          form.lastName.trim(),
      email:             form.email.trim().toLowerCase(),
      phone:             form.phone.trim(),
      country:           form.country.trim(),
      continent:         form.continent,
      ratePerClass:      parseFloat(form.ratePerClass) || 0,
      yearsOfExperience: parseInt(form.yearsOfExperience) || 0,
      googleMeetLink:    form.googleMeetLink.trim(),
      zoomLink:          form.zoomLink.trim(),
      timezone:          form.timezone,
      bio:               form.bio.trim(),
      displayName:       form.displayName.trim(),
      specializations:   form.specializations,
      certifications:    form.certifications,
      password:          form.password.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {isEdit ? "Edit Teacher" : "Add New Teacher"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {isEdit
                ? "Update teacher profile details"
                : "Fill in the details — an invite email will be sent"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5 space-y-6">

          {/* Personal Info */}
          <Section icon={User} title="Personal Information">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name" required>
                <input value={form.firstName} onChange={set("firstName")} className={inputCls} placeholder="Jane" required />
              </Field>
              <Field label="Last Name" required>
                <input value={form.lastName} onChange={set("lastName")} className={inputCls} placeholder="Smith" required />
              </Field>
            </div>
            <Field label="Display Name" hint="Nickname shown to students — leave blank to use real name">
              <input value={form.displayName} onChange={set("displayName")} className={inputCls} placeholder={`${form.firstName || "Jane"} ${form.lastName || "Smith"}`.trim()} maxLength={50} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email" required>
                <input
                  value={form.email} onChange={set("email")} type="email"
                  className={inputCls + (isEdit ? " opacity-60 cursor-not-allowed" : "")}
                  placeholder="jane@example.com" required disabled={isEdit}
                />
              </Field>
              <Field label="Phone / WhatsApp">
                <input value={form.phone} onChange={set("phone")} type="tel" className={inputCls} placeholder="+1 234 567 8900" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Country">
                <input value={form.country} onChange={set("country")} className={inputCls} placeholder="e.g. Nigeria" />
              </Field>
              <Field label="Continent" required>
                <div className="relative">
                  <select value={form.continent} onChange={set("continent")} className={inputCls + " appearance-none pr-8"} required>
                    <option value="">Select continent</option>
                    {CONTINENTS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </Field>
            </div>
          </Section>

          <div className="border-t border-gray-100 dark:border-gray-700" />

          {/* Professional Details */}
          <Section icon={DollarSign} title="Professional Details">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rate per Class (USD)">
                <input value={form.ratePerClass} onChange={set("ratePerClass")} type="number" min="0" step="0.50" className={inputCls} placeholder="e.g. 15.00" />
              </Field>
              <Field label="Years of Experience">
                <input value={form.yearsOfExperience} onChange={set("yearsOfExperience")} type="number" min="0" max="50" className={inputCls} placeholder="e.g. 3" />
              </Field>
            </div>
            <Field label="Timezone">
              <div className="relative">
                <select value={form.timezone} onChange={set("timezone")} className={inputCls + " appearance-none pr-8"}>
                  <option value="">Select timezone</option>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Google Meet Link">
                <input value={form.googleMeetLink} onChange={set("googleMeetLink")} type="url" className={inputCls} placeholder="https://meet.google.com/..." />
              </Field>
              <Field label="Zoom Link">
                <input value={form.zoomLink} onChange={set("zoomLink")} type="url" className={inputCls} placeholder="https://zoom.us/j/123456789" />
              </Field>
            </div>
          </Section>

          <div className="border-t border-gray-100 dark:border-gray-700" />

          {/* Teaching Profile */}
          <Section icon={BookOpen} title="Teaching Profile">
            <Field label="Specializations" hint="Select all that apply">
              <CheckGroup options={SPECIALIZATIONS} selected={form.specializations} onChange={setVal("specializations")} />
            </Field>
            <Field label="Certifications" hint="Select all that apply">
              <CheckGroup options={CERTIFICATIONS} selected={form.certifications} onChange={setVal("certifications")} />
            </Field>
            <Field label="Bio / About" hint="Brief description shown to students">
              <textarea
                value={form.bio} onChange={set("bio")} rows={3} maxLength={500}
                className={inputCls + " resize-none"}
                placeholder="e.g. Experienced IELTS coach with a passion for helping students reach their goals..."
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">{form.bio.length}/500</p>
            </Field>
          </Section>

          {/* Bank Details — read-only, shown when editing */}
          {isEdit && (
            <>
              <div className="border-t border-gray-100 dark:border-gray-700" />
              <Section icon={Banknote} title="Bank Details">
                {initialData?.bankName || initialData?.accountNumber ? (
                  <div className="space-y-3">
                    {[
                      { label: "Account Holder Name", value: initialData?.accountName },
                      { label: "Bank Name",            value: initialData?.bankName },
                      { label: "Account Number",       value: initialData?.accountNumber },
                    ].map(({ label, value }) => (
                      <Field key={label} label={label}>
                        <div className={inputCls + " opacity-70 cursor-default bg-gray-50 dark:bg-gray-700/50"}>
                          {value || <span className="text-gray-400">—</span>}
                        </div>
                      </Field>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Teacher has not added bank details yet.
                  </p>
                )}
              </Section>
            </>
          )}

          {/* Account — create only */}
          {!isEdit && (
            <>
              <div className="border-t border-gray-100 dark:border-gray-700" />
              <Section icon={Award} title="Account">
                <Field label="Temporary Password" hint="Leave blank — teacher sets their own password via invite email">
                  <input value={form.password} onChange={set("password")} type="text" className={inputCls} placeholder="Optional override" />
                </Field>
              </Section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {isEdit ? "Changes save immediately" : "An invite email will be sent to the teacher"}
          </p>
          <div className="flex gap-3">
            <button
              type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition"
            >
              Cancel
            </button>
            <button
              type="button" onClick={handleSubmit}
              className="px-5 py-2 text-sm font-medium bg-brand-primary text-white rounded-lg hover:opacity-90 transition"
            >
              {isEdit ? "Save Changes" : "Create & Send Invite"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
