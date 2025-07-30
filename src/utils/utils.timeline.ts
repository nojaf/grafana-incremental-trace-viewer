export type ISODateString = string;

export const getMillisecondsDifferenceNative = (startTime: ISODateString, endTime: ISODateString) => {
  const s = new Date(startTime);
  const e = new Date(endTime);

  // Validate if the Date objects are valid (e.g., if parsing failed)
  if (isNaN(s.getTime()) || isNaN(e.getTime())) {
    throw new Error('Invalid ISO 8601 date string provided.');
  }

  return e.getTime() - s.getTime();
};

// This is a map of curated OKLCH colour values
// Based on the theme color palette, see https://tailwindcolor.com/
const colours: string[] = [
  // 400 series (all colors)
  'oklch(0.704 0.191 22.216)', // red-400
  'oklch(0.75 0.183 55.934)', // orange-400
  'oklch(0.852 0.199 91.936)', // yellow-400
  'oklch(0.841 0.238 128.85)', // lime-400
  'oklch(0.792 0.209 151.711)', // green-400
  'oklch(0.765 0.177 163.223)', // emerald-400
  'oklch(0.777 0.152 181.912)', // teal-400
  'oklch(0.789 0.154 211.53)', // cyan-400
  'oklch(0.746 0.16 232.661)', // sky-400
  'oklch(0.707 0.165 254.624)', // blue-400
  'oklch(0.673 0.182 276.935)', // indigo-400
  'oklch(0.702 0.183 293.541)', // violet-400
  'oklch(0.714 0.203 305.504)', // purple-400
  'oklch(0.74 0.238 322.16)', // fuchsia-400
  'oklch(0.718 0.202 349.761)', // pink-400
  'oklch(0.712 0.194 13.428)', // rose-400

  // 500 series (all colors)
  'oklch(0.637 0.237 25.331)', // red-500
  'oklch(0.705 0.213 47.604)', // orange-500
  'oklch(0.795 0.184 86.047)', // yellow-500
  'oklch(0.768 0.233 130.85)', // lime-500
  'oklch(0.723 0.219 149.579)', // green-500
  'oklch(0.696 0.17 162.48)', // emerald-500
  'oklch(0.704 0.14 182.503)', // teal-500
  'oklch(0.715 0.143 215.221)', // cyan-500
  'oklch(0.685 0.169 237.323)', // sky-500
  'oklch(0.623 0.214 259.815)', // blue-500
  'oklch(0.585 0.233 277.117)', // indigo-500
  'oklch(0.606 0.25 292.717)', // violet-500
  'oklch(0.627 0.265 303.9)', // purple-500
  'oklch(0.667 0.295 322.15)', // fuchsia-500
  'oklch(0.656 0.241 354.308)', // pink-500
  'oklch(0.645 0.246 16.439)', // rose-500

  // 600 series (all colors)
  'oklch(0.577 0.245 27.325)', // red-600
  'oklch(0.646 0.222 41.116)', // orange-600
  'oklch(0.681 0.162 75.834)', // yellow-600
  'oklch(0.648 0.2 131.684)', // lime-600
  'oklch(0.627 0.194 149.214)', // green-600
  'oklch(0.596 0.145 163.225)', // emerald-600
  'oklch(0.6 0.118 184.704)', // teal-600
  'oklch(0.609 0.126 221.723)', // cyan-600
  'oklch(0.588 0.158 241.966)', // sky-600
  'oklch(0.546 0.245 262.881)', // blue-600
  'oklch(0.511 0.262 276.966)', // indigo-600
  'oklch(0.541 0.281 293.009)', // violet-600
  'oklch(0.558 0.288 302.321)', // purple-600
  'oklch(0.591 0.293 322.896)', // fuchsia-600
  'oklch(0.592 0.249 0.584)', // pink-600
  'oklch(0.586 0.253 17.585)', // rose-600
];
const usedColours = new Map<string, string>();

/// Returns a Tailwind colour for a given value
/// If the value has been seen before, it will return the same colour
/// If the value has not been seen before, it will return a new colour
export const getColourForValue = (value: string) => {
  if (usedColours.has(value)) {
    return usedColours.get(value);
  }
  const colour = colours[usedColours.size % colours.length];
  usedColours.set(value, colour);
  return colour;
};

export function mkMilisecondsFromNanoSeconds(nanoSeconds: number) {
  return nanoSeconds / 1000000;
}

export function mkUnixEpochFromNanoSeconds(nanoSeconds: number) {
  return Math.floor(nanoSeconds / Math.pow(10, 9));
}

export function mkUnixEpochFromMiliseconds(miliseconds: number) {
  return Math.floor(miliseconds / 1000);
}

export function formatUnixNanoToDateTime(nanoSeconds: number, timeZone = 'UTC'): string {
  // Convert nano seconds to milliseconds
  const milliseconds = mkMilisecondsFromNanoSeconds(nanoSeconds);

  // Create Date object from milliseconds
  const date = new Date(milliseconds);

  const options = {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    fractionalSecondDigits: 3,
    timeZoneName: 'short',
    timeZone: timeZone,
  } as Intl.DateTimeFormatOptions;

  const formattedDate = new Intl.DateTimeFormat('en-UK', options).format(date);

  return formattedDate;
}

export const formatDuration = (nanoseconds: number): string => {
  const microseconds = nanoseconds / 1000;
  const milliseconds = microseconds / 1000;
  const seconds = milliseconds / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;

  if (days >= 1) {
    return `${days.toFixed(2)} days`;
  } else if (hours >= 1) {
    return `${hours.toFixed(2)} hours`;
  } else if (minutes >= 1) {
    return `${minutes.toFixed(2)} minutes`;
  } else if (seconds >= 1) {
    return `${seconds.toFixed(2)} seconds`;
  } else if (milliseconds >= 1) {
    return `${milliseconds.toFixed(2)} ms`;
  } else if (microseconds >= 1) {
    return `${microseconds.toFixed(2)} μs`;
  } else {
    return `${nanoseconds} ns`;
  }
};
