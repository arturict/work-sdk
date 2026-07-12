# Security Policy

## Supported versions

Security fixes are provided for the latest release of Work SDK.

## Reporting a vulnerability

Please do not open a public issue for suspected vulnerabilities. Use GitHub's private vulnerability reporting for this repository. Include the affected adapter, a minimal reproduction, and the potential impact. You should receive an acknowledgement within five working days.

## Credential handling

Work SDK accepts credentials only in provider adapter configuration. Applications must keep adapters server-side and must not serialize adapter instances, environment variables, Authorization headers, or provider responses containing secrets into model context.

Prepared changes are designed to remain secret-free. Custom adapters must preserve this invariant.
