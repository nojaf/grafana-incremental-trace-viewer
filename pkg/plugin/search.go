package plugin

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/g-research/grafana-incremental-trace-viewer/pkg/opensearch"
)

func ptrTo[T any](v T) *T {
	return &v
}

func (siw *ServerInterfaceImpl) Search(w http.ResponseWriter, r *http.Request, params SearchParams) {
	log.Println("Processing search request")

	var request DataSourceInfo
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		log.Printf("Failed to decode request: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	client, err := opensearch.GetOpenSearchClient(request.URL)
	if err != nil {
		log.Printf("Failed to create OpenSearch client: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	noParentSpan := `{ "term": { "parentSpanId.keyword": { "value": "" } } }`
	timeRange := ""
	if params.Start != nil && params.End != nil {
		timeRange = fmt.Sprintf(`{ "range": { "%s": { "gte": %d, "lte": %d } } }`, request.TimeField, *params.Start, *params.End)
	}
	queryTerms := noParentSpan
	if timeRange != "" {
		queryTerms = noParentSpan + "," + timeRange
	}

	// spans without a parent span id
	openSearchQuery := fmt.Sprintf(`{
    "sort": [{ %q: "desc" }],
    "query": {
      "bool": {
        "should": [
          %s
        ]
      }
    },
    "_source": [
      "spanId",
      "traceId",
      "name",
      "parentSpanId",
      %q
    ]
  }`, request.TimeField, queryTerms, request.TimeField)

	// Parse the response into our structured format
	osResponse, err := opensearch.Search(client, request.Database, openSearchQuery)
	if err != nil {
		log.Printf("Failed to execute OpenSearch query: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Log the number of hits
	log.Printf("OpenSearch returned %d hits (total: %d)", len(osResponse.Hits.Hits), osResponse.Hits.Total.Value)

	// Transform to simplified response format
	traces := make([]TempoTrace, 0)
	for _, hit := range osResponse.Hits.Hits {
		resourceName := ""
		if r, ok := hit.Source.Resource["service.name"]; ok {
			if s, ok := r.(string); ok {
				resourceName = s
			}
		}
		trace := TempoTrace{
			TraceID:         ptrTo(hit.Source.TraceID),
			RootServiceName: &resourceName,
			RootTraceName:   ptrTo(hit.Source.Name),
			StartTime:       ptrTo(hit.Source.StartTime),
			Duration:        ptrTo(string(hit.Source.EndTime.Sub(hit.Source.StartTime).Milliseconds())),
		}
		traces = append(traces, trace)
	}

	response := TempoV1Response{
		Traces: ptrTo(traces),
	}

	w.Header().Add("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Failed to encode response to JSON: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	log.Printf("Successfully returned %d traces", len(traces))
	w.WriteHeader(http.StatusOK)
}
