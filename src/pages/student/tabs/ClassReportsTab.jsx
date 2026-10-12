// src/pages/student/tabs/ClassReportsTab.jsx
// The student's "Class reports": the teacher's summary of every completed class.
import api from "../../../api";
import ClassReportsList from "../../../components/ClassReportsList";
import { useTranslation } from "react-i18next";

export default function ClassReportsTab({ isDarkMode }) {
  const { t: tr } = useTranslation("student");
  return (
    <ClassReportsList
      isDarkMode={isDarkMode}
      heading={tr("classReportsTab.classReports")}
      intro="After each class your teacher writes what you did, how you did, and what to practise next."
      fetchPage={async (page) => (await api.get("/class-summaries/student", { params: { page } })).data}
    />
  );
}
