// Names the exit codes every cli.mjs command exits with, so call sites read
// as intent ("exit ABORTED") instead of a bare, unexplained integer.
export const OK = 0;
export const VALIDATION_FAILED = 1;
export const USAGE_ERROR = 2;
export const ABORTED = 3;
