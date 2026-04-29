/**
 * Contract execution state machine — derives execution status from contract record.
 */

export function isContractSignableStatus(status) {
  return status === 'sent' || status === 'viewed';
}

export function deriveExecutionStatus(contract) {
  if (contract.status !== 'signed') return 'not_signed';
  if (!contract.template_version && !contract.provider_signed_at) return 'executed_legacy';
  if (contract.countersign_required && !contract.provider_signed_at) return 'pending_provider';
  return 'executed';
}

export function withExecutionStatus(contract) {
  return { ...contract, execution_status: deriveExecutionStatus(contract) };
}
