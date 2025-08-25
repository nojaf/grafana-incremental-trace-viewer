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

// Based on the jaeger ui color palette,
// see https://github.com/jaegertracing/jaeger-ui/blob/704a552cfa47fc89345db23fa84d8fdc6a67efa0/packages/jaeger-ui/src/utils/color-generator.tsx#L14C1-L36
const colours: string[] = [
  '#17B8BE',
  '#F8DCA1',
  '#B7885E',
  '#FFCB99',
  '#F89570',
  '#829AE3',
  '#E79FD5',
  '#1E96BE',
  '#89DAC1',
  '#B3AD9E',
  '#12939A',
  '#DDB27C',
  '#88572C',
  '#FF9833',
  '#EF5D28',
  '#162A65',
  '#DA70BF',
  '#125C77',
  '#4DC19C',
  '#776E57',
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
    return `${minutes.toFixed(2)} min`;
  } else if (seconds >= 1) {
    return `${seconds.toFixed(2)} sec`;
  } else if (milliseconds >= 1) {
    return `${milliseconds.toFixed(2)} ms`;
  } else if (microseconds >= 1) {
    return `${microseconds.toFixed(2)} μs`;
  } else {
    return `${nanoseconds} ns`;
  }
};
