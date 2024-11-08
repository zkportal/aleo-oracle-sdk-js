# Changelog

## [2.1.0] - 08.11.2024

## Added

- Default Client config now includes AWS Nitro notarizer

## Changed

- Client will no longer report an error if one of multiple attestations has failed verification, the client will return all verified attestations as long as there is at least one

## Fixed

- `AttestationResponse.attestationType` is renamed to `AttestationResponse.reportType` to align with Go SDK and API

## [2.0.0] - 19.09.2024

### Breaking

- Changes in `SgxInfo` type

### Added

- `OracleData.reportExtras` optional field with some extra encoding information about the attestation report

## [1.2.0] - 28.08.2024

### Added

- New client method `getAttestedRandom` for getting attested random numbers

## [1.1.0] - 24.05.2024

### Added

- Support for higher availability of the default notarization and verification backends

### Changed

- **BREAKING** - `CustomBackendConfig`'s `URL` is now split into multiple fields

## [1.0.0] - 22.04.2024

First public release of Aleo Oracle SDK for Go.
