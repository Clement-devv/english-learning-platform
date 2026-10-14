// src/pages/sub-admin/SubAdminAdminPages.jsx
// Admin pages a sub-admin can be given (admin → Sub-Admins → permissions).
// They are the admin's own pages; the server limits everything to this
// sub-admin's teachers and those teachers' students (server/middleware/staffAccess.js).
import { useEffect, useState } from "react";
import api from "../../api";
import BookingsTab from "../admin/tabs/BookingsTab.jsx";
import GroupClassesTab from "../admin/tabs/GroupClassesTab.jsx";

export { default as ClassReportTab }  from "../admin/tabs/ClassReportTab.jsx";
export { default as ParentChecksTab } from "../admin/tabs/ParentChecksTab.jsx";
export { default as ShareLinksTab }   from "../admin/tabs/ShareLinksTab.jsx";
export { default as LoggedClassesTab } from "../admin/tabs/LoggedClassesTab.jsx";

/** This sub-admin's teachers + their students (for the teacher / student pickers). */
async function loadMyPeople() {
  const { data } = await api.get("/sub-admin-scope/directory");
  return { teachers: data?.teachers || [], students: data?.students || [] };
}

/** Group classes of this sub-admin's teachers */
export function SubAdminGroupClasses({ isDarkMode }) {
  return <GroupClassesTab isDarkMode={isDarkMode} loadPeople={loadMyPeople} canSetFee={false} />;
}

/** "Book a Class": the admin booking form with only this sub-admin's people. */
export function SubAdminBookings({ isDarkMode }) {
  const [people, setPeople] = useState(null);
  useEffect(() => {
    let alive = true;
    loadMyPeople().then((p) => alive && setPeople(p)).catch(() => alive && setPeople({ teachers: [], students: [] }));
    return () => { alive = false; };
  }, []);
  if (!people) return null;
  return (
    <BookingsTab
      teachers={people.teachers}
      students={people.students}
      isDarkMode={isDarkMode}
      allowRecurring={false}
    />
  );
}
