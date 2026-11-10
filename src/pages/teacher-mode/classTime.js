// datetime-local is expressed in the teacher's device time zone. Store the
// corresponding instant, not the wall-clock string, so each viewer can render it locally.
export function classTimeToUtc(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Choose a valid class date and time.');
  return date.toISOString();
}
