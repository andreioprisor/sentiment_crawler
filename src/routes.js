import { Log, Router, createPuppeteerRouter, enqueueLinks, Dataset, log} from 'crawlee';
import {scrollPageToBottom, scrollPageToTop} from 'puppeteer-autoscroll-down';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import puppeteerExtra from 'puppeteer-extra';
import { Page } from 'puppeteer';
puppeteerExtra.use(stealthPlugin());
let cookies;
const currentTime = new Date().toISOString(); // Log the current time

export const router = createPuppeteerRouter();

// Function to mimic human-like scrolling behavior
async function humanLikeScroll(page, scrollStep = 100, scrollDelay = 50, variability = 30, maxDuration = 4000) {
    let currentHeight = 0;
    const scrollHeight = await page.evaluate('document.body.scrollHeight');
    const startTime = Date.now();

    while (currentHeight < scrollHeight) {
        if (Date.now() - startTime > maxDuration) {
            console.log('Timeout reached, stopping scroll');
            break; // Exit if the maximum duration is exceeded
        }

        // Randomize scroll step and delay to simulate human behavior
        const randomStep = scrollStep + Math.floor(Math.random() * variability);
        const randomDelay = scrollDelay + Math.floor(Math.random() * variability);
        
        await page.evaluate((step) => {
            window.scrollBy(0, step);
        }, scrollHeight);

        currentHeight += randomStep;
        if (currentHeight >= scrollHeight) {
            await page.evaluate
            break;
        }
        await new Promise(resolve => setTimeout(resolve, randomDelay));
    }

    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
}


// Function to push data to the dataset with logging
async function getDynamicScrollItems(
    page,
    itemsSelector,
    storeFunction,
    maxRetries = 6,
    scrollStep = 100,
    scrollDelay = 50,
    variability = 30
){
    while (isLoadingAvailable && retryCount < maxRetries) {
        await humanLikeScroll(page)
        await new Promise(resolve => setTimeout(resolve, 2000));
        

        items = await page.$$eval('div.block.w-full.sm\\:flex-1', elements => {
            return elements.map(element => {
                const linkElement = element.querySelector('a[data-test="article-title-link"]');
                const newsProviderElement = element.querySelector('span[data-test="news-provider-name"]');
        
                const href = linkElement ? linkElement.href : null;
                const newsProvider = newsProviderElement ? newsProviderElement.textContent.trim() : null;
        
                return { href, newsProvider };
            });
        });

        log.info(`Found ${items.length} items`);

        if (items.length > previousItemCount) {
            previousItemCount = items.length;
            retryCount = 0; // Reset retry counter if new items are found
        } else {
            retryCount++; // Increment retry counter if no new items are found
        }
        await pushData({ items });
    }
}




router.addDefaultHandler(async ({ enqueueLinks, log, page, pushData}) => {
    // log.info(`enqueueing new URLs`);
    // log.info(`Current URL: ${page.url()}`);

    if (page.url().includes('consent')) {
        cookies = await page.cookies();
        log.info(`Handling consent page`);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'load' }), // Wait for navigation
            page.click('button[type="submit"]') // Click the consent button
        ]);
        log.info(`Clicked on the consent button`);
    }

    // let isLoadingAvailable = true 
    // let items = [];
    // while (isLoadingAvailable) {
    //     await scrollPageToBottom(page, { size: 500 })
    //     items = await page.$$eval("a.subtle-link.fin-size-small.thumb.yf-13p9sh2", elements => elements.map(el => el.href));
    //     log.info(`Found ${items.length} items`);
    //     await new Promise(resolve => setTimeout(resolve, 3000));
    //     if (items.length > 290) {
    //         isLoadingAvailable = false
    //     }
    // }
    // await pushData({ items });
});

router.addHandler('YFINANCE', async ({ enqueueLinks, request, page, log, pushData }) => {
    if (page.url().includes('consent')) {
        cookies = await page.cookies();
        log.info(`Handling consent page`);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'load' }), // Wait for navigation
            page.click('button[type="submit"]') // Click the consent button
        ]);
        log.info(`Clicked on the consent button`);
    }

    let isLoadingAvailable = true // Your condition-to-stop
    let items = [];
    while (isLoadingAvailable) {
        await scrollPageToBottom(page, { size: 500 })
        items = await page.$$eval("a.subtle-link.fin-size-small.thumb.yf-13p9sh2", elements => elements.map(el => el.href));
        log.info(`Found ${items.length} items`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        if (items.length > 290) {
            isLoadingAvailable = false
        }
    }
    await pushData({ items });
});

// First handler for the main news page
router.addHandler('INVESTING', async ({ request, page, log, enqueueLinks }) => {
    // Set viewport for consistent rendering
    await page.setViewport({width: 1280, height: 800});
    
    // Handle cookie consent - this is a common pattern for both handlers
    try {
        await page.waitForSelector('#onetrust-accept-btn-handler', {
            visible: true,
            timeout: 2000
        });
        await page.click('#onetrust-accept-btn-handler');
        log.info('Handled cookie consent successfully');
    } catch (error) {
        if (error.name === 'TimeoutError') {
            log.info('No consent button found, continuing with page processing');
        } else {
            log.error('Error handling consent:', error);
            throw error;
        }
    }

    // Extract article links and enqueue them for processing
    try {
        // Find all article containers
        const articleContainers = await page.$$('div.news-analysis-v2_content__z0iLP.w-full');
        log.info(`Found ${articleContainers.length} article containers`);

        // Process each container and create requests for enqueuing
        for (const container of articleContainers) {
            const articleData = await page.evaluate(element => {
                const linkElement = element.querySelector('a[data-test="article-title-link"]');
                const newsProviderElement = element.querySelector('span[data-test="news-provider-name"]');
                
                return {
                    url: linkElement ? linkElement.href : null,
                    newsProvider: newsProviderElement ? newsProviderElement.textContent.trim() : null
                };
            }, container);

            // Only enqueue valid URLs
            if (articleData.url) {
                // Enqueue the article URL with the INVESTING-ARTICLE label
                await enqueueLinks({
                    urls: [articleData.url],
                    label: 'INVESTING-ARTICLE',
                    // Pass additional context if needed
                    userData: {
                        newsProvider: articleData.newsProvider,
                        discoveredAt: new Date().toISOString()
                    }
                });
                log.debug(`Enqueued article: ${articleData.url}`);
            }
        }
    } catch (error) {
        log.error('Error processing article links:', error);
        throw error;
    }
});

// The article handler remains mostly the same but can now access userData
router.addHandler('INVESTING-ARTICLE', async ({ request, page, log, pushData }) => {
    // Cookie consent handling remains the same
    try {
        await page.waitForSelector('#onetrust-accept-btn-handler', {
            visible: true,
            timeout: 2000
        });
        await page.click('#onetrust-accept-btn-handler');
        log.info('Handled cookie consent');
    } catch (error) {
        if (error.name === 'TimeoutError') {
            log.info('No consent button found, continuing with article processing');
        } else {
            log.error('Error handling consent:', error);
            throw error;
        }
    }

    try {
        // Extract article content with escaped selectors
        const articleData = await page.evaluate(() => {
            // Helper function to safely get text content
            const safeTextContent = (selector, context = document) => {
                const element = context.querySelector(selector);
                return element ? element.textContent.trim() : '';
            };

            // Helper function to safely get array of text content
            const safeTextContentArray = (selector, context = document) => {
                const elements = context.querySelectorAll(selector);
                return Array.from(elements).map(el => el.textContent.trim());
            };

            return {
                title: safeTextContent('#articleTitle'),
                date: safeTextContent('div.flex.flex-row.items-center > span'),
                // Use a more robust selector for tickers
                tickers: safeTextContentArray('span[class*="w-"][class*="px"]'),
                content: safeTextContentArray('div[class*="article_WYSIWYG"]' +
                    '[class*="article_articlePage"] p').join('\n\n')
            };
        });

        // Add metadata
        articleData.url = page.url();
        articleData.newsProvider = request.userData?.newsProvider;
        articleData.discoveredAt = request.userData?.discoveredAt;
        articleData.processedAt = new Date().toISOString();

        // Validate the extracted data
        if (!articleData.title) {
            log.warning(`No title found for article: ${articleData.url}`);
        }

        await pushData(articleData);
        log.info(`Successfully processed article: ${articleData.title}`);
        
    } catch (error) {
        log.error(`Error processing article content for URL ${request.url}:`, error);
        throw error;
    }
});

// Handler for collecting article links from Motley Fool's listing page
router.addHandler('MOTLEYFOOL-LINKS', async ({ request, page, log, pushData }) => {
    // Set a comfortable viewport size for modern web browsing
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Handle cookie consent with proper error handling and timeout
    try {
        await page.waitForSelector('#onetrust-accept-btn-handler', { 
            visible: true, 
            timeout: 5000 
        });
        await page.click('#onetrust-accept-btn-handler');
        log.info('Successfully handled cookie consent');
    } catch (error) {
        // If consent button isn't found, we can continue as it might not appear
        log.info('Cookie consent not required or already handled');
    }

    // Initialize variables for link collection
    let collectedHrefs = new Set(); // Using Set to automatically handle duplicates
    let previousLength = 0;
    let consecutiveNoChange = 0;
    const MAX_RETRIES = 3;

    // Implement scrolling and link collection with retry logic
    try {
        while (consecutiveNoChange < MAX_RETRIES) {
            // Collect current links on the page
            const currentHrefs = await page.$$eval(
                'a.text-gray-1100',
                links => links.map(link => link.href)
            );

            // Add new links to our Set
            currentHrefs.forEach(href => collectedHrefs.add(href));

            // Check if we found new links
            if (collectedHrefs.size > previousLength) {
                log.info(`Found ${collectedHrefs.size - previousLength} new links`);
                previousLength = collectedHrefs.size;
                consecutiveNoChange = 0;

                // Click load more button if it exists
                try {
                    await page.waitForSelector("button.flex.items-center.load-more-button", {
                        visible: true,
                        timeout: 5000
                    });
                    await page.click("button.flex.items-center.load-more-button");
                    
                    // Add random delay between 1-3 seconds
                    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
                } catch (error) {
                    log.info('No more content to load or button not found');
                    break;
                }
            } else {
                consecutiveNoChange++;
                log.info(`No new links found. Attempt ${consecutiveNoChange}/${MAX_RETRIES}`);
            }

            // Push current batch of links
            await pushData({ hrefs: Array.from(collectedHrefs) });
        }
    } catch (error) {
        log.error(`Error collecting links: ${error.message}`);
    }
});

// Handler for processing individual Motley Fool articles
router.addHandler('MOTLEYFOOL', async ({ request, page, log, pushData }) => {
    try {
        // Wait for key elements to load
        await page.waitForSelector('.article-body', { timeout: 10000 });

        // Extract article title with error handling
        const title = await page.$eval(
            '.text-3xl.font-medium.tracking-tight.text-gray-1100.leading-relative-2',
            el => el.textContent.trim()
        ).catch(() => 'Title not found');

        // Extract key points with validation
        const keypoints = await page.$$eval(
            '.mt-8 .bg-white .shadow-card .p-20px',
            elements => elements.map(element => {
                const keypoint = element.querySelector('div')?.textContent?.trim();
                return keypoint ? { keypoint } : null;
            })
        ).then(points => points.filter(Boolean)); // Remove null values

        // Extract author information
        const author = await page.$eval(
            'a[data-track-action="foolcom_article_click"]',
            el => el.innerText.trim()
        ).catch(() => 'Author not found');

        // Extract timestamp with improved parsing
        const timestamp = await page.$$eval(
            'div.text-lg.font-medium.text-gray-800',
            nodes => {
                for (const node of nodes) {
                    const textContent = node.textContent;
                    if (textContent.includes('at')) {
                        return textContent.trim();
                    }
                }
                return 'Timestamp not found';
            }
        );

        // Extract ticker symbol with validation
        const ticker = await page.$eval(
            'a[data-track-action="foolcom_article_click"][data-track-category="article_header_company_card"]',
            el => {
                const text = el.innerText;
                return text.includes(':') ? text.split(':').pop().trim() : text.trim();
            }
        ).catch(() => 'Ticker not found');

        // Extract article paragraphs with cleaning
        const paragraphs = await page.$$eval(
            'div.article-body > p',
            nodes => nodes.map(n => n.innerText.trim()).filter(text => text.length > 0)
        );

        // Push the collected data
        await pushData({
            title,
            keypoints,
            author,
            timestamp,
            ticker,
            paragraphs,
            url: page.url(),
            collected_at: new Date().toISOString()
        });

        log.info(`Successfully processed article: ${title}`);

    } catch (error) {
        log.error(`Error processing article: ${error.message}`);
        throw error; // Re-throw to handle the error at a higher level
    }
});


// Handler for collecting article links from Forbes listing page
router.addHandler('FORBES-LINKS', async ({ request, page, log, pushData }) => {
    // Set comfortable viewport size for modern web pages
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Handle Ketch privacy consent dialog with proper error handling
    log.info('Attempting to handle consent dialog');
    try {
        await page.waitForSelector('.ketch-relative.ketch-inline-flex.ketch-items-center', {
            visible: true,
            timeout: 5000
        });
        await page.click('.ketch-relative.ketch-inline-flex.ketch-items-center');
        log.info('Successfully clicked consent button');
        
        // Wait for dialog to disappear
        await page.waitForTimeout(1000);
    } catch (error) {
        if (error.name === 'TimeoutError') {
            log.info('No consent dialog found, continuing with page processing');
        } else {
            log.error(`Consent handling error: ${error.message}`);
        }
    }

    // Initialize variables for link collection
    let collectedHrefs = new Set();
    let previousLength = 0;
    let consecutiveNoChange = 0;
    const MAX_RETRIES = 5;
    const LOAD_DELAY = 3000;

    try {
        // Implement infinite scroll handling with safeguards
        while (consecutiveNoChange < MAX_RETRIES) {
            // Click the "Load More" button
            try {
                await page.waitForSelector('button._18BedXz4.iWceBwQC.Sn26m-xQ.st6yY9Jv', {
                    visible: true,
                    timeout: 5000
                });
                await page.click('button._18BedXz4.iWceBwQC.Sn26m-xQ.st6yY9Jv');
                
                // Allow time for new content to load
                await page.waitForTimeout(LOAD_DELAY);
                
                // Collect all article links currently on the page
                const currentHrefs = await page.$$eval('a._1-FLFW4R', links => 
                    links.map(link => link.href)
                );

                // Add new links to our collection
                currentHrefs.forEach(href => collectedHrefs.add(href));

                // Check if we found new links
                if (collectedHrefs.size > previousLength) {
                    log.info(`Found ${collectedHrefs.size - previousLength} new articles`);
                    previousLength = collectedHrefs.size;
                    consecutiveNoChange = 0;
                    
                    // Push the current batch of links
                    await pushData({ 
                        hrefs: Array.from(collectedHrefs),
                        total: collectedHrefs.size
                    });
                } else {
                    consecutiveNoChange++;
                    log.info(`No new links found. Attempt ${consecutiveNoChange}/${MAX_RETRIES}`);
                }
            } catch (error) {
                log.info('No more content to load or reached end of list');
                break;
            }
        }

        log.info(`Finished collecting links. Total articles found: ${collectedHrefs.size}`);

    } catch (error) {
        log.error(`Error during link collection: ${error.message}`);
        throw error;
    }
});

// Handler for processing individual Forbes articles
router.addHandler('FORBES', async ({ request, page, log, pushData }) => {
    try {
        // Wait for essential content to load
        await page.waitForSelector('.article-body-container', {
            timeout: 10000
        });

        // Extract article title with error handling
        const title = await page.$eval('h1.fs-headline', 
            el => el.textContent.trim()
        ).catch(() => 'Title not found');

        // Extract article content with paragraph structure preservation
        const textContent = await page.$$eval(
            'div.article-body-container p',
            paragraphs => paragraphs
                .map(p => p.textContent.trim())
                .filter(text => text.length > 0) // Remove empty paragraphs
                .join('\n\n')
        ).catch(() => 'Content not found');

        // Extract and clean timestamp
        const timestamp = await page.$eval(
            'div.content-data.metrics-text',
            el => {
                const text = el.textContent.trim();
                // Additional timestamp cleaning could be added here
                return text;
            }
        ).catch(() => 'Timestamp not found');

        // Extract author information
        const author = await page.$eval(
            'a.contrib-link--name',
            el => el.textContent.trim()
        ).catch(() => 'Author not found');

        // Extract any available topics or tags
        const topics = await page.$$eval(
            '.article-tag a',
            tags => tags.map(tag => tag.textContent.trim())
        ).catch(() => []);

        // Compile and push the processed article data
        await pushData({
            title,
            textContent,
            timestamp,
            author,
            topics,
            url: page.url(),
            processed_at: new Date().toISOString()
        });

        log.info(`Successfully processed article: ${title}`);

    } catch (error) {
        log.error(`Error processing article: ${error.message}`);
        // Include URL in error log for debugging
        log.error(`Failed URL: ${page.url()}`);
        throw error;
    }
});


/// smae would be for all news providers
router.addHandler('REUTERS', async ({ request, page, log, pushData }) => {
    // pass 
});

router.addHandler('STOCKTWITS', async ({ request, page, log, pushData }) => {

});

router.addHandler('CNBC', async ({ request, page, log, pushData }) => {

});

router.addHandler('NASDAQ', async ({ request, page, log, pushData, enqueueLinks }) => {
    log.info(`Handling consent page`);
    try {
        // Wait for the consent button with a timeout of 5 seconds (5000 ms)
        await page.waitForSelector('#onetrust-accept-btn-handler', { 
            visible: true, 
            timeout: 2000 // Set the timeout here
        });
        await page.click('#onetrust-accept-btn-handler');
        await new Promise(resolve => setTimeout(resolve, 3000));
        log.info('Clicked on the consent button');
    } catch (error) {
        log.error(`Error occurred while waiting for the consent button: ${error.message}`);
    }
    const hrefs = await page.$$eval('a.firstCell', elements => elements.map(el => el.href));
    await pushData({ hrefs });
    let button;
    while(true) {
        button = await page.locator('button.pagination__next');
        if (button) {
            await button.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            const hrefs = await page.$$eval('a.firstCell', elements => elements.map(el => el.href));
            await pushData({ hrefs });
        } else {
            break;
        }
    }
});


router.addHandler('YAHOO-tickers', async ({ request, page, log }) => {
    log.info(`Handling consent page`);
    let url = page.url();
    if (url.includes('consent')) {
        cookies = await page.cookies();
        log.info(`Handling consent page`);
        await page.locator('button[type="submit"]').click();
        await new Promise(resolve => setTimeout(resolve, 2000));
        log.info(`Clicked on the consent button`);
    }
    let lastCount = 0;
    let retryCount = 0;
    let nrScrolls = 0;
    let flag = true;
    let articleUrls = [];
    url = await page.url(); // Ensure 'url' is declared
    const ticker = url.replace('https://finance.yahoo.com/quote/', '').split('/')[0];
    

    while (flag) {
        nrScrolls++;

        try {
            articleUrls = await page.$$eval('.subtle-link.fin-size-small.titles.noUnderline.yf-13p9sh2', elements => elements.map(el => el.href));
        } catch (error) {
            log.error('Error fetching article URLs:', error);
            break; // Stop if unable to fetch URLs
        }

        if (articleUrls.length > lastCount) {
            retryCount = 0; // Reset retry counter if new URLs are found
            log.info(`Found ${articleUrls.length} article URLs for ticker ${ticker}`);
            lastCount = articleUrls.length;
            await humanLikeScroll(page);
        } else {
            if (retryCount < 3) {
                await humanLikeScroll(page);
                log.info(`Retrying to scroll ticker ${ticker} retry count: ${retryCount}`);
                retryCount++;
            } else {
                log.info(`Pushing ticker ${ticker} with ${articleUrls.length} article URLs`);
                flag = false;
            }
        }
    }
    await Dataset.pushData({ ticker, articleUrls });
    log.info('Finished scrolling');
});


router.addHandler('LISTAFIRME', async ({ request, page, log, pushData }) => {
    log.info(`Handling consent page`);
    try {
        // Wait for the consent button with a timeout of 5 seconds (5000 ms)
        await page.waitForSelector('#onetrust-accept-btn-handler', { 
            visible: true, 
            timeout: 2000 // Set the timeout here
        });
        await page.click('#onetrust-accept-btn-handler');
        await new Promise(resolve => setTimeout(resolve, 3000));
        log.info('Clicked on the consent button');
    } catch (error) {
        log.error(`Error occurred while waiting for the consent button: ${error.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 1700));
    const hrefs = await page.$$eval('a[target=Profil]', elements => elements.map(el => el.href));
    log.info(`Found ${hrefs.length} items`);
    await pushData({ hrefs });
});


router.addHandler('LISTAFIRME-FIRM', async ({ request, page, log, pushData }) => {
    log.info(`Handling consent page`);
    await new Promise(resolve => setTimeout(resolve, 1400));
    // const rowsBilant = await page.$$eval('div#bilant.table-responsive table tr', rows => rows.map(row => row.innerHTML));
    const link = await page.$eval('h1#top.text-center', el => el.textContent.trim()); 
    // const srl = await page.$eval('div#srl', el => el.textContent.trim());
    log.info(`Clicked on the website link`);
    log.info(page.url());
    await pushData({ rowsBilant, legalName});
});