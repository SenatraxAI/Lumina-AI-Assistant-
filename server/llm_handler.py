import os
import logging
import base64
from typing import Optional, List, Dict, Any, Generator, Iterator
from abc import ABC, abstractmethod

# Third-party SDKs
import google.generativeai as genai
# Pre-load optional SDKs to avoid runtime import lag
try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

try:
    import anthropic
except ImportError:
    anthropic = None

# Note: openai and anthropic packages will need to be installed
# pip install openai anthropic

logger = logging.getLogger(__name__)

# --- Provider Interface ---
class LLMProvider(ABC):
    @abstractmethod
    def generate_stream(self, prompt: str, images: List[str], api_key: str, tone: str) -> Iterator[str]:
        """Yield content chunks from text prompt and list of base64 images"""
        pass

# --- Gemini Provider ---
class GeminiProvider(LLMProvider):
    def generate_stream(self, prompt: str, images: List[str], api_key: str, tone: str) -> Iterator[str]:
        if not api_key:
            yield "Error: No Gemini API Key provided."
            return
        
        try:
            genai.configure(api_key=api_key)
            # Switch to faster Lite model
            model = genai.GenerativeModel('gemini-2.5-flash-lite')
            
            content_parts = [prompt + f"\n\nTone: {tone}"]
            
            for b64_str in images:
                if not b64_str: continue
                if "," in b64_str: b64_str = b64_str.split(",", 1)[1]
                padding = len(b64_str) % 4
                if padding > 0: b64_str += '=' * (4 - padding)
                
                content_parts.append({
                    "mime_type": "image/png",
                    "data": base64.b64decode(b64_str)
                })
                
            response = model.generate_content(content_parts, stream=True)
            for chunk in response:
                if chunk.text:
                    yield chunk.text
            
        except Exception as e:
            logger.error(f"Gemini Error: {e}")
            yield f"Gemini Error: {str(e)}"

# --- OpenAI Provider ---
class OpenAIProvider(LLMProvider):
    def generate_stream(self, prompt: str, images: List[str], api_key: str, tone: str) -> Iterator[str]:
        if not api_key:
            yield "Error: No OpenAI API Key provided."
            return
        
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            
            messages = []
            user_content = [{"type": "text", "text": prompt + f"\n\nTone: {tone}"}]
            
            for b64_str in images:
                if "," in b64_str: b64_str = b64_str.split(",", 1)[1]
                image_url = f"data:image/png;base64,{b64_str}"
                user_content.append({
                    "type": "image_url",
                    "image_url": {"url": image_url}
                })
            
            messages.append({"role": "user", "content": user_content})
            
            stream = client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                max_tokens=600,
                stream=True
            )
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
            
        except ImportError:
            yield "Error: OpenAI SDK not installed on server."
        except Exception as e:
            logger.error(f"OpenAI Error: {e}")
            yield f"OpenAI Error: {str(e)}"

# --- Groq Provider ---
class GroqProvider(LLMProvider):
    def generate_stream(self, prompt: str, images: List[str], api_key: str, tone: str) -> Iterator[str]:
        if not api_key:
            yield "Error: No Groq API Key provided."
            return
        
        try:
            from openai import OpenAI
            
            # Debug Key
            safe_key = api_key[:4] + "..." if api_key and len(api_key) > 4 else "Invalid/Empty"
            logger.info(f"GroqProvider using Key: {safe_key} (Len: {len(api_key)})")

            # Use OpenAI client linked to Groq Endpoint
            client = OpenAI(
                api_key=api_key,
                base_url="https://api.groq.com/openai/v1"
            )
            
            messages = []
            # Groq Llama 3.1 Vision support is limited, usually text only or specific model.
            # Llama 3.1 8B Instant is text-only. We warn if images present?
            # Actually, Llama 3.2 11B Vision is available... lets stick to text for speed/stability or user requested 8b-instant.
            # We will ignore images for 8b-instant or append explanation.
            
            final_text_prompt = prompt + f"\n\nTone: {tone}"
            if images:
                 # STRICTLY ignore image data for Llama 3.1 8B (Text Only)
                 # We just append a context note so the LLM knows why it can't see them.
                 final_text_prompt += "\n\n[System Note: The user provided images, but this specific model (Llama 3.1 8B) is text-only and cannot see them. Answer based on the text context provided above.]"

            system_instruction = (
                "You are Lumina, a helpful audio assistant. "
                "You are speaking directly to the user via TTS. "
                "DO NOT use markdown formatting (no bold, no italics, no lists). "
                "DO NOT output meta-commentary like 'I can help with that' or 'Here is the answer'. "
                "JUST ANSWER THE QUESTION directly and concisely. "
                "Use natural sentence structures suitable for speech."
                "NATURAL RHYTHM STRATEGY: Use ellipses (...) for thoughtful pauses instead of commas. "
                "Avoid using commas where possible, as they cause robotic stops. "
                "Use connector words like 'and', 'so', 'but' to maintain flow."
            )

            messages.append({"role": "system", "content": system_instruction})
            messages.append({"role": "user", "content": final_text_prompt})
            
            # API Call (No images in payload)
            stream = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=messages,
                max_tokens=800,
                stream=True
            )
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content
            
        except ImportError:
            yield "Error: OpenAI SDK not installed (required for Groq)."
        except Exception as e:
            logger.error(f"Groq Error: {e}")
            yield f"Groq Error: {str(e)}"

# --- Claude Provider ---
class ClaudeProvider(LLMProvider):
    def generate_stream(self, prompt: str, images: List[str], api_key: str, tone: str) -> Iterator[str]:
        if not api_key:
            yield "Error: No Claude API Key provided."
            return
            
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            
            messages = []
            content_list = [{"type": "text", "text": prompt + f"\n\nTone: {tone}"}]
            
            for b64_str in images:
                if "," in b64_str: b64_str = b64_str.split(",", 1)[1]
                content_list.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": b64_str
                    }
                })

            messages.append({"role": "user", "content": content_list})
            
            with client.messages.stream(
                model="claude-3-5-sonnet-20240620",
                max_tokens=600,
                messages=messages
            ) as stream:
                for text in stream.text_stream:
                    yield text
            
        except ImportError:
            yield "Error: Anthropic SDK not installed on server."
        except Exception as e:
            logger.error(f"Claude Error: {e}")
            yield f"Claude Error: {str(e)}"

# --- Main Handler ---
class LLMHandler:
    def __init__(self):
        self.providers = {
            "gemini": GeminiProvider(),
            "openai": OpenAIProvider(),
            "claude": ClaudeProvider(),
            "groq": GroqProvider()
        }
        # Default fallback
        self.default_key = os.environ.get("GEMINI_API_KEY")

    def generate_answer_stream(
        self,
        text: str,
        prompt: str,
        screenshot_b64: Optional[str] = None,
        screenshots: Optional[list[str]] = None,
        api_key: Optional[str] = None,
        provider: str = "gemini",
        tone: str = "helpful"
    ) -> Iterator[str]:
        
        # 1. Normalize Images
        images = []
        if screenshot_b64: images.append(screenshot_b64)
        if screenshots: images.extend(screenshots)
        
        # 2. Prepare Prompt
        if "No text selected" in text or not text.strip():
            final_prompt = (
                "I am providing you with screenshots of a webpage and a user's question about them.\n"
                "The user did not select specific text, so please analyze the VISUAL content of the screenshots (headers, tables, images, text) to answer.\n"
                "If the screenshots contain a document or table, read the visible content carefully.\n\n"
                f"USER QUESTION: {prompt}\n\n"
            )
        else:
            final_prompt = (
                f"I am providing you with text selected from a webpage and a user's question about it.\n\n"
                f"SELECTED TEXT:\n{text}\n\n"
                f"USER QUESTION: {prompt}\n\n"
            )
        
        final_prompt += (
            f"\n\nSYSTEM INSTRUCTIONS FOR AUDIO OUTPUT:\n"
            f"1. TONE: {tone}\n"
            f"2. FORMAT: Write for the ear... strict rule: do not use lists or headers.\n"
            f"3. RHYTHM: Use ellipses (...) instead of commas for natural pauses... it sounds much more human.\n"
            f"4. FLOW: Avoid short, choppy sentences... connect thoughts with 'and' or 'so' to keep the flow going.\n"
            f"5. EXPRESSION: Start the answer with a natural filler if appropriate (e.g., 'Oh...', 'Well...', 'You know...') to sound conversational.\n"
        )
        
        # 3. Select Provider
        handler = self.providers.get(provider, self.providers["gemini"])
        
        # 4. Determine Key (Custom or Env)
        key_to_use = api_key
        if not key_to_use and provider == "gemini":
            key_to_use = self.default_key
            
        if not key_to_use:
            yield f"Error: No API Key provided for {provider}."
            return

        # 5. Execute Stream
        yield from handler.generate_stream(final_prompt, images, key_to_use, tone)
