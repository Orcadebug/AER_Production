/**
 * Security Monitoring and Alerting System
 * Detects and responds to security threats
 */

import { logger } from "./logging";

export type SecurityEventType =
  | "FAILED_LOGIN"
  | "MULTIPLE_FAILED_LOGINS"
  | "SUSPICIOUS_ACTIVITY"
  | "RATE_LIMIT_EXCEEDED"
  | "UNAUTHORIZED_ACCESS"
  | "SQL_INJECTION_ATTEMPT"
  | "XSS_ATTEMPT"
  | "CSRF_VIOLATION"
  | "DATA_BREACH_ATTEMPT"
  | "UNUSUAL_TRAFFIC";

export type SeverityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SeverityLevel;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: Record<string, any>;
  timestamp: Date;
}

export interface SecurityMetrics {
  failedLogins: number;
  rateLimitViolations: number;
  sqlInjectionAttempts: number;
  xssAttempts: number;
  csrfViolations: number;
  unusualTraffic: boolean;
  suspiciousIPs: string[];
}

/**
 * Security monitoring class
 */
class SecurityMonitor {
  private events: SecurityEvent[] = [];
  private metrics: SecurityMetrics = {
    failedLogins: 0,
    rateLimitViolations: 0,
    sqlInjectionAttempts: 0,
    xssAttempts: 0,
    csrfViolations: 0,
    unusualTraffic: false,
    suspiciousIPs: [],
  };

  private alertThresholds = {
    FAILED_LOGIN: 5,
    SQL_INJECTION_ATTEMPT: 1,
    XSS_ATTEMPT: 1,
    CSRF_VIOLATION: 3,
    RATE_LIMIT_EXCEEDED: 10,
  };

  /**
   * Record a security event
   */
  recordEvent(event: Omit<SecurityEvent, "timestamp">): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.events.push(fullEvent);
    this.updateMetrics(fullEvent);
    this.checkThresholds(fullEvent);

    // Log the event
    logger.warn("Security event detected", {
      type: event.type,
      severity: event.severity,
      userId: event.userId,
      details: event.details,
    });

    // Trim old events (keep last 1000)
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  }

  /**
   * Update metrics based on event
   */
  private updateMetrics(event: SecurityEvent): void {
    switch (event.type) {
      case "FAILED_LOGIN":
      case "MULTIPLE_FAILED_LOGINS":
        this.metrics.failedLogins++;
        break;
      case "RATE_LIMIT_EXCEEDED":
        this.metrics.rateLimitViolations++;
        break;
      case "SQL_INJECTION_ATTEMPT":
        this.metrics.sqlInjectionAttempts++;
        break;
      case "XSS_ATTEMPT":
        this.metrics.xssAttempts++;
        break;
      case "CSRF_VIOLATION":
        this.metrics.csrfViolations++;
        break;
      case "UNUSUAL_TRAFFIC":
        this.metrics.unusualTraffic = true;
        break;
    }

    // Track suspicious IPs
    if (event.ipAddress && this.isSuspicious(event)) {
      if (!this.metrics.suspiciousIPs.includes(event.ipAddress)) {
        this.metrics.suspiciousIPs.push(event.ipAddress);
      }
    }
  }

  /**
   * Check if event exceeds alert thresholds
   */
  private checkThresholds(event: SecurityEvent): void {
    const threshold = this.alertThresholds[event.type as keyof typeof this.alertThresholds];

    if (threshold && this.getEventCount(event.type, 3600000) >= threshold) {
      this.sendAlert({
        ...event,
        severity: "CRITICAL",
        details: {
          ...event.details,
          count: this.getEventCount(event.type, 3600000),
          threshold,
        },
      });
    }

    // Always alert on critical events
    if (event.severity === "CRITICAL") {
      this.sendAlert(event);
    }
  }

  /**
   * Get count of events of a specific type within a time window
   */
  private getEventCount(type: SecurityEventType, windowMs: number): number {
    const since = Date.now() - windowMs;
    return this.events.filter(
      (e) => e.type === type && e.timestamp.getTime() > since
    ).length;
  }

  /**
   * Determine if an event indicates suspicious activity
   */
  private isSuspicious(event: SecurityEvent): boolean {
    const criticalTypes: SecurityEventType[] = [
      "SQL_INJECTION_ATTEMPT",
      "XSS_ATTEMPT",
      "DATA_BREACH_ATTEMPT",
      "MULTIPLE_FAILED_LOGINS",
    ];

    return criticalTypes.includes(event.type) || event.severity === "CRITICAL";
  }

  /**
   * Send alert for critical security event
   */
  private sendAlert(event: SecurityEvent): void {
    logger.error("SECURITY ALERT", {
      type: event.type,
      severity: event.severity,
      userId: event.userId,
      ipAddress: event.ipAddress,
      details: event.details,
    });

    // TODO: Implement actual alerting
    // - Send email to security team
    // - Post to Slack/Teams
    // - Trigger PagerDuty
    // - Log to SIEM system

    if (process.env.SECURITY_WEBHOOK_URL) {
      this.sendWebhookAlert(event);
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(event: SecurityEvent): Promise<void> {
    try {
      const response = await fetch(process.env.SECURITY_WEBHOOK_URL!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: `🚨 Security Alert: ${event.type}`,
          severity: event.severity,
          event,
        }),
      });

      if (!response.ok) {
        logger.error("Failed to send security webhook", {
          status: response.status,
        });
      }
    } catch (error) {
      logger.error("Error sending security webhook", { error });
    }
  }

  /**
   * Get current security metrics
   */
  getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 100): SecurityEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Reset metrics (called periodically)
   */
  resetMetrics(): void {
    this.metrics = {
      failedLogins: 0,
      rateLimitViolations: 0,
      sqlInjectionAttempts: 0,
      xssAttempts: 0,
      csrfViolations: 0,
      unusualTraffic: false,
      suspiciousIPs: [],
    };
  }

  /**
   * Check for anomalies in current metrics
   */
  detectAnomalies(): SecurityEvent[] {
    const anomalies: SecurityEvent[] = [];

    if (this.metrics.failedLogins > 10) {
      anomalies.push({
        type: "MULTIPLE_FAILED_LOGINS",
        severity: "HIGH",
        details: { count: this.metrics.failedLogins },
        timestamp: new Date(),
      });
    }

    if (this.metrics.sqlInjectionAttempts > 0) {
      anomalies.push({
        type: "SQL_INJECTION_ATTEMPT",
        severity: "CRITICAL",
        details: { count: this.metrics.sqlInjectionAttempts },
        timestamp: new Date(),
      });
    }

    if (this.metrics.unusualTraffic) {
      anomalies.push({
        type: "UNUSUAL_TRAFFIC",
        severity: "MEDIUM",
        details: {},
        timestamp: new Date(),
      });
    }

    return anomalies;
  }
}

// Export singleton instance
export const securityMonitor = new SecurityMonitor();

/**
 * Detect potential SQL injection in input
 */
export function detectSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
    /(\bOR\b.*=.*)/i,
    /('|")(.*)(;|--)/,
    /(\\x[0-9a-f]{2})/i,
  ];

  return sqlPatterns.some((pattern) => pattern.test(input));
}

/**
 * Detect potential XSS in input
 */
export function detectXSS(input: string): boolean {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
  ];

  return xssPatterns.some((pattern) => pattern.test(input));
}

/**
 * Monitor endpoint for suspicious activity
 */
export function monitorRequest(
  endpoint: string,
  userId: string | undefined,
  params: Record<string, any>
): void {
  // Check for injection attempts
  const allValues = JSON.stringify(params);

  if (detectSQLInjection(allValues)) {
    securityMonitor.recordEvent({
      type: "SQL_INJECTION_ATTEMPT",
      severity: "CRITICAL",
      userId,
      details: { endpoint, params },
    });
  }

  if (detectXSS(allValues)) {
    securityMonitor.recordEvent({
      type: "XSS_ATTEMPT",
      severity: "CRITICAL",
      userId,
      details: { endpoint, params },
    });
  }
}
