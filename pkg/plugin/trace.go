package plugin

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/g-research/grafana-incremental-trace-viewer/pkg/opensearch"
	os "github.com/opensearch-project/opensearch-go"
)

// Not sure what this should be, but I'm rolling with this.
const schemaUrl = "https://opentelemetry.io/schemas/1.28.0"

func convertKeyValue(key string, value interface{}) KeyValue {
	anyValue := AnyValue{}

	switch v := value.(type) {
	case string:
		anyValue.StringValue = &v
		anyValue.ValueCase = ptrTo(ValueOneofCaseStringValue)
	case int:
		iv := int64(v)
		anyValue.IntValue = &iv
		anyValue.ValueCase = ptrTo(ValueOneofCaseIntValue)
	case int64:
		anyValue.IntValue = &v
		anyValue.ValueCase = ptrTo(ValueOneofCaseIntValue)
	case []int32:
		anyValue.BytesValue = &v
		anyValue.ValueCase = ptrTo(ValueOneofCaseBytesValue)
	case float64:
		anyValue.DoubleValue = &v
		anyValue.ValueCase = ptrTo(ValueOneofCaseDoubleValue)
	case bool:
		anyValue.BoolValue = &v
		anyValue.ValueCase = ptrTo(ValueOneofCaseBoolValue)
	case map[string]interface{}:
		kv := make([]KeyValue, 0, len(v))
		for k, v := range v {
			kv = append(kv, convertKeyValue(k, v))
		}
		anyValue.KvlistValue = &KeyValueList{Values: &kv}
		anyValue.ValueCase = ptrTo(ValueOneofCaseKvlistValue)
	default:
		anyValue.ValueCase = ptrTo(ValueOneofCaseNone)
	}

	return KeyValue{
		Key:   &key,
		Value: &anyValue,
	}
}

func convertKeyValues(keyValues map[string]interface{}) []KeyValue {
	kv := make([]KeyValue, 0, len(keyValues))
	for k, v := range keyValues {
		kv = append(kv, convertKeyValue(k, v))
	}
	return kv
}

func convertHitToSpan(hit opensearch.Hit, childrenCount int) Span {
	spanAttributes := make([]KeyValue, 1, len(hit.Source.Attributes)+1)
	for k, v := range hit.Source.Attributes {
		spanAttributes = append(spanAttributes, convertKeyValue(k, v))
	}

	childrenCountInt64 := int64(childrenCount)

	spanAttributes = append(spanAttributes, KeyValue{
		Key: ptrTo("childrenCount"),
		Value: &AnyValue{
			IntValue:  &childrenCountInt64,
			ValueCase: ptrTo(ValueOneofCaseIntValue),
		},
	})

	events := make([]Event, 0, len(hit.Source.Events))
	for _, event := range hit.Source.Events {
		eventAttributes := convertKeyValues(event.Attributes)

		events = append(events, Event{
			Attributes:             ptrTo(eventAttributes),
			DroppedAttributesCount: ptrTo(int32(event.DroppedAttributesCount)),
			Name:                   ptrTo(event.Name),
		})
	}

	links := make([]Link, 0, len(hit.Source.Links))
	for _, link := range hit.Source.Links {
		linkAttributes := convertKeyValues(link.Attributes)
		links = append(links, Link{
			Attributes:             ptrTo(linkAttributes),
			DroppedAttributesCount: ptrTo(int32(link.DroppedAttributesCount)),
			TraceID:                ptrTo(link.TraceID),
			SpanID:                 ptrTo(link.SpanID),
			TraceState:             ptrTo(link.TraceState),
		})
	}

	return Span{
		Attributes:             ptrTo(spanAttributes),
		DroppedAttributesCount: ptrTo(int32(hit.Source.DroppedAttributesCount)),
		DroppedEventsCount:     ptrTo(int32(hit.Source.DroppedEventsCount)),
		DroppedLinksCount:      ptrTo(int32(hit.Source.DroppedLinksCount)),
		Events:                 ptrTo(events),
		Kind:                   ptrTo(SpanKind(hit.Source.Kind)),
		Links:                  ptrTo(links),
		Name:                   ptrTo(hit.Source.Name),
		ParentSpanID:           ptrTo(hit.Source.ParentSpanID),
		SpanID:                 ptrTo(hit.Source.SpanID),
		StartTimeUnixNano:      ptrTo(hit.Source.StartTime.UnixNano()),
		EndTimeUnixNano:        ptrTo(hit.Source.EndTime.UnixNano()),
		TraceID:                ptrTo(hit.Source.TraceID),
		TraceState:             ptrTo(hit.Source.TraceState),
		Status: &Status{
			Code:    ptrTo(StatusCode(hit.Source.Status.Code)),
			Message: ptrTo(hit.Source.Status.Message),
		},
	}
}

func fetchSpanChildrenCount(client *os.Client, datasourceInfo DataSourceInfo, traceID string, spanIDs []string) (map[string]int, error) {
	// Convert spanIDs slice to JSON array string
	spanIDsJSON, err := json.Marshal(spanIDs)
	if err != nil {
		log.Printf("Failed to marshal spanIDs: %v", err)
		return nil, err
	}

	query := fmt.Sprintf(`{
	"size": 0,
	"query": {
		"bool": {
			"must": [
				{ "term": { "traceId": %q } },
				{ "terms": { "parentSpanId": %s } }
			]
		}
	},
	"aggs": {
		"child_counts_by_parent": {
			"terms": {
				"field": "parentSpanId",
				"size": %d
			}
		}
	}
}`, traceID, string(spanIDsJSON), len(spanIDs))

	response, err := opensearch.SearchChildCounts(client, datasourceInfo.Database, query)
	if err != nil {
		log.Printf("Failed to execute child count query: %v", err)
		return nil, err
	}

	// Build the result map
	childCounts := make(map[string]int)
	for _, bucket := range response.Aggregations.ChildCountsByParent.Buckets {
		childCounts[bucket.Key] = bucket.DocCount
	}

	// Ensure all requested spanIDs are in the result (with 0 if no children)
	for _, spanID := range spanIDs {
		if _, exists := childCounts[spanID]; !exists {
			childCounts[spanID] = 0
		}
	}

	log.Printf("Found child counts for %d spans", len(childCounts))
	return childCounts, nil
}

func fetchSpanChildren(client *os.Client, datasourceInfo DataSourceInfo, traceID string, spanID string) ([]Span, error) {
	timeField := "@timestamp"
	if datasourceInfo.TimeField != nil {
		timeField = *datasourceInfo.TimeField
	}

	query := fmt.Sprintf(`{
	"size": 1000,
	"query": {
		"bool": {
			"must": [
				{ "term": { "traceId": %q } },
				{ "term": { "parentSpanId": %q } }
			]
		}
	},
	"sort": [ { %q: { "order": "asc" } }]
}`, traceID, spanID, timeField)

	openSearchResponse, err := opensearch.Search(client, datasourceInfo.Database, query)
	if err != nil {
		log.Printf("Failed to execute OpenSearch query: %v", err)
		return nil, err
	}

	log.Printf("Found %d spans for trace %s and span %s", len(openSearchResponse.Hits.Hits), traceID, spanID)

	spanIDs := make([]string, 0, len(openSearchResponse.Hits.Hits))
	for _, hit := range openSearchResponse.Hits.Hits {
		spanIDs = append(spanIDs, hit.Source.SpanID)
	}

	childrenCount, err := fetchSpanChildrenCount(client, datasourceInfo, traceID, spanIDs)
	if err != nil {
		log.Printf("Failed to fetch span children count: %v", err)
		return nil, err
	}

	spans := make([]Span, 0, len(openSearchResponse.Hits.Hits))
	for _, hit := range openSearchResponse.Hits.Hits {
		spans = append(spans, convertHitToSpan(hit, childrenCount[hit.Source.SpanID]))
	}
	return spans, nil
}

func getEntireTrace(datasourceInfo DataSourceInfo, traceID string) (TraceDetail, error) {
	client, err := opensearch.GetOpenSearchClient(datasourceInfo.URL)
	if err != nil {
		log.Printf("Failed to create OpenSearch client: %v", err)
		return TraceDetail{}, err
	}

	timeField := "@timestamp"
	if datasourceInfo.TimeField != nil {
		timeField = *datasourceInfo.TimeField
	}

	// First, get the root span to extract resource information
	rootQuery := fmt.Sprintf(`{
  "size": 1,
  "query": {
    "bool": {
      "must": [
        {
          "term": {
            "traceId": %q
          }
        },
        {
          "term": {
            "parentSpanId": ""
          }
        }
      ]
    }
  }
}`, traceID)

	rootResponse, err := opensearch.Search(client, datasourceInfo.Database, rootQuery)
	if err != nil {
		log.Printf("Failed to execute root span query: %v", err)
		return TraceDetail{}, err
	}

	if len(rootResponse.Hits.Hits) == 0 {
		log.Printf("No root span found for trace %s", traceID)
		return TraceDetail{}, fmt.Errorf("no root span found for trace %s", traceID)
	}

	rootSpan := rootResponse.Hits.Hits[0]
	resourceAttributes := convertKeyValues(rootSpan.Source.Resource)
	resource := Resource{
		Attributes: &resourceAttributes,
	}

	// Now get all spans for the trace
	query := fmt.Sprintf(`{
  "size": 10000,
  "query": {
    "bool": {
      "must": [
        {
          "term": {
            "traceId": %q
          }
        }
      ]
    }
  },
  "sort": [ { %q: { "order": "asc" } }]
}`, traceID, timeField)

	openSearchResponse, err := opensearch.Search(client, datasourceInfo.Database, query)
	if err != nil {
		log.Printf("Failed to execute OpenSearch query: %v", err)
		return TraceDetail{}, err
	}

	spanIDs := make([]string, 0, len(openSearchResponse.Hits.Hits))
	for _, hit := range openSearchResponse.Hits.Hits {
		spanIDs = append(spanIDs, hit.Source.SpanID)
	}

	childrenCount, err := fetchSpanChildrenCount(client, datasourceInfo, traceID, spanIDs)
	if err != nil {
		log.Printf("Failed to fetch span children count: %v", err)
		return TraceDetail{}, err
	}

	spans := make([]Span, 0, len(openSearchResponse.Hits.Hits))
	for _, hit := range openSearchResponse.Hits.Hits {
		spans = append(spans, convertHitToSpan(hit, childrenCount[hit.Source.SpanID]))
	}

	scopeSpans := ScopeSpans{
		Spans: &spans,
	}

	resourceSpan := ResourceSpans{
		Resource:   &resource,
		ScopeSpans: &[]ScopeSpans{scopeSpans},
	}

	return TraceDetail{
		ResourceSpans: &[]ResourceSpans{resourceSpan},
	}, nil
}

func getInitialTrace(datasourceInfo DataSourceInfo, traceID string) (TraceDetail, error) {
	client, err := opensearch.GetOpenSearchClient(datasourceInfo.URL)
	if err != nil {
		log.Printf("Failed to create OpenSearch client: %v", err)
		return TraceDetail{}, err
	}

	query := fmt.Sprintf(`{
  "query": {
    "bool": {
      "must": [
        {
          "term": {
            "traceId": %q
          }
        },
        {
          "term": {
            "parentSpanId": ""
          }
        }
      ]
    }
  }
}`, traceID)

	openSearchResponse, err := opensearch.Search(client, datasourceInfo.Database, query)
	if err != nil {
		log.Printf("Failed to execute OpenSearch query: %v", err)
		return TraceDetail{}, err
	}

	spanIDs := make([]string, 0, len(openSearchResponse.Hits.Hits))
	for _, hit := range openSearchResponse.Hits.Hits {
		spanIDs = append(spanIDs, hit.Source.SpanID)
	}

	childrenCount, err := fetchSpanChildrenCount(client, datasourceInfo, traceID, spanIDs)
	if err != nil {
		log.Printf("Failed to fetch span children count: %v", err)
		return TraceDetail{}, err
	}

	resourceSpans := make([]ResourceSpans, 0, len(openSearchResponse.Hits.Hits))
	for _, hit := range openSearchResponse.Hits.Hits {
		resourceAttributes := convertKeyValues(hit.Source.Resource)

		resource := Resource{
			Attributes: &resourceAttributes,
		}

		span := convertHitToSpan(hit, childrenCount[hit.Source.SpanID])

		childSpans, err := fetchSpanChildren(client, datasourceInfo, traceID, hit.Source.SpanID)
		if err != nil {
			log.Printf("Failed to fetch span children: %v", err)
			return TraceDetail{}, err
		}

		spans := make([]Span, 0, 1+len(childSpans))
		spans = append(spans, span)
		spans = append(spans, childSpans...)

		scopeSpans := make([]ScopeSpans, 0, 1)
		// This currently only adds the root span, but we should add all spans.
		scopeSpans = append(scopeSpans, ScopeSpans{
			SchemaURL: ptrTo(schemaUrl),
			Scope: &InstrumentationScope{
				Name:    ptrTo(hit.Source.InstrumentationScope.Name),
				Version: ptrTo(hit.Source.InstrumentationScope.Version),
				// Might be relevant, let's check with team.
				Attributes:             nil,
				DroppedAttributesCount: ptrTo(int32(hit.Source.InstrumentationScope.DroppedAttributesCount)),
			},
			Spans: ptrTo(spans),
		})

		resourceSpans = append(resourceSpans, ResourceSpans{
			Resource:   &resource,
			ScopeSpans: &scopeSpans,
			SchemaURL:  ptrTo(schemaUrl),
		})
	}

	return TraceDetail{
		ResourceSpans: &resourceSpans,
	}, nil
}

func getSubsequentTrace(datasourceInfo DataSourceInfo, traceID string, spanID string) (TraceDetail, error) {
	client, err := opensearch.GetOpenSearchClient(datasourceInfo.URL)
	if err != nil {
		log.Printf("Failed to create OpenSearch client: %v", err)
		return TraceDetail{}, err
	}

	log.Printf("Fetching spans for trace %s, span %s", traceID, spanID)

	spans, err := fetchSpanChildren(client, datasourceInfo, traceID, spanID)
	if err != nil {
		return TraceDetail{}, err
	}

	return TraceDetail{
		ResourceSpans: &([]ResourceSpans{
			{
				ScopeSpans: &[]ScopeSpans{
					{Spans: &spans},
				},
			},
		}),
	}, nil
}

func getTraceFromOpenSearch(w http.ResponseWriter, datasourceInfo DataSourceInfo, traceID string, params QueryTraceParams) {
	traceResponse := TraceDetailResponse{}

	if params.SpanID == nil {
		log.Println("Processing initial trace query request for traceId", traceID)
		var t TraceDetail
		var err error
		if params.Depth == nil {
			t, err = getEntireTrace(datasourceInfo, traceID)
		} else {
			t, err = getInitialTrace(datasourceInfo, traceID)
		}

		if err != nil {
			log.Printf("Failed to get initial trace: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		traceResponse.Trace = &t
	} else {
		if params.Depth == nil {
			log.Printf("depth is required when spanID is provided")
			http.Error(w, "?depth is required when spanID is provided", http.StatusBadRequest)
			return
		}

		if *params.Depth != 1 {
			http.Error(w, "The OpenSearch query only supports depth=1 for now", http.StatusBadRequest)
			return
		}

		log.Println("Processing subsequent trace query request for traceId", traceID, "and spanId", *params.SpanID)
		t, err := getSubsequentTrace(datasourceInfo, traceID, *params.SpanID)
		if err != nil {
			log.Printf("Failed to get subsequent trace: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		traceResponse.Trace = &t
	}

	w.Header().Add("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(traceResponse); err != nil {
		log.Printf("Failed to encode response to JSON: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	log.Printf("Successfully returned trace for traceId: %s", traceID)
}

func proxyTrace(w http.ResponseWriter, datasourceInfo DataSourceInfo, traceID string, params QueryTraceParams) {
	var url string

	if params.SpanID == nil {
		url = fmt.Sprintf(
			"%s/api/v2/traces/%s?start=%d&end=%d",
			datasourceInfo.URL,
			traceID,
			params.Start,
			params.End,
		)
	} else {
		url = fmt.Sprintf(
			"%s/api/v2/traces/%s?start=%d&end=%d&spanId=%s",
			datasourceInfo.URL,
			traceID,
			params.Start,
			params.End,
			*params.SpanID,
		)
	}

	request, err := http.NewRequest("GET", url, nil)
	if err != nil {
		log.Printf("Failed to create request for tempo search %s: %v", url, err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	request.Header.Add("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(request)
	if err != nil {
		log.Printf("Failed to proxy tempo search %s: %v", url, err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	defer resp.Body.Close()

	// Copy headers from the response
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}

	// Set the status code
	w.WriteHeader(resp.StatusCode)

	// Copy the response body
	if _, err := io.Copy(w, resp.Body); err != nil {
		log.Printf("Failed to copy response body: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

func (siw *ServerInterfaceImpl) QueryTrace(w http.ResponseWriter, req *http.Request, traceID string, params QueryTraceParams) {
	log.Println("Processing trace query request for trace", traceID)

	var request DataSourceInfo
	if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
		log.Printf("Failed to decode request: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("Raw request: %+v", request)

	if request.Type == "tempo" {
		// This only works for a custom Tempo api that supports optimized trace queries.
		proxyTrace(w, request, traceID, params)
	} else {
		getTraceFromOpenSearch(w, request, traceID, params)
	}
}
