// Web Agent implementation
class WebAgent {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        // Import puppeteer-core and chrome-aws-lambda dynamically
        const chromium = await import('chrome-aws-lambda');
        const puppeteer = await import('puppeteer-core');

        this.browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: true,
            ignoreHTTPSErrors: true,
        });

        this.page = await this.browser.newPage();
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async executeTask(url, task) {
        try {
            console.log(`Executing task on ${url}`);
            await this.page.goto(url, { 
                waitUntil: 'networkidle0',
                timeout: 30000 
            });

            // Take full page screenshot
            const screenshot = await this.page.screenshot({
                fullPage: true,
                encoding: 'base64'
            });

            // Analyze the page with GPT-4
            const analysis = await this.analyzeWithGPT(task);

            // Collect page data
            const data = await this.collectPageData();

            return {
                success: true,
                url: url,
                task: task,
                data: data,
                analysis: analysis,
                screenshots: [screenshot],
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Task execution failed:', error);
            throw new Error(`Failed to execute task: ${error.message}`);
        }
    }

    async analyzeWithGPT(task) {
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    task: task,
                    pageContent: await this.page.content()
                })
            });

            if (!response.ok) {
                throw new Error(`GPT analysis failed: ${response.statusText}`);
            }

            return await response.json();

        } catch (error) {
            console.error('GPT analysis failed:', error);
            return null;
        }
    }

    async collectPageData() {
        return await this.page.evaluate(() => {
            return {
                title: document.title,
                url: window.location.href,
                meta: {
                    description: document.querySelector('meta[name="description"]')?.content,
                    keywords: document.querySelector('meta[name="keywords"]')?.content
                },
                headers: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
                    type: h.tagName.toLowerCase(),
                    text: h.textContent.trim()
                })),
                links: Array.from(document.querySelectorAll('a')).map(a => ({
                    text: a.textContent.trim(),
                    href: a.href
                })),
                images: Array.from(document.querySelectorAll('img')).map(img => ({
                    src: img.src,
                    alt: img.alt,
                    width: img.width,
                    height: img.height
                }))
            };
        });
    }

    async takeScreenshot(selector = null) {
        if (selector) {
            const element = await this.page.$(selector);
            if (element) {
                return await element.screenshot({
                    encoding: 'base64'
                });
            }
            return null;
        }
        
        return await this.page.screenshot({
            fullPage: true,
            encoding: 'base64'
        });
    }
}