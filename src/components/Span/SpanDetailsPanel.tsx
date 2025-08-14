import React, { useState } from 'react';
import clsx from 'clsx';
import { IconButton, Input } from '@grafana/ui';

import type { SpanInfo } from '../../types';
import { mkUnixEpochFromNanoSeconds, formatUnixNanoToDateTime, formatDuration } from 'utils/utils.timeline';
import { useQuery } from '@tanstack/react-query';
import { searchTags, search, KeyValue, AnyValue, SearchTagsResult } from 'utils/utils.api';
import { Accordion } from './Accordion';

type TagAttributes = {
  spanAttributes: Record<string, AnyValue>;
  resourceAttributes: Record<string, AnyValue>;
};

async function getTagAttributes(
  datasourceUid: string,
  start: number,
  end: number,
  traceId: string,
  spanId: string,
  tagResult: SearchTagsResult
): Promise<TagAttributes> {
  // There could potentially be a lot of tags, so we need to split them into groups to avoid the query being too long.
  const groups: string[][] = [];
  let currentGroup: string[] = [];
  let currentLength = 0;
  let maxLength = 1000;

  const { spanTags, resourceTags } = tagResult;

  // Add span tags to the groups
  for (const tag of spanTags) {
    const tagIdentifier = `span.${tag}`;
    if (currentLength + tagIdentifier.length < maxLength) {
      currentGroup.push(tagIdentifier);
      currentLength += tagIdentifier.length;
    } else {
      groups.push(currentGroup);
      currentGroup = [tagIdentifier];
      currentLength = tagIdentifier.length;
    }
  }

  // Add resource tags to the groups
  for (const tag of resourceTags) {
    const tagIdentifier = `resource.${tag}`;
    if (currentLength + tagIdentifier.length < maxLength) {
      currentGroup.push(tagIdentifier);
      currentLength += tagIdentifier.length;
    } else {
      groups.push(currentGroup);
      currentGroup = [tagIdentifier];
      currentLength = tagIdentifier.length;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  const promises = groups.map(async (group) => {
    const q = `{ trace:id = "${traceId}" && span:id = "${spanId}" } | select (${group.join(', ')})`;
    const data = await search(datasourceUid, q, start, end, 1);
    return data.traces?.[0].spanSets?.[0].spans?.[0].attributes || [];
  });

  const results: KeyValue[][] = await Promise.all(promises);
  const spanAttributes: Record<string, AnyValue> = {};
  const resourceAttributes: Record<string, AnyValue> = {};
  for (const result of results) {
    for (const keyValue of result) {
      if (keyValue.key && keyValue.value !== undefined) {
        if (spanTags.includes(keyValue.key)) {
          spanAttributes[keyValue.key] = keyValue.value;
        } else {
          resourceAttributes[keyValue.key] = keyValue.value;
        }
      }
    }
  }

  return { spanAttributes, resourceAttributes };
}

function splitAttributesAndEvents(tagAttributes: TagAttributes) {
  const spanAttributes: KeyValue[] = [];
  const resourceAttributes: KeyValue[] = [];
  const events = [];
  for (const [key, value] of Object.entries(tagAttributes.spanAttributes)) {
    if (key.startsWith('event.') && value.stringValue !== undefined) {
      events.push({ time: parseInt(key.replace('event.', ''), 10), value: value.stringValue });
    } else {
      spanAttributes.push({ key, value });
    }
  }
  for (const [key, value] of Object.entries(tagAttributes.resourceAttributes)) {
    resourceAttributes.push({ key, value });
  }
  return { spanAttributes, events, resourceAttributes };
}

function ValueWrapper({
  value,
  color,
  displayValue,
  italic,
}: {
  value: any;
  color: string;
  displayValue?: React.JSX.ElementType;
  italic?: boolean;
}) {
  const [tooltip, setTooltip] = useState('Copy value');
  return (
    <span className={`flex gap-1 items-center justify-between ${italic ? 'italic' : ''}`}>
      <span className={`p-2 ${color}`}>{displayValue || value}</span>
      <IconButton
        name="copy"
        variant="secondary"
        aria-label="Copy value"
        className="bg-red-500"
        tooltip={tooltip}
        onClick={() => {
          navigator.clipboard.writeText(value || '');
          setTooltip((_) => 'Copied!');
          setTimeout(() => {
            setTooltip((_) => 'Copy value');
          }, 1000);
        }}
      />
    </span>
  );
}

function Value({ value }: { value: AnyValue }) {
  if (value.stringValue !== undefined) {
    return (
      <ValueWrapper
        value={value.stringValue}
        color="text-cyan-600 dark:text-cyan-400"
        displayValue={`"${value.stringValue}"`}
      />
    );
  } else if (value.boolValue !== undefined) {
    return <ValueWrapper value={value.boolValue ? 'true' : 'false'} color={'text-blue-600 dark:text-blue-500'} />;
  } else if (value.intValue !== undefined) {
    return <ValueWrapper value={value.intValue} color="text-green-700 dark:text-green-600" />;
  } else if (value.doubleValue !== undefined) {
    return <ValueWrapper value={value.doubleValue} color="text-green-700 dark:text-green-600" />;
  } else if (value.bytesValue !== undefined) {
    return <ValueWrapper value={JSON.stringify(value)} color="text-gray-700 dark:text-gray-200" italic />;
  }
  return <ValueWrapper value={JSON.stringify(value)} color="text-gray-700 dark:text-gray-200" italic />;
}

function useLoweredDebounce(value: string, delay: number): string {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value.toLocaleLowerCase());
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function filterKeyValue(search: string) {
  if (search === '') {
    return () => true;
  }

  return (kv: KeyValue) => {
    if (kv.key === undefined) {
      return false;
    }
    const json = JSON.stringify(kv).toLocaleLowerCase();
    return json.includes(search);
  };
}

export const SpanDetailPanel = ({
  span,
  onClose,
  datasourceUid,
}: {
  span: SpanInfo;
  onClose: () => void;
  datasourceUid: string;
}) => {
  const [expandedSections, setExpandedSections] = useState({
    additionalData: false,
    events: false,
    process: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const [search, setSearch] = useState('');
  const debouncedSearch = useLoweredDebounce(search, 200);

  const result = useQuery<TagAttributes>({
    queryKey: ['trace', span.traceId, 'span', span.spanId, 'details'],
    queryFn: async () => {
      const qTags = `{ trace:id = "${span.traceId}" && span:id = "${span.spanId}" }`;
      const start = mkUnixEpochFromNanoSeconds(span.startTimeUnixNano);
      const end = mkUnixEpochFromNanoSeconds(span.endTimeUnixNano);
      const tagsResult = await searchTags(datasourceUid, qTags, start, end);
      return getTagAttributes(datasourceUid, start, end, span.traceId, span.spanId, tagsResult);
    },
  });

  const basicSpanData: KeyValue[] = React.useMemo(
    () =>
      [
        { key: 'Name', value: { stringValue: span.name } },
        { key: 'ID', value: { stringValue: span.spanId } },
        { key: 'Trace ID', value: { stringValue: span.traceId } },
        { key: 'Start Time', value: { stringValue: formatUnixNanoToDateTime(span.startTimeUnixNano) } },
        { key: 'End Time', value: { stringValue: formatUnixNanoToDateTime(span.endTimeUnixNano) } },
        { key: 'Duration', value: { stringValue: formatDuration(span.endTimeUnixNano - span.startTimeUnixNano) } },
      ].filter(filterKeyValue(debouncedSearch)),
    [span, debouncedSearch]
  );

  const rowClassName = (index: number) => {
    return clsx(
      'text-[0.9rem] hover:bg-neutral-200 dark:hover:bg-neutral-800',
      index % 2 === 0 ? 'bg-neutral-100 dark:bg-neutral-900' : 'bg-white dark:bg-black'
    );
  };

  const { spanAttributes, events, resourceAttributes } = React.useMemo(() => {
    if (!result.isSuccess) {
      return { spanAttributes: [], events: [], resourceAttributes: [] };
    }

    let { spanAttributes, events, resourceAttributes } = splitAttributesAndEvents(result.data);

    if (debouncedSearch !== '') {
      // filter
      let filterFn = filterKeyValue(debouncedSearch);
      spanAttributes = spanAttributes.filter(filterFn);
      resourceAttributes = resourceAttributes.filter(filterFn);
      events = events.filter((event) => {
        return event.value === undefined || event.value?.toLowerCase().includes(debouncedSearch);
      });
    }

    return { spanAttributes, events, resourceAttributes };
  }, [result, debouncedSearch]);

  return (
    <div className="z-10 overflow-hidden text-sm">
      <div className="p-2">
        <div className="flex flex-col gap-4 items-start justify-between py-4 px-2 mx-4">
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="uppercase text-lg font-light">Span Details</span>
            <IconButton
              size="xxl"
              name="times"
              variant="secondary"
              aria-label="Close"
              onClick={onClose}
              className="w-4 h-4"
            />
          </div>
          <Input
            className="w-full"
            type="text"
            placeholder="Search details"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            suffix={
              search ? (
                <IconButton name="times" variant="secondary" aria-label="Clear" onClick={() => setSearch('')} />
              ) : (
                <IconButton name="search" variant="secondary" aria-label="Search" />
              )
            }
          />
        </div>
      </div>
      <div className="px-4">
        <table className="w-full text-[0.8rem]">
          <tbody>
            {basicSpanData.map((item, index) => (
              <tr key={item.key} className={rowClassName(index)}>
                <td className="font-regular text-gray-700 dark:text-gray-300  w-1/3 mx-4">
                  <span className="px-2 whitespace-nowrap">{item.key}</span>{' '}
                </td>
                <td className="font-light">{item.value && <Value value={item.value} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {spanAttributes.length > 0 && (
        <Accordion
          title="Additional Span Data"
          showToggle={debouncedSearch === ''}
          isExpanded={debouncedSearch !== '' || expandedSections.additionalData}
          onToggle={() => toggleSection('additionalData')}
        >
          <div className="px-2">
            <table className="w-full">
              <tbody>
                {spanAttributes.map(({ key, value }, index) => (
                  <tr key={key} className={rowClassName(index)}>
                    <td className="font-regular text-gray-700 dark:text-gray-300  w-1/3">
                      <span className="px-2 whitespace-nowrap">{key}</span>
                    </td>
                    <td className="font-light">{value && <Value value={value} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Accordion>
      )}

      {/* Resource Section */}
      {resourceAttributes.length > 0 && (
        <Accordion
          title="Resource"
          showToggle={debouncedSearch === ''}
          isExpanded={debouncedSearch !== '' || expandedSections.process}
          onToggle={() => toggleSection('process')}
        >
          <div className="px-2">
            <table className="w-full">
              <tbody>
                {resourceAttributes.map(({ key, value }, index) => (
                  <tr key={key} className={rowClassName(index)}>
                    <td className="font-regular text-gray-700 dark:text-gray-300  w-1/3">
                      <span className="px-2 whitespace-nowrap">{key}</span>
                    </td>
                    <td className="font-light">{value && <Value value={value} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Accordion>
      )}

      {/* Events Section */}
      {events.length > 0 && (
        <Accordion
          title="Events"
          showToggle={debouncedSearch === ''}
          isExpanded={debouncedSearch !== '' || expandedSections.events}
          onToggle={() => toggleSection('events')}
        >
          <div className="px-2">
            <table className="w-full">
              <tbody>
                {events.map((item, index) => (
                  <tr key={item.time} className={rowClassName(index)}>
                    <td className="font-regular text-gray-700 dark:text-gray-300  w-1/3">
                      <span className="px-2 whitespace-nowrap">
                        {/* print the time in seconds since the start of the span with 3 decimal places */}
                        {((item.time - span.startTimeUnixNano / 1000000) / 1000).toFixed(3)}s
                      </span>
                    </td>
                    <td className="font-light">{item.value && <Value value={{ stringValue: item.value }} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Accordion>
      )}
    </div>
  );
};
