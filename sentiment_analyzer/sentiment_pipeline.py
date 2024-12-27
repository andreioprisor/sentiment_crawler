import pandas as pd
import json
import glob
from transformers import AutoModelForSequenceClassification, AutoTokenizer
import torch
from tqdm import tqdm
import logging
from datetime import datetime
import os
import re
from inference import Inference

# Set up logging configuration for tracking the analysis process
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('sentiment_analysis.log'),
        logging.StreamHandler()
    ]
)

class FinancialSentimentAnalyzer:
    """
    A financial sentiment analyzer that uses LLaMA to evaluate text sentiment on a 1-5 scale.
    This class leverages LLaMA's natural language understanding to provide nuanced
    sentiment analysis of financial texts, with detailed explanations of the reasoning.
    """
    
    def __init__(self, model_name="unsloth/llama-3-8b-Instruct-bnb-4bit"):
        """
        Initializes the sentiment analyzer with a LLaMA model. The model is configured
        to analyze financial texts through carefully crafted prompts.
        
        Args:
            model_name: The identifier for the LLaMA model to use
        """
        logging.info(f"Initializing LLaMA-based Financial Sentiment Analyzer with {model_name}")
        
        try:
            # Initialize our inference engine with the specified model
            self.inference_engine = Inference(model_name)
            
            # Define our sentiment descriptions for consistent interpretation
            self.sentiment_descriptions = {
                1: "Very Negative - Severe market concerns or bearish indicators",
                2: "Negative - Generally unfavorable outlook or challenges",
                3: "Neutral - Balanced perspective or mixed signals",
                4: "Positive - Favorable outlook with growth potential",
                5: "Very Positive - Strong bullish signals or exceptional performance"
            }
            
            # Create our analysis prompt that guides LLaMA's response format
            self.analysis_prompt = """You are an expert financial analyst tasked with 
            evaluating market sentiment. Analyze the following financial text and provide 
            a sentiment score on a scale of 1 to 5:

            Scoring Guide:
            1 = Very Negative: Major problems, severe market distress, or significant losses
            2 = Negative: Challenges, declining metrics, or concerning trends
            3 = Neutral: Balanced news, mixed signals, or unclear direction
            4 = Positive: Growth, opportunities, or improving conditions
            5 = Very Positive: Exceptional performance, strong growth, or major breakthroughs

            Consider:
            - Financial metrics and performance indicators
            - Market trends and future projections
            - Expert opinions and analysis
            - Broader market implications

            Text to analyze:
            {text}

            Respond ONLY in this exact format:
            REASONING: [2-3 sentences explaining the score]
            SCORE: [single number 1-5]
            CONFIDENCE: [High/Medium/Low]
            """
            
        except Exception as e:
            logging.error(f"Initialization failed: {str(e)}")
            raise

    def _parse_llama_response(self, response):
        """
        Parses LLaMA's response to extract the sentiment score and metadata.
        The method handles various response formats and ensures valid scoring.
        
        Args:
            response: Raw text response from LLaMA
            
        Returns:
            Dictionary containing structured sentiment information
        """
        try:
            # Extract score using regex patterns
            score_match = re.search(r'SCORE:\s*(\d)', response)
            confidence_match = re.search(r'CONFIDENCE:\s*(High|Medium|Low)', response)
            reasoning_match = re.search(r'REASONING:\s*(.+)', response, re.DOTALL)
            
            if not score_match:
                logging.warning("Could not extract sentiment score")
                return self._get_default_sentiment()
            
            # Parse the components
            score = int(score_match.group(1))
            confidence = confidence_match.group(1) if confidence_match else "Low"
            reasoning = reasoning_match.group(1).strip() if reasoning_match else ""
            
            # Validate score range
            if not 1 <= score <= 5:
                logging.warning(f"Invalid score detected: {score}")
                return self._get_default_sentiment()
            
            # Map confidence levels to numerical values
            confidence_values = {
                "High": 0.9,
                "Medium": 0.7,
                "Low": 0.5
            }
            
            return {
                'score': score,
                'description': self.sentiment_descriptions[score],
                'confidence': confidence_values.get(confidence, 0.5),
                'reasoning': reasoning,
                'raw_response': response
            }
            
        except Exception as e:
            logging.error(f"Response parsing failed: {str(e)}")
            return self._get_default_sentiment()

    def analyze(self, text):
        """
        Performs sentiment analysis on financial text using LLaMA.
        The method provides a comprehensive analysis including a score,
        confidence level, and detailed reasoning.
        
        Args:
            text: The financial text to analyze
            
        Returns:
            Dictionary containing sentiment analysis results
        """
        if not text or not text.strip():
            logging.warning("Empty text provided for analysis")
            return self._get_default_sentiment()
            
        try:
            # Format our prompt with the text to analyze
            formatted_prompt = self.analysis_prompt.format(text=text)
            
            # Get LLaMA's response through our inference engine
            response = self.inference_engine.inference(
                prompt=formatted_prompt,
                painted_string=""  # Empty string as we're not using highlighting
            )
            
            # Parse and return the results
            return self._parse_llama_response(response)
            
        except Exception as e:
            logging.error(f"Analysis failed: {str(e)}")
            return self._get_default_sentiment()

    def _get_default_sentiment(self):
        """
        Provides default neutral sentiment values for error cases.
        This ensures the analyzer always returns a valid response structure.
        """
        return {
            'score': 3,
            'description': self.sentiment_descriptions[3],
            'confidence': 0.5,
            'reasoning': "Default neutral sentiment due to processing error",
            'raw_response': None
        }

class NewsProcessor:
    """
    A comprehensive processor for financial news articles that handles data cleaning,
    sentiment analysis, and standardization of article content. This class works in
    conjunction with FinBERT to provide accurate financial sentiment analysis on a
    1-3 scale (Negative, Neutral, Positive).
    """
    
    def __init__(self, sentiment_analyzer):
        """
        Initializes the news processor with a sentiment analyzer instance.
        
        Args:
            sentiment_analyzer: An instance of FinancialSentimentAnalyzer
                              configured to provide 1-3 scale sentiment scores
        """
        self.sentiment_analyzer = sentiment_analyzer
        
        # Define patterns for cleaning and filtering ticker symbols
        self.ticker_exclusion_patterns = [
            'ad-free', 
            'premium', 
            'subscribe',
            'Get 100%',
            'experience'
        ]
        
        # Common date formats we might encounter
        self.date_formats = [
            "%m/%d/%Y, %I:%M %p",  # Example: 12/25/2023, 10:30 AM
            "%Y-%m-%d %H:%M:%S",   # Example: 2023-12-25 10:30:00
            "%Y-%m-%dT%H:%M:%S.%fZ" # ISO format with timezone
        ]

    def clean_date(self, date_str):
        """
        Converts various date string formats into a standardized datetime object.
        Handles multiple input formats and cleans common prefixes.
        
        Args:
            date_str: A string containing the date information
            
        Returns:
            pandas.Timestamp or None if parsing fails
        """
        if not date_str:
            return None
            
        try:
            # Remove common prefixes that might interfere with parsing
            if isinstance(date_str, str):
                date_str = date_str.replace('Published ', '')
                
                # Try each of our known date formats
                for date_format in self.date_formats:
                    try:
                        return pd.to_datetime(date_str, format=date_format)
                    except ValueError:
                        continue
                        
                # If none of our specific formats work, let pandas try to figure it out
                return pd.to_datetime(date_str)
            
            # If it's already a datetime-like object, just convert it
            return pd.to_datetime(date_str)
            
        except Exception as e:
            logging.error(f"Date parsing error for '{date_str}': {str(e)}")
            return None

    def clean_tickers(self, tickers_list):
        """
        Cleans and validates a list of stock ticker symbols, removing advertising
        text and invalid entries.
        
        Args:
            tickers_list: List of potential ticker symbols
            
        Returns:
            String of valid tickers separated by commas
        """
        if not tickers_list:
            return ""
            
        # Filter out invalid tickers and advertising text
        valid_tickers = []
        for ticker in tickers_list:
            if ticker and isinstance(ticker, str):
                ticker = ticker.strip()
                # Check if ticker contains any exclusion patterns
                if ticker and not any(pattern.lower() in ticker.lower() 
                                    for pattern in self.ticker_exclusion_patterns):
                    valid_tickers.append(ticker)
        
        return ', '.join(valid_tickers)

    def process_article(self, article_data):
        """
        Processes a single financial news article, extracting relevant information
        and performing sentiment analysis. Combines title and content for more
        accurate sentiment assessment.
        
        Args:
            article_data: Dictionary containing the article information
            
        Returns:
            Dictionary containing processed article data with sentiment analysis,
            or None if processing fails
        """
        try:
            # Extract and validate essential fields
            title = article_data.get('title', '').strip()
            content = article_data.get('content', '').strip()
            
            # Skip articles with missing essential content
            if not title or not content:
                logging.warning(f"Article missing title or content: {article_data.get('url', 'No URL')}")
                return None
            
            # Combine title and content for sentiment analysis
            # The title is repeated to give it more weight in the analysis
            analysis_text = f"{title} {title} {content}"
            
            # Perform sentiment analysis
            sentiment_results = self.sentiment_analyzer.analyze(analysis_text)
            
            # Construct the processed article data
            processed_article = {
                'title': title,
                'date': self.clean_date(article_data.get('date')),
                'tickers': self.clean_tickers(article_data.get('tickers', [])),
                'content': content,
                'provider': article_data.get('newsProvider', ''),
                'url': article_data.get('url', ''),
                'sentiment_score': sentiment_results['score'],
                'sentiment_description': sentiment_results['description'],
                'confidence': sentiment_results['confidence'],
                'processed_at': datetime.now().isoformat()
            }
            print(processed_article)
            
            logging.debug(f"Successfully processed article: {title[:50]}...")
            return processed_article
            
        except Exception as e:
            logging.error(f"Error processing article: {str(e)}")
            logging.debug(f"Article data: {article_data}")
            return None

    def validate_processed_article(self, processed_article):
        """
        Validates a processed article to ensure all required fields are present
        and properly formatted.
        
        Args:
            processed_article: Dictionary containing the processed article data
            
        Returns:
            Boolean indicating whether the article is valid
        """
        if not processed_article:
            return False
            
        required_fields = [
            'title', 'date', 'content', 'sentiment_score',
            'sentiment_description', 'confidence'
        ]
        
        # Check for required fields
        for field in required_fields:
            if field not in processed_article or processed_article[field] is None:
                logging.warning(f"Missing required field: {field}")
                return False
        
        # Validate sentiment score range
        if not 1 <= processed_article['sentiment_score'] <= 3:
            logging.warning("Invalid sentiment score")
            return False
            
        return True

def main():
    """
    Main execution function that orchestrates the sentiment analysis pipeline.
    """
    try:
        # Initialize sentiment analyzer
        sentiment_analyzer = FinancialSentimentAnalyzer()
        processor = NewsProcessor(sentiment_analyzer)
        
        # Define input and output paths
        input_pattern = "../storage/datasets/default/*.json"
        output_dir = "outputs/"
        os.makedirs(output_dir, exist_ok=True)
        
        # Process all JSON files
        processed_data = []
        json_files = glob.glob(input_pattern)
        
        # Add debugging for file discovery
        logging.info(f"Found {len(json_files)} files to process")
        if len(json_files) == 0:
            raise ValueError(f"No files found matching pattern: {input_pattern}")
            
        # Add debugging for first file content
        with open(json_files[0], 'r', encoding='utf-8') as f:
            logging.info(f"Sample file content structure: {json.load(f).keys()}")
        
        for file_path in tqdm(json_files, desc="Processing articles"):
            try:
                with open(file_path, 'r', encoding='utf-8') as file:
                    article_data = json.load(file)
                    processed_article = processor.process_article(article_data)
                    if processed_article:
                        processed_data.append(processed_article)
                        # Add debugging for processed article structure
                        if len(processed_data) == 1:
                            logging.info(f"Sample processed article structure: {processed_data[0].keys()}")
            except Exception as e:
                logging.error(f"Error processing file {file_path}: {str(e)}")
                continue
        
        # Check if we have any processed data
        if not processed_data:
            raise ValueError("No articles were successfully processed")
            
        # Create DataFrame with explicit columns
        columns = ['title', 'date', 'tickers', 'content', 'provider', 'url', 
                  'sentiment_score', 'sentiment_description', 'confidence', 'processed_at']
        df = pd.DataFrame(processed_data, columns=columns)
        
        # Add debugging for DataFrame creation
        logging.info(f"DataFrame shape: {df.shape}")
        logging.info(f"DataFrame columns: {df.columns.tolist()}")
        logging.info(f"First row of DataFrame: {df.iloc[0].to_dict()}")
        
        # Sort by date and handle missing values
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        df = df.sort_values('date', na_position='last')
        
        # Save processed data
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = f"{output_dir}/crypto_sentiment_{timestamp}.csv"
        df.to_csv(output_path, index=False)
        
        # Generate summary statistics
        logging.info(f"\nProcessed {len(df)} articles")
        logging.info("\nSentiment Distribution:")
        logging.info(df['sentiment_description'].value_counts(normalize=True))
        logging.info(f"\nAverage Confidence Score: {df['confidence'].mean():.2f}")
        logging.info(f"\nResults saved to: {output_path}")
        
        return df

    except Exception as e:
        logging.error(f"Pipeline execution failed: {str(e)}")
        # Print the full traceback for better debugging
        import traceback
        logging.error(traceback.format_exc())
        raise

if __name__ == "__main__":
    main()