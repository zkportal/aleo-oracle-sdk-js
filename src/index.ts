import OracleClient from './client';

import {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_NOTARIZATION_HEADERS,
  DEFAULT_FETCH_OPTIONS,
  DEFAULT_NOTARIZATION_OPTIONS,
  DEFAULT_NOTARIZATION_BACKENDS,
  DEFAULT_VERIFICATION_BACKEND,
} from './defaults';

import {
  AttestationError,
  DebugAttestationError,
  AttestationIntegrityError,
} from './errors';

import {
  ClientConfig,
  CustomBackendConfig,
  CustomBackendAllowedFetchOptions,

  AttestationRequest,
  AttestationResponse,
  DebugRequestResponse,
  EnclaveInfo,
  HeaderDict,
  InfoOptions,
  NotarizationOptions,
  OracleData,
  PositionInfo,
  ProofPositionalInfo,
  SgxInfo,
  NitroInfo,
  NitroDocument,
  NitroReportExtras,
} from './types';

export {
  OracleClient,

  DEFAULT_TIMEOUT_MS,
  DEFAULT_NOTARIZATION_HEADERS,
  DEFAULT_FETCH_OPTIONS,
  DEFAULT_NOTARIZATION_OPTIONS,
  DEFAULT_NOTARIZATION_BACKENDS,
  DEFAULT_VERIFICATION_BACKEND,

  AttestationError,
  DebugAttestationError,
  AttestationIntegrityError,

  ClientConfig,
  CustomBackendConfig,
  CustomBackendAllowedFetchOptions,

  AttestationRequest,
  AttestationResponse,
  DebugRequestResponse,
  EnclaveInfo,
  HeaderDict,
  InfoOptions,
  NotarizationOptions,
  OracleData,
  PositionInfo,
  ProofPositionalInfo,
  SgxInfo,
  NitroInfo,
  NitroDocument,
  NitroReportExtras,
};
