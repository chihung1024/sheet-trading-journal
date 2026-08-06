import {
  FrontendEnvironmentPolicyError,
  validateFrontendEnvironment,
} from './frontend_environment_policy.mjs';

try {
  const result = validateFrontendEnvironment(process.env);
  console.log(`Frontend environment policy passed (${result.context}).`);
} catch (error) {
  if (error instanceof FrontendEnvironmentPolicyError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
