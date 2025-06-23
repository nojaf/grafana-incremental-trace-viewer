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

func (s *ServerInterfaceImpl) GetSpanAttributes(w http.ResponseWriter, req *http.Request, traceID string, spanID string) {
	log.Printf("GetSpanAttributes: %s, %s", traceID, spanID)
	var request DatasourceInfo
	if err := json.NewDecoder(req.Body).Decode(&request); err != nil {
		log.Printf("Failed to decode request: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	client, err := getOpenSearchClient(request.URL)
	if err != nil {
		log.Printf("Failed to get OpenSearch client: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	content := strings.NewReader(fmt.Sprintf(`{
		"_source": [ "attributes" ],
		"query": {
			"bool": {
				"filter": [
					{
						"term": {
							"traceId": %q
						}
					},
					{
						"term": {
							"spanId": %q
						}
					}
				]
			}
		}
	}`, traceID, spanID))

	search := opensearchapi.SearchRequest{
		Index: []string{request.Database},
		Body:  content,
	}

	searchResponse, err := search.Do(context.Background(), client)
	if err != nil {
		log.Printf("Failed to search: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer searchResponse.Body.Close()

	var osResponse OpenSearchResponse
	if err := json.NewDecoder(searchResponse.Body).Decode(&osResponse); err != nil {
		log.Printf("Failed to decode OpenSearch response: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	log.Printf("OpenSearch response: %v", osResponse)

	if len(osResponse.Hits.Hits) == 0 {
		log.Printf("No attributes found for span %s", spanID)
		http.Error(w, "No attributes found", http.StatusNotFound)
		return
	}

	w.Header().Add("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(osResponse.Hits.Hits[0].Source.Attributes); err != nil {
		log.Printf("Failed to encode response to JSON: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	log.Printf("Successfully returned attributes for traceId: %s spanId: %s", traceID, spanID)
}
