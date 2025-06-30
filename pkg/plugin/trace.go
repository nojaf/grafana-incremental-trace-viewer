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

func convertIdToBytes(id string) []int32 {
	bytes := make([]int32, 0, len(id))
	for _, c := range id {
		bytes = append(bytes, int32(c))
	}
	return bytes
}

func convertBytesToId(bytes []int32) string {
	runes := make([]rune, 0, len(bytes))
	for _, b := range bytes {
		runes = append(runes, rune(b))
	}
	return string(runes)
}

func convertHitToSpan(hit opensearch.Hit) Span {
	spanAttributes := make([]KeyValue, 0, len(hit.Source.Attributes))
	for k, v := range hit.Source.Attributes {
		spanAttributes = append(spanAttributes, convertKeyValue(k, v))
	}

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
			TraceID:                ptrTo(convertIdToBytes(link.TraceID)),
			SpanID:                 ptrTo(convertIdToBytes(link.SpanID)),
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
		ParentSpanID:           ptrTo(convertIdToBytes(hit.Source.ParentSpanID)),
		SpanID:                 ptrTo(convertIdToBytes(hit.Source.SpanID)),
		StartTimeUnixNano:      ptrTo(hit.Source.StartTime.UnixNano()),
		EndTimeUnixNano:        ptrTo(hit.Source.EndTime.UnixNano()),
		TraceID:                ptrTo(convertIdToBytes(hit.Source.TraceID)),
		TraceState:             ptrTo(hit.Source.TraceState),
		Status: &Status{
			Code:    ptrTo(StatusCode(hit.Source.Status.Code)),
			Message: ptrTo(hit.Source.Status.Message),
		},
	}
}

func fetchSpanChildren(client *os.Client, datasourceInfo DataSourceInfo, traceID string, spanID string, skip int, take int) ([]Span, error) {
	timeField := "@timestamp"
	if datasourceInfo.TimeField != nil {
		timeField = *datasourceInfo.TimeField
	}

	query := fmt.Sprintf(`{
	"size": %d,
	"from": %d,
	"query": {
		"bool": {
			"must": [
				{ "term": { "traceId": %q } },
				{ "term": { "parentSpanId": %q } }
			]
		}
	},
	"sort": [ { %q: { "order": "asc" } }]
}`, take, skip, traceID, spanID, timeField)

	openSearchResponse, err := opensearch.Search(client, datasourceInfo.Database, query)
	if err != nil {
		log.Printf("Failed to execute OpenSearch query: %v", err)
		return nil, err
	}

	log.Printf("Found %d spans for trace %s and span %s, skipping %d and taking %d", len(openSearchResponse.Hits.Hits), traceID, spanID, skip, take)

	spans := make([]Span, 0, len(openSearchResponse.Hits.Hits))
	for _, hit := range openSearchResponse.Hits.Hits {
		spans = append(spans, convertHitToSpan(hit))
	}
	return spans, nil
}

func fetchChildrenWithDepth(client *os.Client, datasourceInfo DataSourceInfo, traceID string, spanID string, skip int, take int, currentDepth int, maxDepth int) ([]Span, error) {
	if currentDepth > maxDepth {
		return make([]Span, 0), nil
	}

	allSpans := make([]Span, 0)

	currentSpans, err := fetchSpanChildren(client, datasourceInfo, traceID, spanID, skip, take)
	if err != nil {
		return nil, err
	}

	for _, span := range currentSpans {
		// Add the current span to the list of all spans.
		allSpans = append(allSpans, span)

		// Fetch the children of the current span, recursively.
		children, err := fetchChildrenWithDepth(client, datasourceInfo, traceID, convertBytesToId(*span.SpanID) /* don't skip any children */, 0, take, currentDepth+1, maxDepth)
		if err != nil {
			return nil, err
		}

		allSpans = append(allSpans, children...)
	}

	return allSpans, nil
}

func getInitialTrace(datasourceInfo DataSourceInfo, traceID string, params QueryTraceParams) (TracesData, error) {
	client, err := opensearch.GetOpenSearchClient(datasourceInfo.URL)
	if err != nil {
		log.Printf("Failed to create OpenSearch client: %v", err)
		return TracesData{}, err
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
		return TracesData{}, err
	}

	resourceSpans := make([]ResourceSpans, 0, len(openSearchResponse.Hits.Hits))
	for _, hit := range openSearchResponse.Hits.Hits {
		resourceAttributes := convertKeyValues(hit.Source.Resource)

		resource := Resource{
			Attributes: &resourceAttributes,
		}

		span := convertHitToSpan(hit)

		take := 10
		if params.Take != nil {
			take = *params.Take
		}

		maxDepth := 5
		if params.Depth != nil {
			maxDepth = *params.Depth
		}

		childSpans, err := fetchChildrenWithDepth(
			client,
			datasourceInfo,
			traceID,
			hit.Source.SpanID,
			/* skip */ 0,
			take,
			/* currentDepth */ 1,
			maxDepth,
		)
		if err != nil {
			log.Printf("Failed to fetch span children: %v", err)
			return TracesData{}, err
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

	return TracesData{
		ResourceSpans: &resourceSpans,
	}, nil
}

func getSubsequentTrace(datasourceInfo DataSourceInfo, traceID string, spanID string, params QueryTraceParams) (TracesData, error) {
	client, err := opensearch.GetOpenSearchClient(datasourceInfo.URL)
	if err != nil {
		log.Printf("Failed to create OpenSearch client: %v", err)
		return TracesData{}, err
	}

	skip := 0
	if params.Skip != nil {
		skip = *params.Skip
	}

	take := 10
	if params.Take != nil {
		take = *params.Take
	}

	depth := 5
	if params.Depth != nil {
		depth = *params.Depth
	}

	log.Printf("Fetching spans for trace %s, span %s, skipping %d, taking %d, depth %d", traceID, spanID, skip, take, depth)

	spans, err := fetchChildrenWithDepth(client, datasourceInfo, traceID, spanID, skip, take, 1, depth)
	if err != nil {
		return TracesData{}, err
	}

	return TracesData{
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
	var trace TracesData

	if params.SpanID == nil {
		log.Println("Processing initial trace query request for traceId", traceID)
		t, err := getInitialTrace(datasourceInfo, traceID, params)
		if err != nil {
			log.Printf("Failed to get initial trace: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		trace = t
	} else {
		log.Println("Processing subsequent trace query request for traceId", traceID, "and spanId", *params.SpanID)
		t, err := getSubsequentTrace(datasourceInfo, traceID, *params.SpanID, params)
		if err != nil {
			log.Printf("Failed to get subsequent trace: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		trace = t
	}

	w.Header().Add("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(trace); err != nil {
		log.Printf("Failed to encode response to JSON: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	log.Printf("Successfully returned trace for traceId: %s", traceID)
}

func proxyTrace(w http.ResponseWriter, datasourceInfo DataSourceInfo, traceID string, params QueryTraceParams) {
	depth := 5
	if params.Depth != nil {
		depth = *params.Depth
	}

	childrenLimit := 10
	if params.ChildrenLimit != nil {
		childrenLimit = *params.ChildrenLimit
	}

	var url string

	if params.SpanID == nil {
		url = fmt.Sprintf(
			"%s/api/v2/traces/%s?start=%d&end=%d&spanId=%s&depth=%d&childrenLimit=%d",
			datasourceInfo.URL,
			traceID,
			params.Start,
			params.End,
			*params.SpanID,
			depth,
			childrenLimit,
		)
	} else {
		skip := 0
		if params.Skip != nil {
			skip = *params.Skip
		}

		take := 10
		if params.Take != nil {
			take = *params.Take
		}

		url = fmt.Sprintf(
			"%s/api/v2/traces/%s?start=%d&end=%d&spanId=%s&depth=%d&childrenLimit=%d&skip=%d&take=%d",
			datasourceInfo.URL,
			traceID,
			params.Start,
			params.End,
			*params.SpanID,
			depth,
			childrenLimit,
			skip,
			take,
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

	if request.Type == "tempo" {
		// This only works for a custom Tempo api that supports optimized trace queries.
		proxyTrace(w, request, traceID, params)
	} else {
		getTraceFromOpenSearch(w, request, traceID, params)
	}
}
