/** Half-hour location times with 24-hour values and AM/PM display labels. */
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minutes = index % 2 === 0 ? "00" : "30";
  const displayHour = hour % 12 || 12;
  const period = hour < 12 ? "AM" : "PM";

  return {
    value: `${String(hour).padStart(2, "0")}:${minutes}`,
    label: `${displayHour}:${minutes} ${period}`,
  };
});
