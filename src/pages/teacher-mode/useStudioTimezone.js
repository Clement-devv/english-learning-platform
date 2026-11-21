import { useEffect } from 'react';
import api from '../../api';
import { getUserTimezone } from '../../utils/timezone';

// Class entry and history use the device clock. Reports must use the same zone.
export function useStudioTimezone(teacher, setUser, onError) {
  const id = teacher?._id || teacher?.id;
  useEffect(() => {
    if (!id || teacher?.inspection) return;
    let cancelled = false;
    const timezone = getUserTimezone();
    if (!timezone) return;
    api.patch('/teachers/' + id + '/timezone', { timezone }).then(() => {
      if (!cancelled) setUser?.({ timezone });
    }).catch(() => {
      if (!cancelled) onError?.('Could not sync your time zone. Refresh when online so class emails use your local time.');
    });
    return () => { cancelled = true; };
  }, [id, teacher?.inspection, setUser, onError]);
}
