export const MUTATION_OUTCOME_STATUS = Object.freeze({
  COMMITTED: 'committed',
  REJECTED: 'rejected',
  AMBIGUOUS: 'ambiguous',
});

const freezeOutcome = value => Object.freeze(value);

export const committedMutationOutcome = ({
  response = null,
  refreshed = true,
  refreshError = null,
} = {}) => freezeOutcome({
  status: MUTATION_OUTCOME_STATUS.COMMITTED,
  committed: true,
  outcomeAmbiguous: false,
  refreshed: refreshed === true,
  response,
  error: null,
  refreshError: refreshError || null,
});

export const failedMutationOutcome = (error) => {
  const ambiguous = error?.outcomeAmbiguous === true;
  return freezeOutcome({
    status: ambiguous
      ? MUTATION_OUTCOME_STATUS.AMBIGUOUS
      : MUTATION_OUTCOME_STATUS.REJECTED,
    committed: false,
    outcomeAmbiguous: ambiguous,
    refreshed: false,
    response: null,
    error: error || null,
    refreshError: null,
  });
};

export const isMutationCommitted = outcome => (
  outcome?.status === MUTATION_OUTCOME_STATUS.COMMITTED
  && outcome?.committed === true
);

export const isMutationAmbiguous = outcome => (
  outcome?.status === MUTATION_OUTCOME_STATUS.AMBIGUOUS
  && outcome?.outcomeAmbiguous === true
);
