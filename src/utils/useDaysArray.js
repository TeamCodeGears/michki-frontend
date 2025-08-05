export function getDaysArr(startDate, endDate) {
  
  if (!startDate || !endDate) return [];
  const days = [];
  const cur = new Date(startDate);
  cur.setHours(0, 0, 0, 0);
  
  while (cur <= endDate) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}
