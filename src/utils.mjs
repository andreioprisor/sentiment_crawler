import fs from 'fs';
import util from 'util';
// Utility function to create URLs from a base URL
export function createUrls(baseUrl, count, label) {
    return Array.from({ length: count }, (_, i) => {
        return { url: `${baseUrl}/${i + 1}`, label: label };
    });
}


// Utility function to read URLs from a JSON file
export async function readUrlsFromFile(filePath) {
    try {
        const readFile = util.promisify(fs.readFile);

        // Read the file
        const data = await readFile(filePath, 'utf8');

        // Parse the JSON data
        const jsonData = JSON.parse(data);

        // Extract the hrefs and map them to the desired format
        return jsonData.map(item => {
            return { url: item.href, label: 'INVESTING-ARTICLE' };
        });
    } catch (err) {
        console.error('Error reading file:', err);
        throw err; // Re-throw the error after logging it
    }
}

export async function readJsonUrlsFromFile(filePath) {
    try {
        const readFile = util.promisify(fs.readFile);

        // Read the file
        const data = await readFile(filePath, 'utf8');
        const jsonData = JSON.parse(data);

        return jsonData.hrefs;
    }
    catch (err) {
        console.error('Error reading file:', err);
        throw err;
    }
}


export async function readFile(filePath) {
    try {
        const readFile = util.promisify(fs.readFile);
        const urls = await readFile(filePath, 'utf8');
        return urls.split('\n').map(url => url.trim());
    } catch (err) {
        console.error('Error reading file:', err);
        throw err;
    }
} 
