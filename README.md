## Financial Sentiment Monitoring with advanded Scraping and LLM models

This repository contains the code for the financial sentiment monitoring project. The project is divided into two main parts:

1. **News Crawler**: This part is responsible for real time crawling of any source of information, from news websites to social media. The main goal is to gather as much public information as possible written about a given asset, and to store it in a database. The code is written in Javascript and uses the Crawlee library for web scraping.
2. **Sentiment Analysis**: This part is responsible for the sentiment analysis of the gathered data. The main goal is to classify the sentiment of the text as positive, negative or neutral. The code is written in Python and uses the Hugging Face Transformers library for the LLM models.


