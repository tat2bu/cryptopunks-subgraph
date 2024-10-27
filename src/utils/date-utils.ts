/**
 * @file date-utils.ts
 * @description Utility functions for date and timestamp operations.
 */

/**
 * Determines if a given year is a leap year.
 * @param year - The year to check.
 * @returns True if the year is a leap year, false otherwise.
 */
function isLeapYear(year: i32): bool {
  return year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
}

/**
 * Converts a Unix timestamp to a date string ID.
 * @param timestamp - The Unix timestamp to convert.
 * @param prev - Number of days to subtract from the timestamp (default: 0).
 * @returns A string representing the date in the format "YYYY-MM-DD".
 */
export function timestampToId(timestamp: i32, prev: number = 0): string {

  let secondsInMinute = 60;
  let secondsInHour = 60 * secondsInMinute;
  let secondsInDay = 24 * secondsInHour;

  if (prev) timestamp -= (secondsInDay * i32(prev));

  let daysSinceUnixEpoch = timestamp / secondsInDay;
  let remainingSeconds = timestamp % secondsInDay;

  let year = 1970;
  let daysInYear = isLeapYear(year) ? 366 : 365;
  while (daysSinceUnixEpoch >= daysInYear) {
    year += 1;
    daysSinceUnixEpoch -= daysInYear;
    daysInYear = isLeapYear(year) ? 366 : 365;
  }

  let daysInMonth = [ 31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31, ];

  let month = 0;
  while (daysSinceUnixEpoch >= daysInMonth[month]) {
    daysSinceUnixEpoch -= daysInMonth[month];
    month += 1;
  }

  let result: StaticArray<i32> = new StaticArray<i32>(3);
    result[0] = year;
    result[1] = month + 1;
    result[2] = daysSinceUnixEpoch + 1;

  let y = result[0];
  let m = result[1];
  let d = result[2];
  
  let id = y.toString() + '-' + m.toString() + '-' + d.toString();

  return id;
}