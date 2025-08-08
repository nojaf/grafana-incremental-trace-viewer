import React, { useState } from 'react';
import clsx from 'clsx';

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
  const spanAttributes: Record<string, AnyValue> = {};
  const events = [];
  for (const [key, value] of Object.entries(tagAttributes.spanAttributes)) {
    if (key.startsWith('event.') && value.stringValue !== undefined) {
      events.push({ time: parseInt(key.replace('event.', ''), 10), value: value.stringValue });
    } else {
      spanAttributes[key] = value;
    }
  }
  return { spanAttributes, events, resourceAttributes: tagAttributes.resourceAttributes };
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

  const formatValue = (value: AnyValue) => {
    if (value.stringValue !== undefined) {
      return <span className="px-2 py-2 text-cyan-400">&quot;{value.stringValue}&quot;</span>;
    } else if (value.boolValue !== undefined) {
      return <span className="px-2 py-2 text-blue-500">{value.boolValue ? 'true' : 'false'}</span>;
    } else if (value.intValue !== undefined) {
      return <span className="px-2 py-2 text-green-600">{value.intValue}</span>;
    } else if (value.doubleValue !== undefined) {
      return <span className="px-2 py-2 text-green-600">{value.doubleValue}</span>;
    } else if (value.bytesValue !== undefined) {
      return <span className="px-2 py-2 text-gray-200 italic">{JSON.stringify(value)}</span>;
    }
    return <span className="px-2 py-2 text-gray-200 italic">{JSON.stringify(value)}</span>;
  };

  const basicSpanData: KeyValue[] = [
    { key: 'Name', value: { stringValue: span.name } },
    { key: 'ID', value: { stringValue: span.spanId } },
    { key: 'Trace ID', value: { stringValue: span.traceId } },
    { key: 'Start Time', value: { stringValue: formatUnixNanoToDateTime(span.startTimeUnixNano) } },
    { key: 'End Time', value: { stringValue: formatUnixNanoToDateTime(span.endTimeUnixNano) } },
    { key: 'Duration', value: { stringValue: formatDuration(span.endTimeUnixNano - span.startTimeUnixNano) } },
  ];

  const rowClassName = (index: number) => {
    return clsx('leading-7', index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-700');
  };

  const { spanAttributes, events, resourceAttributes } = result.isSuccess
    ? splitAttributesAndEvents(result.data)
    : { spanAttributes: {}, events: [], resourceAttributes: {} };

  return (
    <div className="z-10">
      <div className="overflow-hidden text-sm">
        <table className="w-full">
          <tbody>
            {basicSpanData.map((item, index) => (
              <tr key={item.key} className={rowClassName(index)}>
                <td className="font-semibold text-gray-300 border-r border-gray-600 w-1/3 mx-4">
                  <span className="px-2 py-2">{item.key}</span>{' '}
                  {/* TODO: padding & margins are overriden to 0 by the global CSS and it is not possible to set it on the td tag */}
                </td>
                <td>{item.value && formatValue(item.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {Object.keys(spanAttributes).length > 0 && (
          <Accordion
            title="Additional Span Data"
            isExpanded={expandedSections.additionalData}
            onToggle={() => toggleSection('additionalData')}
          >
            <table className="w-full">
              <tbody>
                {Object.entries(spanAttributes).map(([key, value], index) => (
                  <tr
                    key={key}
                    className={rowClassName(basicSpanData.length + Object.keys(spanAttributes).length + index)}
                  >
                    <td className="font-semibold text-gray-300 border-r border-gray-600 w-1/3">
                      <span className="px-2 py-2">{key}</span>
                    </td>
                    <td>{formatValue(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Accordion>
        )}

        {/* Resource Section */}
        {Object.keys(resourceAttributes).length > 0 && (
          <Accordion title="Resource" isExpanded={expandedSections.process} onToggle={() => toggleSection('process')}>
            <table className="w-full">
              <tbody>
                {Object.entries(resourceAttributes).map(([key, value], index) => (
                  <tr key={key} className={rowClassName(index)}>
                    <td className="font-semibold text-gray-300 border-r border-gray-600 w-1/3">
                      <span className="px-2 py-2">{key}</span>
                    </td>
                    <td>{value && formatValue(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Accordion>
        )}

        {/* Events Section */}
        {events.length > 0 && (
          <Accordion title="Events" isExpanded={expandedSections.events} onToggle={() => toggleSection('events')}>
            <table className="w-full">
              <tbody>
                {events.map((item, index) => (
                  <tr key={item.time} className={rowClassName(index)}>
                    <td className="font-semibold text-gray-300 border-r border-gray-600 w-1/3">
                      <span className="px-2 py-2">
                        {/* print the time in seconds since the start of the span with 3 decimal places */}
                        {((item.time - span.startTimeUnixNano / 1000000) / 1000).toFixed(3)}s
                      </span>
                    </td>
                    <td>{item.value && formatValue({ stringValue: item.value })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Accordion>
        )}
      </div>
    </div>
  );
};
