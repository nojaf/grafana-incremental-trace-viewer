package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/opensearch-project/opensearch-go"
	"github.com/opensearch-project/opensearch-go/opensearchapi"
)

/*
Query children spans for a parent span.
The incoming level is the level of the children spans.
*/
func queryChildrenSpans(client *opensearch.Client, index string, timeField string, traceID, parentSpanID string, skip, take int) ([]string, error) {
	log.Printf("Querying children spans for traceId: %s, parentSpanID: %s, skip: %d, take: %d", traceID, parentSpanID, skip, take)
	content := strings.NewReader(fmt.Sprintf(`{
		"size": %d,
		"from": %d,
		"query": {
			"bool": {
				"filter": [
					{
						"term": {
							"parentSpanId": "%s"
						}
					},
					{
						"term": {
							"traceId": "%s"
						}
					}
				]
			}
		},
		"sort": [
			{ %q: { "order": "asc" } }
		],
		"_source": [
			"spanId"
		]
	}`, take, skip, parentSpanID, traceID, timeField))

	search := opensearchapi.SearchRequest{
		Index: []string{index},
		Body:  content,
	}

	searchResponse, err := search.Do(context.Background(), client)
	if err != nil {
		return make([]string, 0), fmt.Errorf("failed to execute OpenSearch query: %v", err)
	}
	defer searchResponse.Body.Close()

	var osResponse OpenSearchResponse
	if err := json.NewDecoder(searchResponse.Body).Decode(&osResponse); err != nil {
		return make([]string, 0), fmt.Errorf("failed to decode OpenSearch response: %v", err)
	}

	childrenIds := make([]string, 0, len(osResponse.Hits.Hits))
	for _, hit := range osResponse.Hits.Hits {
		childrenIds = append(childrenIds, hit.Source.SpanID)
	}

	return childrenIds, nil
}

func (siw *ServerInterfaceImpl) GetAdditionalSpans(w http.ResponseWriter, req *http.Request, traceID string, spanID string) {
	skip := 0
	take := 10
	childrenLimit := 3
	depth := 3
	level := 1

	var requestData GetAdditionalSpansRequest
	if err := json.NewDecoder(req.Body).Decode(&requestData); err != nil {
		log.Printf("Failed to decode request: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if requestData.Skip > 0 {
		skip = requestData.Skip
	}
	if requestData.Take > 0 {
		take = requestData.Take
	}
	if requestData.ChildrenLimit > 0 {
		childrenLimit = requestData.ChildrenLimit
	}
	if requestData.Depth > 0 {
		depth = requestData.Depth
	}
	if requestData.Level > 0 {
		level = requestData.Level
	}

	client, err := getOpenSearchClient(requestData.URL)
	if err != nil {
		log.Printf("Failed to create OpenSearch client: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	childrenIds, err := queryChildrenSpans(client, requestData.Database, requestData.TimeField, traceID, spanID, skip, take)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	spans := make([]SpanNode, 0, len(childrenIds))
	for _, childId := range childrenIds {
		log.Printf("Querying child span: %s", childId)
		// TODO: take is reused from the top level take, maybe we should use a different take for subsequent levels
		spansForChild, err := initialLoadPreOrder(client, requestData.Database, requestData.TimeField, traceID, childId, childrenLimit, level+1+depth, level+1)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		spans = append(spans, spansForChild...)
	}

	w.Header().Add("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(spans); err != nil {
		log.Printf("Failed to encode response to JSON: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	log.Printf("Successfully returned %d spans for traceId: %s spanId: %s", len(spans), traceID, spanID)
}
