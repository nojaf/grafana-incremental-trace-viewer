package plugin

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"

	"github.com/g-research/grafana-incremental-trace-viewer/pkg/opensearch"
)

func ptrTo[T any](v T) *T {
	return &v
}

func proxySearch(w http.ResponseWriter, datasource *DataSourceInfo, params SearchParams) {
	url := fmt.Sprintf("%s/api/search?start=%d&end=%d&q=%s", datasource.URL, params.Start, params.End, url.QueryEscape(params.Q))
	log.Printf("Proxying tempo search to %s", url)
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

func searchOpenSearch(w http.ResponseWriter, request *DataSourceInfo, params SearchParams) bool {
	client, err := opensearch.GetOpenSearchClient(request.URL)
	if err != nil {
		log.Printf("Failed to create OpenSearch client: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return true
	}

	noParentSpan := `{ "term": { "parentSpanId": { "value": "" } } }`
	timeField := "@timestamp"
	if request.TimeField != nil {
		timeField = *request.TimeField
	}
	timeRange := fmt.Sprintf(`{ "range": { "%s": { "gte": %d, "lte": %d } } }`, timeField, params.Start, params.End)

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
      "resource",
      %q
    ]
  }`, timeField, queryTerms, timeField)

	// Parse the response into our structured format
	osResponse, err := opensearch.Search(client, request.Database, openSearchQuery)
	if err != nil {
		log.Printf("Failed to execute OpenSearch query: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return true
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
			Duration:        ptrTo(strconv.FormatInt(hit.Source.EndTime.Sub(hit.Source.StartTime).Milliseconds(), 10)),
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
		return true
	}
	log.Printf("Successfully returned %d traces", len(traces))
	w.WriteHeader(http.StatusOK)
	return false
}

func (siw *ServerInterfaceImpl) Search(w http.ResponseWriter, r *http.Request, params SearchParams) {
	log.Println("Processing search request")

	var request DataSourceInfo
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		log.Printf("Failed to decode request: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if request.Type == "tempo" {
		proxySearch(w, &request, params)
		return
	}

	// Else, assume OpenSearch
	searchOpenSearch(w, &request, params)
}
