package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/opensearch-project/opensearch-go"
	"github.com/opensearch-project/opensearch-go/opensearchapi"
)

/*
Query children spans for a parent span.
The incoming level is the level of the children spans.
*/
func queryChildrenSpans(client *opensearch.Client, traceID, parentSpanID string, skip, take int) ([]string, error) {
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
			{ "startTime": { "order": "asc" } }
		],
		"_source": [
			"spanId"
		]
	}`, take, skip, parentSpanID, traceID))

	search := opensearchapi.SearchRequest{
		Index: []string{"ss4o_traces-default-namespace"},
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

func (a *App) handleAdditionalSpans(w http.ResponseWriter, req *http.Request) {
	traceID := req.PathValue("traceId")
	spanID := req.PathValue("spanId")
	if traceID == "" || spanID == "" {
		http.Error(w, "traceId and spanId are required", http.StatusBadRequest)
		return
	}

	skip := 0
	take := 10
	childrenLimit := 3
	depth := 3
	level := 1

	q := req.URL.Query()
	if s := q.Get("skip"); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v > 0 {
			skip = v
		}
	}

	if t := q.Get("take"); t != "" {
		if v, err := strconv.Atoi(t); err == nil && v > 0 {
			take = v
		}
	}

	if c := q.Get("childrenLimit"); c != "" {
		if v, err := strconv.Atoi(c); err == nil && v > 0 {
			childrenLimit = v
		}
	}

	if d := q.Get("depth"); d != "" {
		if v, err := strconv.Atoi(d); err == nil && v > 0 {
			depth = v
		}
	}

	if l := q.Get("level"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			level = v
		}
	}

	client, err := getOpenSearchClient()
	if err != nil {
		log.Printf("Failed to create OpenSearch client: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	childrenIds, err := queryChildrenSpans(client, traceID, spanID, skip, take)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	spans := make([]SpanNode, 0, len(childrenIds))
	for _, childId := range childrenIds {
		log.Printf("Querying child span: %s", childId)
		// TODO: take is reused from the top level take, maybe we should use a different take for subsequent levels
		spansForChild, err := initialLoadPreOrder(client, traceID, childId, childrenLimit, level+1+depth, level+1)
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
