const yfinance_domains = [
	{url: 'https://finance.yahoo.com/topic/latest-news/', category: 'LATEST'}
];

const investing_domains = [
	{url: 'https://www.investing.com/news/stock-market-news', category: 'STOCK-MARKET'},
	{url: 'https://www.investing.com/news/cryptocurrency-news', category: 'CRYPTO'},
	{url: 'https://www.investing.com/news/forex-news', category: 'FOREX'},
	{url: 'https://www.investing.com/news/commodities-news', category: 'COMMODITIES'},
	{url: 'https://www.investing.com/news/economy-news', category: 'ECONOMY'}
];

const motley_fool = [
	{url: 'https://www.fool.com/investing-news/', category: 'STOCK-MARKET'},
	{url: 'https://www.fool.com/market-movers/', category: 'MARKET-MOVERS'},
	{url: 'https://www.fool.com/investing-news/cryptocurrency/', category: 'CRYPTO'},
	{url: 'https://www.fool.com/market-trends/', category: 'MARKET-TRENDS'},
	{url: 'https://www.fool.com/investing-news/commodities/', category: 'COMMODITIES'},
	{url: 'https://www.fool.com/investing-news/economy/', category: 'MACROECONOMICS'},
	{url: 'https://www.fool.com/tech-stock-news/', category: 'TECHNOLOGY'}
];

const cnbc = [
	{url: 'https://www.cnbc.com/economy/', category: 'ECONOMY'},
	{url: 'https://www.cnbc.com/finance/', category: 'FINANCE'},
];

const reuters = [
	{url: 'https://www.reuters.com/markets/asia/', category: 'STOCK-MARKET'},
	{url: 'https://www.reuters.com/markets/us/', category: 'STOCK-MARKET'},
	{url: 'https://www.reuters.com/markets/europe/', category: 'STOCK-MARKET'},
	{url: 'https://www.reuters.com/markets/commodities/', category: 'COMMODITIES'},
	{url: 'https://www.reuters.com/markets/currencies/', category: 'FOREX'},
	{url: 'https://www.reuters.com/finance/', category: 'FINANCE'},
	{url: 'https://www.reuters.com/technology/', category: 'TECHNOLOGY'},
	{url: 'https://www.reuters.com/business/', category: 'BUSINESS'},
	{url: 'https://www.reuters.com/markets/funds/', category: 'MACROECONOMICS'}
];

const stocktwits = [
	{url: 'https://stocktwits.com/news/crypto', category: 'CRYPTO'},
	{url: 'https://stocktwits.com/news/stocks', category: 'STOCK-MARKET'},
	{url: 'https://stocktwits.com/news/trending', category: 'TRENDING'},
	{url: 'https://stocktwits.com/news', category: 'LATEST'}, // SHOULD BE DEDUPLICATED
];

const forbes = [
	{url: 'https://www.forbes.com/money/', category: 'FINANCE'},
];

const binance = [
	{'url': 'https://www.binance.com/en/square/news/all', 'category': 'CRYPTO'},

];

const thestreet = [
	{'url': 'https://www.binance.com/en/square/news/all', category: 'STOCK-MARKET'} // for getting news provider profiles
];


