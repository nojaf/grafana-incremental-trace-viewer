package opensearch

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/opensearch-project/opensearch-go"
	"github.com/opensearch-project/opensearch-go/opensearchapi"
)

// OpenSearch response structures
type OpenSearchResponse struct {
	Took     int    `json:"took"`
	TimedOut bool   `json:"timed_out"`
	Shards   Shards `json:"_shards"`
	Hits     Hits   `json:"hits"`
}

type Shards struct {
	Total      int `json:"total"`
	Successful int `json:"successful"`
	Skipped    int `json:"skipped"`
	Failed     int `json:"failed"`
}

type Hits struct {
	Total    Total    `json:"total"`
	MaxScore *float64 `json:"max_score"`
	Hits     []Hit    `json:"hits"`
}

type Total struct {
	Value    int    `json:"value"`
	Relation string `json:"relation"`
}

type Hit struct {
	Index  string      `json:"_index"`
	ID     string      `json:"_id"`
	Score  *float64    `json:"_score"`
	Source TraceSource `json:"_source"`
	Sort   []int64     `json:"sort"`
}

// TraceSource represents the minimal span data as returned from OpenSearch.
// It is used for traversal and data transfer, before enriching to SpanNode for API responses.
type TraceSource struct {
	TraceID                string                 `json:"traceId"`
	SpanID                 string                 `json:"spanId"`
	Timestamp              time.Time              `json:"@timestamp"`
	Name                   string                 `json:"name"`
	ParentSpanID           string                 `json:"parentSpanId"`
	StartTime              time.Time              `json:"startTime"`
	EndTime                time.Time              `json:"endTime"`
	Kind                   string                 `json:"kind"`
	Status                 Status                 `json:"status"`
	Attributes             map[string]interface{} `json:"attributes"`
	Events                 []Event                `json:"events"`
	Links                  []Link                 `json:"links"`
	TraceState             string                 `json:"traceState"`
	DroppedAttributesCount int64                  `json:"droppedAttributesCount"`
	DroppedEventsCount     int64                  `json:"droppedEventsCount"`
	DroppedLinksCount      int64                  `json:"droppedLinksCount"`
	Resource               map[string]interface{} `json:"resource"`
	InstrumentationScope   InstrumentationScope   `json:"instrumentationScope"`
}

type Status struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type DataStream struct {
	Dataset   string `json:"dataset,omitempty"`
	Namespace string `json:"namespace,omitempty"`
	Type      string `json:"type,omitempty"`
}

type Service struct {
	Name string `json:"name,omitempty"`
}

type User struct {
	Name string `json:"name,omitempty"`
}

type Event struct {
	Timestamp              time.Time              `json:"@timestamp"`
	Attributes             map[string]interface{} `json:"attributes,omitempty"`
	DroppedAttributesCount int64                  `json:"droppedAttributesCount,omitempty"`
	Name                   string                 `json:"name,omitempty"`
}

type Link struct {
	TraceID                string                 `json:"traceId,omitempty"`
	SpanID                 string                 `json:"spanId,omitempty"`
	TraceState             string                 `json:"traceState,omitempty"`
	Attributes             map[string]interface{} `json:"attributes,omitempty"`
	DroppedAttributesCount int64                  `json:"droppedAttributesCount,omitempty"`
}

type InstrumentationScope struct {
	DroppedAttributesCount int64  `json:"droppedAttributesCount,omitempty"`
	Name                   string `json:"name,omitempty"`
	SchemaURL              string `json:"schemaUrl,omitempty"`
	Version                string `json:"version,omitempty"`
}

// OpenSearch aggregation response structures
type AggregationResponse struct {
	Aggregations Aggregations `json:"aggregations"`
}

type Aggregations struct {
	ChildrenByParent ChildrenByParent `json:"children_by_parent"`
}

type ChildrenByParent struct {
	Buckets []Bucket `json:"buckets"`
}

type Bucket struct {
	Key                string     `json:"key"`
	DocCount           int        `json:"doc_count"`
	FirstThreeChildren TopHitsAgg `json:"first_three_children"`
}

type TopHitsAgg struct {
	Hits TopHitsHits `json:"hits"`
}

type TopHitsHits struct {
	Hits []Hit `json:"hits"`
}

func GetOpenSearchClient(url string) (*opensearch.Client, error) {
	client, err := opensearch.NewClient(opensearch.Config{
		Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},
		Addresses: []string{url},
	})
	if err != nil {
		return nil, err
	}
	return client, nil
}

func Search(client *opensearch.Client, index string, body string) (*OpenSearchResponse, error) {
	search := opensearchapi.SearchRequest{
		Index: []string{index},
		Body:  strings.NewReader(body),
	}

	searchResponse, err := search.Do(context.Background(), client)
	if err != nil {
		return nil, err
	}
	defer searchResponse.Body.Close()

	var osResponse OpenSearchResponse
	if err := json.NewDecoder(searchResponse.Body).Decode(&osResponse); err != nil {
		log.Printf("Failed to decode OpenSearch response: %v", err)
		return nil, err
	}

	return &osResponse, nil
}
