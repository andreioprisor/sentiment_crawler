import { PuppeteerCrawler, ProxyConfiguration } from 'crawlee';
import { router } from './routes.js';
import CONFIG, { validateConfig } from './config.js';
import { createUrls } from './utils.mjs';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class CrawlerManager {
    constructor() {
        this.config = CONFIG;
        this.proxyConfiguration = this.config.proxyUrl ? 
            new ProxyConfiguration({ proxyUrls: [this.config.proxyUrl] }) : 
            undefined;
    }

    createCrawler() {
        return new PuppeteerCrawler({
            requestHandler: router,
            failedRequestHandler: this.handleFailedRequest.bind(this),
            launchContext: {
                launcher: this.config.puppeteer,
                launchOptions: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gpu',
                        '--window-size=1920,1080'
                    ]
                },
            },
            useSessionPool: true,
            sessionPoolOptions: {
                maxPoolSize: 10,
                sessionOptions: {
                    maxUsageCount: 20,
                },
            },
            maxConcurrency: 2,
            maxRequestRetries: 3,
            requestHandlerTimeoutSecs: 60,
            navigationTimeoutSecs: 30,
            ...(this.proxyConfiguration && { proxyConfiguration: this.proxyConfiguration }),
        });
    }

    async handleFailedRequest({ request, error }) {
        const errorLog = {
            url: request.url,
            errorMessage: error.message,
            timestamp: new Date().toISOString(),
            retryCount: request.retryCount
        };

        console.error('Request failed:', errorLog);

        try {
            const errorLogPath = path.join(__dirname, '..', 'error_logs.json');
            const existingLogs = await fs.readFile(errorLogPath)
                .then(data => JSON.parse(data))
                .catch(() => []);

            existingLogs.push(errorLog);
            await fs.writeFile(errorLogPath, JSON.stringify(existingLogs, null, 2));
        } catch (logError) {
            console.error('Error saving error log:', logError);
        }
    }

    async prepareUrls() {
        try {
            const cryptoPages = createUrls(this.config.baseUrl, this.config.pagesCount, 'INVESTING');
            console.log(`Generated ${cryptoPages.length} URLs`);
            console.log('Validating URLs...');
            cryptoPages.forEach(page => {
                console.log(`URL: ${page.url}`);
            });

            return cryptoPages;
        } catch (error) {
            console.error('Error preparing URLs:', error);
            throw error;
        }
    }

    async run() {
        try {
            validateConfig();
            const crawler = this.createCrawler();
            const urls = await this.prepareUrls();
            
            if (urls.length === 0) {
                throw new Error('No valid URLs to crawl');
            }

            console.log(`Starting crawler with ${urls.length} URLs`);
            await crawler.run(urls);
            console.log('Crawling completed successfully');

        } catch (error) {
            console.error('Crawler execution failed:', error);
            throw error;
        }
    }
}

// Main execution function using ES modules
const main = async () => {
    try {
        const manager = new CrawlerManager();
        await manager.run();
    } catch (error) {
        console.error('Application failed:', error);
        process.exit(1);
    }
};

main();

export default CrawlerManager;