import { ExperimentObservation, MetricType } from '../types';

/**
 * Manual Experiment Adapter.
 * Provides validation and sanitization for aggregate observations input manually by the user.
 * Strictly prevents the inclusion of individual-level user records, tracking tokens, or personal identifiers.
 */
export class ManualExperimentAdapter {
  /**
   * Validates a manually-entered aggregate observation.
   * Ensures data integrity and compliance with security rules.
   */
  public static validateManualObservation(obs: Partial<ExperimentObservation>): { success: boolean; error?: string } {
    if (!obs.experimentId || obs.experimentId.trim() === '') {
      return { success: false, error: 'Experiment ID is required.' };
    }
    if (!obs.variantId || obs.variantId.trim() === '') {
      return { success: false, error: 'Variant ID is required.' };
    }
    if (!obs.metricName || obs.metricName.trim() === '') {
      return { success: false, error: 'Metric Name is required.' };
    }
    if (obs.value === undefined || !Number.isFinite(obs.value)) {
      return { success: false, error: 'Metric value must be a valid finite number.' };
    }
    if (obs.sampleSize === undefined || obs.sampleSize < 0 || !Number.isInteger(obs.sampleSize)) {
      return { success: false, error: 'Sample size must be a non-negative integer.' };
    }

    // Guard against negative counts
    if (obs.numerator !== undefined && (obs.numerator < 0 || !Number.isFinite(obs.numerator))) {
      return { success: false, error: 'Numerator cannot be negative.' };
    }
    if (obs.denominator !== undefined && (obs.denominator <= 0 || !Number.isFinite(obs.denominator))) {
      return { success: false, error: 'Denominator must be a positive number.' };
    }

    // Rate specific range checks
    if (obs.metricType === MetricType.RATE) {
      if (obs.value < 0 || obs.value > 1) {
        return { success: false, error: 'Rate values must be between 0.0 and 1.0 (e.g. 0.05 for 5% CTR).' };
      }
    }

    // Prevent personal identifier / tracking token leakage
    if (obs.metadata) {
      const sensitiveKeys = [
        'email', 'user_id', 'userid', 'username', 'ip_address', 'ipaddress',
        'phone', 'cookie', 'token', 'audience_id', 'visitor_id'
      ];
      const metadataKeys = Object.keys(obs.metadata).map(k => k.toLowerCase());
      const containsSensitive = sensitiveKeys.some(sk => metadataKeys.some(mk => mk.includes(sk)));
      
      if (containsSensitive) {
        return {
          success: false,
          error: 'Security Guardrail: Personal audience data, visitor identifiers, or tracking tokens are strictly forbidden in aggregate observations.'
        };
      }
    }

    return { success: true };
  }
}
