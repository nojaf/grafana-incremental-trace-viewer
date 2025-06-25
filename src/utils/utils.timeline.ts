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
