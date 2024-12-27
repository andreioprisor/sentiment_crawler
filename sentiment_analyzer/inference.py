import transformers
import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import pipeline

class Inference:
        def __init__(self, model_name):
                self.model_name = model_name
                self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        def inference(self, prompt, painted_string):
                model_pipeline = pipeline(
                        "text-generation",
                        model=self.model_name,
                        model_kwargs={"torch_dtype": torch.float16}
                )
                messages = [ {
                        "role": "system", "content": prompt \
                }]

                outputs = model_pipeline(
                        messages,
                        do_sample=False,
                )
                response = outputs[0]['generated_text'][1]['content']
                return response
