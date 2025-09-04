import React, { useState } from 'react';
import clsx from 'clsx';
import { IconButton, Input } from '@grafana/ui';

import type { SpanInfo } from '../../types';
import { formatUnixNanoToDateTime, formatDuration } from 'utils/utils.timeline';
import { useQuery } from '@tanstack/react-query';
import {
  KeyValue,
  AnyValue,
  FetchFunction,
  TagAttributes,
  getTagAttributesForSpan,
  supportsChildCount,
} from 'utils/utils.api';
import { Accordion } from './Accordion';

function collectTagAttributes(result: KeyValue[]): TagAttributes {
  const spanAttributes: Record<string, AnyValue> = {};
  const resourceAttributes: Record<string, AnyValue> = {};

  for (const keyValue of result) {
    if (keyValue.key && keyValue.value !== undefined) {
      if (keyValue.key.startsWith('resource.')) {
        resourceAttributes[keyValue.key.replace('resource.', '')] = keyValue.value;
      } else {
        spanAttributes[keyValue.key] = keyValue.value;
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
    <tr title={displayValue || value}>
      <td className={`max-w-[1px] w-full ${italic ? 'italic' : ''}`}>
        <span className={`block truncate p-2 ${color}`}>{displayValue || value}</span>
      </td>
      <td>
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
      </td>
    </tr>
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

export function SpanDetailPanel({
  span,
  onClose,
  fetchFn,
}: {
  span: SpanInfo;
  onClose: () => void;
  fetchFn: FetchFunction<any>;
}) {
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
      if (supportsChildCount) {
        return collectTagAttributes(span.attributes);
      }

      return await getTagAttributesForSpan(
        fetchFn,
        span.traceId,
        span.spanId,
        span.startTimeUnixNano,
        span.endTimeUnixNano
      );
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
    <div data-testid="span-detail-panel" className="z-10 overflow-hidden text-sm">
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
                <td
                  className="font-regular text-gray-700 dark:text-gray-300  w-1/3 mx-4"
                  data-testid={`span-detail-panel-basic-span-data-${item.key}-key`}
                >
                  <span className="px-2 whitespace-nowrap">{item.key}</span>{' '}
                </td>
                <td className="font-light" data-testid={`span-detail-panel-basic-span-data-${item.key}-value`}>
                  {item.value && <Value value={item.value} />}
                </td>
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
                    <td
                      className="font-regular text-gray-700 dark:text-gray-300  w-1/3"
                      data-testid={`span-detail-panel-additional-span-data-${key}-key`}
                    >
                      <span className="px-2 whitespace-nowrap">{key}</span>
                    </td>
                    <td className="font-light" data-testid={`span-detail-panel-additional-span-data-${key}-value`}>
                      {value && <Value value={value} />}
                    </td>
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
                    <td
                      className="font-regular text-gray-700 dark:text-gray-300  w-1/3"
                      data-testid={`span-detail-panel-resource-${key}-key`}
                    >
                      <span className="px-2 whitespace-nowrap">{key}</span>
                    </td>
                    <td className="font-light" data-testid={`span-detail-panel-resource-${key}-value`}>
                      {value && <Value value={value} />}
                    </td>
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
                        {formatDuration(item.time - span.startTimeUnixNano)}
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
}
