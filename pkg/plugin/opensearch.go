package plugin

import (
	"crypto/tls"
	"net/http"
	"time"

	"github.com/opensearch-project/opensearch-go"
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
	TraceID      string    `json:"traceId"`
	SpanID       string    `json:"spanId"`
	Timestamp    time.Time `json:"@timestamp"`
	Name         string    `json:"name"`
	ParentSpanID string    `json:"parentSpanId"`
	StartTime    time.Time `json:"startTime"`
	EndTime      time.Time `json:"endTime"`
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

func getOpenSearchClient(url string) (*opensearch.Client, error) {
	client, err := opensearch.NewClient(opensearch.Config{
		Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},
		Addresses: []string{url},
	})
	if err != nil {
		return nil, err
	}
	return client, nil
}
