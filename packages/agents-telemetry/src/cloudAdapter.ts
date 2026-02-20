// In CloudAdapter.process():
import { recordSpan, SpanNames } from '@microsoft/agents-telemetry'

public async process(request, res, logic, headerPropagation?) {
  return recordSpan({
    name: SpanNames.ADAPTER_PROCESS,
    attributes: {
      'agents.activity.type': activity.type ?? 'unknown',
      'agents.activity.channel': activity.channelId ?? 'unknown',
      'http.method': 'POST',
    },
    fn: async (span) => {
      // ... existing process logic ...
      // Set additional attributes after processing:
      span.setAttribute('http.status_code', statusCode)
    }
  })
}
