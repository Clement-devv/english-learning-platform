import React from "react";
import { useTranslation } from "react-i18next";

export default function ApplicationsTab() {
  const { t: tr } = useTranslation("admin");
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">{tr("applicationsTab.applicationsTab")}</h2>
      <p className="text-stone-600">{tr("applicationsTab.pendingApplicationsGoHere")}</p>
    </div>
  );
}
