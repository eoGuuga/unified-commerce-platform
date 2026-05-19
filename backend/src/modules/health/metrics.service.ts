import { Injectable, OnModuleInit } from '@nestjs/common';

interface RequestMetric {
  total: number;
  byStatus: Record<string, number>;
  byMethod: Record<string, number>;
}

@Injectable()
export class MetricsService implements OnModuleInit {
  private startTime = Date.now();
  private requests: RequestMetric = {
    total: 0,
    byStatus: {},
    byMethod: {},
  };
  private eventLoopLagMs = 0;
  private lagInterval: ReturnType<typeof setInterval>;

  onModuleInit() {
    this.measureEventLoopLag();
  }

  recordRequest(method: string, statusCode: number) {
    this.requests.total++;
    const statusGroup = `${Math.floor(statusCode / 100)}xx`;
    this.requests.byStatus[statusGroup] = (this.requests.byStatus[statusGroup] || 0) + 1;
    this.requests.byMethod[method] = (this.requests.byMethod[method] || 0) + 1;
  }

  getPrometheusMetrics(): string {
    const lines: string[] = [];
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const mem = process.memoryUsage();

    lines.push('# HELP ucm_uptime_seconds Tempo desde o boot do processo');
    lines.push('# TYPE ucm_uptime_seconds gauge');
    lines.push(`ucm_uptime_seconds ${uptimeSeconds}`);

    lines.push('# HELP ucm_memory_heap_used_bytes Heap usada pelo processo');
    lines.push('# TYPE ucm_memory_heap_used_bytes gauge');
    lines.push(`ucm_memory_heap_used_bytes ${mem.heapUsed}`);

    lines.push('# HELP ucm_memory_heap_total_bytes Heap total alocada');
    lines.push('# TYPE ucm_memory_heap_total_bytes gauge');
    lines.push(`ucm_memory_heap_total_bytes ${mem.heapTotal}`);

    lines.push('# HELP ucm_memory_rss_bytes Resident Set Size');
    lines.push('# TYPE ucm_memory_rss_bytes gauge');
    lines.push(`ucm_memory_rss_bytes ${mem.rss}`);

    lines.push('# HELP ucm_memory_external_bytes Memoria externa (buffers C++)');
    lines.push('# TYPE ucm_memory_external_bytes gauge');
    lines.push(`ucm_memory_external_bytes ${mem.external}`);

    lines.push('# HELP ucm_event_loop_lag_ms Latencia do event loop');
    lines.push('# TYPE ucm_event_loop_lag_ms gauge');
    lines.push(`ucm_event_loop_lag_ms ${this.eventLoopLagMs.toFixed(2)}`);

    lines.push('# HELP ucm_http_requests_total Total de requests HTTP');
    lines.push('# TYPE ucm_http_requests_total counter');
    lines.push(`ucm_http_requests_total ${this.requests.total}`);

    lines.push('# HELP ucm_http_requests_by_status Requests por grupo de status');
    lines.push('# TYPE ucm_http_requests_by_status counter');
    for (const [status, count] of Object.entries(this.requests.byStatus)) {
      lines.push(`ucm_http_requests_by_status{status="${status}"} ${count}`);
    }

    lines.push('# HELP ucm_http_requests_by_method Requests por metodo HTTP');
    lines.push('# TYPE ucm_http_requests_by_method counter');
    for (const [method, count] of Object.entries(this.requests.byMethod)) {
      lines.push(`ucm_http_requests_by_method{method="${method}"} ${count}`);
    }

    lines.push('# HELP ucm_nodejs_version Versao do Node.js');
    lines.push('# TYPE ucm_nodejs_version gauge');
    lines.push(`ucm_nodejs_version{version="${process.version}"} 1`);

    return lines.join('\n') + '\n';
  }

  private measureEventLoopLag() {
    this.lagInterval = setInterval(() => {
      const start = Date.now();
      setImmediate(() => {
        this.eventLoopLagMs = Date.now() - start;
      });
    }, 2000);

    if (this.lagInterval.unref) {
      this.lagInterval.unref();
    }
  }
}
