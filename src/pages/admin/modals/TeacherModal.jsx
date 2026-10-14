import React, { useEffect, useState } from "react";
import { User, DollarSign, BookOpen, Award, X, ChevronDown, Banknote } from "lucide-react";
import { TIMEZONE_OPTIONS } from "../../../utils/timezone";
import { useTranslation } from "react-i18next";

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
        <div className="w-7 h-7 rounded-lg bg-ad-accent-soft flex items-center justify-center flex-shrink-0">
          <Icon size={14} className="text-ad-accent-ink" />
        </div>
        <h3 className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-3 pl-9">{children}</div>
    </div>
  );
}

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full border border-stone-200 dark:border-stone-600 rounded-lg px-3 py-2 text-sm " +
  "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 " +
  "placeholder-stone-400 dark:placeholder-stone-500 " +
  "focus:outline-none focus:ring-2 focus:ring-ad-accent focus:border-transparent transition";

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
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
            selected.includes(opt)
              ? "bg-ad-accent text-ad-on-accent border-ad-accent"
              : "bg-white dark:bg-stone-700 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-600 hover:border-ad-accent hover:text-ad-accent-ink"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function TeacherModal({ isOpen, onClose, onSave, initialData }) {
  const { t: tr } = useTranslation("admin");
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Creating waits on the invite email, so block repeat clicks from re-posting
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
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
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-700 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-white">
              {isEdit ? tr("teacherModal.editTeacher") : tr("teacherModal.addNewTeacher")}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              {isEdit
                ? tr("teacherModal.updateTeacherProfileDetails")
                : tr("teacherModal.fillInTheDetailsAn")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 hover:text-stone-600 dark:hover:text-stone-300 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 min-h-0 px-6 py-5 space-y-6">

          {/* Personal Info */}
          <Section icon={User} title={tr("teacherModal.personalInformation")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={tr("teacherModal.firstName")} required>
                <input value={form.firstName} onChange={set("firstName")} className={inputCls} placeholder={tr("teacherModal.jane")} required />
              </Field>
              <Field label={tr("teacherModal.lastName")} required>
                <input value={form.lastName} onChange={set("lastName")} className={inputCls} placeholder={tr("teacherModal.smith")} required />
              </Field>
            </div>
            <Field label={tr("teacherModal.displayName")} hint={tr("teacherModal.nicknameShownToStudentsLeave")}>
              <input value={form.displayName} onChange={set("displayName")} className={inputCls} placeholder={`${form.firstName || "Jane"} ${form.lastName || "Smith"}`.trim()} maxLength={50} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={tr("teacherModal.email")} required>
                <input
                  value={form.email} onChange={set("email")} type="email"
                  className={inputCls + (isEdit ? " opacity-60 cursor-not-allowed" : "")}
                  placeholder={tr("teacherModal.janeExampleCom")} required disabled={isEdit}
                />
              </Field>
              <Field label={tr("teacherModal.phoneWhatsapp")}>
                <input value={form.phone} onChange={set("phone")} type="tel" className={inputCls} placeholder="+1 234 567 8900" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={tr("teacherModal.country")}>
                <input value={form.country} onChange={set("country")} className={inputCls} placeholder={tr("teacherModal.eGNigeria")} />
              </Field>
              <Field label={tr("teacherModal.continent")} required>
                <div className="relative">
                  <select value={form.continent} onChange={set("continent")} className={inputCls + " appearance-none pr-8"} required>
                    <option value="">{tr("teacherModal.selectContinent")}</option>
                    {CONTINENTS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                </div>
              </Field>
            </div>
          </Section>

          <div className="border-t border-stone-100 dark:border-stone-700" />

          {/* Professional Details */}
          <Section icon={DollarSign} title={tr("teacherModal.professionalDetails")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={tr("teacherModal.ratePerClassUsd")}>
                <input value={form.ratePerClass} onChange={set("ratePerClass")} type="number" min="0" step="0.50" className={inputCls} placeholder="e.g. 15.00" />
              </Field>
              <Field label={tr("teacherModal.yearsOfExperience")}>
                <input value={form.yearsOfExperience} onChange={set("yearsOfExperience")} type="number" min="0" max="50" className={inputCls} placeholder="e.g. 3" />
              </Field>
            </div>
            <Field label={tr("teacherModal.timezone")}>
              <div className="relative">
                <select value={form.timezone} onChange={set("timezone")} className={inputCls + " appearance-none pr-8"}>
                  <option value="">{tr("teacherModal.selectTimezone")}</option>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={tr("teacherModal.googleMeetLink")}>
                <input value={form.googleMeetLink} onChange={set("googleMeetLink")} type="url" className={inputCls} placeholder="https://meet.google.com/..." />
              </Field>
              <Field label={tr("teacherModal.zoomLink")}>
                <input value={form.zoomLink} onChange={set("zoomLink")} type="url" className={inputCls} placeholder="https://zoom.us/j/123456789" />
              </Field>
            </div>
          </Section>

          <div className="border-t border-stone-100 dark:border-stone-700" />

          {/* Teaching Profile */}
          <Section icon={BookOpen} title={tr("teacherModal.teachingProfile")}>
            <Field label={tr("teacherModal.specializations")} hint={tr("teacherModal.selectAllThatApply")}>
              <CheckGroup options={SPECIALIZATIONS} selected={form.specializations} onChange={setVal("specializations")} />
            </Field>
            <Field label={tr("teacherModal.certifications")} hint={tr("teacherModal.selectAllThatApply")}>
              <CheckGroup options={CERTIFICATIONS} selected={form.certifications} onChange={setVal("certifications")} />
            </Field>
            <Field label={tr("teacherModal.bioAbout")} hint={tr("teacherModal.briefDescriptionShownToStudents")}>
              <textarea
                value={form.bio} onChange={set("bio")} rows={3} maxLength={500}
                className={inputCls + " resize-none"}
                placeholder={tr("teacherModal.eGExperiencedIeltsCoach")}
              />
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-1 text-right">{form.bio.length}/500</p>
            </Field>
          </Section>

          {/* Bank Details — read-only, shown when editing */}
          {isEdit && (
            <>
              <div className="border-t border-stone-100 dark:border-stone-700" />
              <Section icon={Banknote} title={tr("teacherModal.bankDetails")}>
                {initialData?.bankName || initialData?.accountNumber ? (
                  <div className="space-y-3">
                    {[
                      { label: tr("teacherModal.accountHolderName"), value: initialData?.accountName },
                      { label: tr("teacherModal.bankName"),            value: initialData?.bankName },
                      { label: tr("teacherModal.accountNumber"),       value: initialData?.accountNumber },
                    ].map(({ label, value }) => (
                      <Field key={label} label={label}>
                        <div className={inputCls + " opacity-70 cursor-default bg-stone-50 dark:bg-stone-700/50"}>
                          {value || <span className="text-stone-400">—</span>}
                        </div>
                      </Field>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-stone-400 dark:text-stone-500">
                    {tr("teacherModal.teacherHasNotAddedBank")}
                  </p>
                )}
              </Section>
            </>
          )}

          {/* Account — create only */}
          {!isEdit && (
            <>
              <div className="border-t border-stone-100 dark:border-stone-700" />
              <Section icon={Award} title={tr("teacherModal.account")}>
                <Field label={tr("teacherModal.temporaryPassword")} hint={tr("teacherModal.leaveBlankTeacherSetsTheir")}>
                  <input value={form.password} onChange={set("password")} type="text" className={inputCls} placeholder={tr("teacherModal.optionalOverride")} />
                </Field>
              </Section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100 dark:border-stone-700 flex-shrink-0 bg-stone-50 dark:bg-stone-800/50 rounded-b-2xl">
          <p className="text-xs text-stone-400 dark:text-stone-500">
            {isEdit ? tr("teacherModal.changesSaveImmediately") : tr("teacherModal.anInviteEmailWillBe")}
          </p>
          <div className="flex gap-3">
            <button
              type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-stone-600 dark:text-stone-300 bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-600 transition"
            >
              {tr("teacherModal.cancel")}
            </button>
            <button
              type="button" onClick={handleSubmit} disabled={saving}
              className="px-5 py-2 text-sm font-medium bg-ad-accent text-ad-on-accent rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving
                ? (isEdit ? tr("teacherModal.saving") : tr("teacherModal.sendingInvite"))
                : (isEdit ? tr("teacherModal.saveChanges") : tr("teacherModal.createSendInvite"))}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
