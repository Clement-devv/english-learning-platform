// src/pages/student/tabs/ClassReportsTab.jsx
// The student's "Class reports": the teacher's summary of every completed class.
import api from "../../../api";
import ClassReportsList from "../../../components/ClassReportsList";

export default function ClassReportsTab({ isDarkMode }) {
  return (
    <ClassReportsList
      isDarkMode={isDarkMode}
      heading="Class reports"
      intro="After each class your teacher writes what you did, how you did, and what to practise next."
      fetchPage={async (page) => (await api.get("/class-summaries/student", { params: { page } })).data}
    />
  );
}
