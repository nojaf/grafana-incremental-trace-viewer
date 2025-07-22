# No Trace Data Available

## No Traces Found

The current query returned no trace data. This could be due to:

- **Time Range**: No traces in the selected time range
- **Query String**: Query filters are too restrictive
- **Data Source**: Connection issues with the data source
- **No Data**: No traces have been sent to the system

## How to Update the Query

### Step 1: Enter Edit Mode

Click the **edit** icon in the top-right corner of the dashboard.

### Step 2: Edit Panel

Click on this panel to open the query editor.

### Step 3: Adjust Time Range

- **Expand the time range** to include more historical data
- **Try "Last 1 hour"** or "Last 24 hours" instead of shorter periods
- **Use custom time range** to check specific periods

### Step 4: Modify Query String

- **Start with a simple query**: `{}` to see all traces
- **Remove restrictive filters** from your current query
- **Try broader service names** or remove service filters entirely

### Step 5: Save Changes

Click **Save** in the top-right corner to apply your changes.

## Example TraceQL Queries

### Start Simple

```traceql
{}                    // Show all traces (recommended first step)
```

### Filter by Service

```traceql
{service.name="my-service"}  // Replace with your service name
{service.name="api"}         // Common service names
```

### Filter by Duration

```traceql
{duration > 1s}      // Show slow traces
{duration < 100ms}   // Show fast traces
```

### TraceQL Documentation

For more detailed information about TraceQL syntax and advanced query capabilities, visit the [TraceQL Documentation](https://grafana.com/docs/tempo/latest/traceql/).

### Common Time Ranges to Try

- **Last 1 hour** - Recent traces
- **Last 6 hours** - Medium-term traces
- **Last 24 hours** - Daily traces
- **Last 7 days** - Weekly traces
- **Custom range** - Specific time periods

> **💡 Tip:** Start with `{}` and "Last 24 hours" to see if any traces exist, then narrow down your search.
