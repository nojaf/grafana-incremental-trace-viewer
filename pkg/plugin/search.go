package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/opensearch-project/opensearch-go/opensearchapi"
)

func (siw *ServerInterfaceImpl) Search(w http.ResponseWriter, r *http.Request, params SearchParams) {
	log.Println("Processing search request")

	var request DataSourceInfo
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		log.Printf("Failed to decode request: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	client, err := getOpenSearchClient(request.URL)
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
	content := strings.NewReader(fmt.Sprintf(`{
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
  }`, request.TimeField, queryTerms, request.TimeField))

	search := opensearchapi.SearchRequest{
		Index: []string{request.Database},
		Body:  content,
	}

	searchResponse, err := search.Do(context.Background(), client)
	if err != nil {
		log.Printf("Failed to execute OpenSearch query: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer searchResponse.Body.Close()

	// Parse the response into our structured format
	var osResponse OpenSearchResponse
	if err := json.NewDecoder(searchResponse.Body).Decode(&osResponse); err != nil {
		log.Printf("Failed to decode OpenSearch response: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Log the number of hits
	log.Printf("OpenSearch returned %d hits (total: %d)", len(osResponse.Hits.Hits), osResponse.Hits.Total.Value)

	// Transform to simplified response format
	traces := make([]TempoTrace, 0)
	for _, hit := range osResponse.Hits.Hits {
		trace := TempoTrace{
			TraceID:           hit.Source.TraceID,
			RootServiceName:   hit.Source.Resource.Service.Name,
			RootTraceName:     hit.Source.Name,
			StartTimeUnixNano: hit.Source.StartTime.UnixNano(),
			DurationMs:        int(hit.Source.EndTime.Sub(hit.Source.StartTime).Milliseconds()),
		}
		traces = append(traces, trace)
	}

	response := SearchResponse{
		Traces: traces,
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
