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

export const calculateColourBySpanId = (spanId: string) => {
  const hash = spanId.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);
  return `hsl(${hash % 360}, 100%, 50%)`;
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
