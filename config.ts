/**
 * Application Configuration
 * Manages environment variables and application settings
 */

interface Config {
  apiUrl: string;
  environment: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

// Validate required environment variables
const requiredEnvVars = ['VITE_API_URL'];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !import.meta.env[varName]
);

if (missingEnvVars.length > 0 && import.meta.env.PROD) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

/**
 * Application configuration object
 * Centralizes all environment-dependent settings
 */
export const config: Config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  environment: import.meta.env.MODE || 'development',
  isDevelopment: import.meta.env.DEV || false,
  isProduction: import.meta.env.PROD || false,
};

/**
 * Log configuration in development mode
 */
if (config.isDevelopment) {
  console.log('🔧 Application Configuration:', {
    environment: config.environment,
    apiUrl: config.apiUrl,
  });
}

export default config;
