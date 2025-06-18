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

func (siw *ServerInterfaceImpl) GetTraces(w http.ResponseWriter, req *http.Request) {
	log.Println("Processing root traces request")

	var request GetTracesRequest
	if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
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

	// spans without a parent span id
	maxSize := 100
	content := strings.NewReader(fmt.Sprintf(`{
    "size": %d,
    "sort": [{ %q: "desc" }],
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
      %q
    ]
  }`, maxSize, request.TimeField, request.TimeField))

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
	traces := make([]Trace, 0)
	for _, hit := range osResponse.Hits.Hits {
		trace := Trace{
			TraceID:   hit.Source.TraceID,
			SpanID:    hit.Source.SpanID,
			Timestamp: hit.Source.Timestamp,
			Name:      hit.Source.Name,
		}
		traces = append(traces, trace)
	}

	response := Traces{
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
