package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/opensearch-project/opensearch-go/opensearchapi"
)

// Simplified trace structure for API response
type SimpleTrace struct {
	TraceID   string    `json:"traceId"`
	SpanID    string    `json:"spanId"`
	Timestamp time.Time `json:"@timestamp"`
	Name      string    `json:"name"`
}

// Response structure for root traces endpoint
type RootTracesResponse struct {
	Traces []SimpleTrace `json:"traces"`
}

func (a *App) handleTraces(w http.ResponseWriter, req *http.Request) {
	log.Println("Processing root traces request")

	client, err := getOpenSearchClient()

	if err != nil {
		log.Printf("Failed to create OpenSearch client: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// spans without a parent span id
	maxSize := 100
	content := strings.NewReader(fmt.Sprintf(`{
    "size": %d,
    "sort": [{ "@timestamp": "desc" }],
    "query": {
      "bool": {
        "should": [
          {
            "term": {
              "parentSpanId.keyword": {
                "value": ""
              }
            }
          }
        ]
      }
    },
    "_source": [
      "spanId",
      "traceId",
      "name",
      "parentSpanId",
      "@timestamp"
    ]
  }`, maxSize))

	search := opensearchapi.SearchRequest{
		Index: []string{"ss4o_traces-default-namespace"},
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
	traces := make([]SimpleTrace, 0)
	for _, hit := range osResponse.Hits.Hits {
		trace := SimpleTrace{
			TraceID:   hit.Source.TraceID,
			SpanID:    hit.Source.SpanID,
			Timestamp: hit.Source.Timestamp,
			Name:      hit.Source.Name,
		}
		traces = append(traces, trace)
	}

	response := RootTracesResponse{
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
