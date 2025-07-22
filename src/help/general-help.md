# Trace Viewer Help

## Understanding Distributed Tracing

The trace viewer displays a visual representation of **distributed traces**. Each trace is a collection of spans, which represent individual operations or steps in a distributed system.

## Key Concepts

### Trace

A collection of spans that represent a single request or transaction across multiple services.

### Span

An individual operation or step within a trace. Spans can be nested, representing parent-child relationships.

### Service

A logical component or service within a distributed system (e.g., API Gateway, User Service, Database).

### Duration

The total time taken for a trace or a span, typically measured in milliseconds or microseconds.

## Using the Trace Viewer

### Navigation

- **Click on spans** to view detailed information
- **Use the timeline** to understand timing relationships
- **Expand/collapse** spans to see child operations

### Querying Traces

Use **TraceQL** queries to filter and find specific traces:

```traceql
{}                    // Show all traces
{service.name="api"}  // Filter by service
{duration > 500ms}    // Filter by duration
{error=true}          // Show only error traces
```

### TraceQL Documentation

For detailed information about TraceQL syntax and capabilities, refer to the [official TraceQL documentation](https://grafana.com/docs/tempo/latest/traceql/).

### Panel Configuration

- **Resize the panel** for better visualization
- **Adjust time range** to focus on specific periods
- **Modify queries** to find relevant traces

> **💡 Tip:** Start with a simple query like `{}` to see all available traces, then refine your search based on what you find.
