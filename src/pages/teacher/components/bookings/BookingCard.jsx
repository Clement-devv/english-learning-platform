import { getUserTimezone, dualTime, tzCity } from "../../../../utils/timezone";

export default function BookingCard({ booking, onAccept, onReject }) {
  const myTZ = getUserTimezone();
  const dual = booking.scheduledTime
    ? dualTime(booking.scheduledTime, myTZ, booking.studentTimezone)
    : null;

  const showStudentTZ =
    dual && !dual.sameZone && booking.studentTimezone;

  return (
    <div className="flex items-center justify-between p-4 hover:bg-gray-50">
      <div>
        <h4 className="font-semibold text-gray-800 flex items-center gap-2">
          {booking.name}
          {booking.isAdminBooking && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              Admin Request
            </span>
          )}
        </h4>

        <p className="text-sm text-gray-600">Class: {booking.classTitle}</p>

        {/* Teacher's local time */}
        <p className="text-xs text-gray-500">
          Your time:{" "}
          <span className="font-medium text-gray-700">
            {dual ? `${dual.myTime} ${dual.myAbbr}` : booking.time}
          </span>
        </p>

        {/* Student's time (only if different timezone) */}
        {showStudentTZ && (
          <p className="text-xs text-blue-500">
            Student ({tzCity(booking.studentTimezone)}):{" "}
            <span className="font-medium">{dual.theirTime} {dual.theirAbbr}</span>
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onAccept(booking)}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
        >
          Accept
        </button>
        <button
          onClick={() => onReject(booking)}
          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
