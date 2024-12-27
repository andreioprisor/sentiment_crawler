import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import puppeteerExtra from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';

// Get the directory name of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

// Function to validate required environment variables
function validateEnvVariables() {
    const requiredVars = [
        'BASE_URL',
        'BRIGHT_DATA_USERNAME',
        'BRIGHT_DATA_PASSWORD',
        'BRIGHT_DATA_HOST',
        'BRIGHT_DATA_PORT'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
}

// Configure Puppeteer plugins based on environment settings
function configurePuppeteer() {
    // Always add stealth plugin if enabled
    if (process.env.USE_STEALTH === 'true') {
        puppeteerExtra.use(stealthPlugin());
    }

    // Add recaptcha plugin if enabled and API key is provided
    if (process.env.USE_CAPTCHA === 'true' && process.env.CAPTCHA_API_KEY) {
        puppeteerExtra.use(
            RecaptchaPlugin({
                provider: {
                    id: '2captcha',
                    token: process.env.CAPTCHA_API_KEY
                },
                visualFeedback: true
            })
        );
    }

    return puppeteerExtra;
}

// Create proxy URL from components
function buildProxyUrl() {
    const { BRIGHT_DATA_USERNAME, BRIGHT_DATA_PASSWORD, BRIGHT_DATA_HOST, BRIGHT_DATA_PORT } = process.env;
    return `http://${BRIGHT_DATA_USERNAME}:${BRIGHT_DATA_PASSWORD}@${BRIGHT_DATA_HOST}:${BRIGHT_DATA_PORT}`;
}

// Validate environment variables
validateEnvVariables();

// Export configuration
export const CONFIG = {
    baseUrl: process.env.BASE_URL,
    pagesCount: parseInt(process.env.PAGES_COUNT, 10) || 3,
    proxyUrl: buildProxyUrl(),
    outputPath: process.env.OUTPUT_PATH,
    puppeteer: configurePuppeteer()
};

// Add validation function to check config at runtime
export function validateConfig() {
    const configErrors = [];
    
    if (!CONFIG.baseUrl) configErrors.push('Missing base URL');
    if (!CONFIG.proxyUrl) configErrors.push('Invalid proxy configuration');
    if (CONFIG.pagesCount < 1) configErrors.push('Invalid pages count');
    
    if (configErrors.length > 0) {
        throw new Error(`Configuration errors: ${configErrors.join(', ')}`);
    }
}

export default CONFIG;