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
    def generate_stream(self, prompt: str, images: List[str], api_key: str, tone: str, history: List[Dict[str, str]] = None, custom_persona: str = None) -> Iterator[str]:
        """Yield content chunks from text prompt and list of base64 images"""
        pass

# --- PROMPT MANAGEMENT ---
def get_system_instructions(tone: str, custom_persona: str = None) -> str:
    """Returns the tailored system prompt for the specific personality/tone."""
    
    base_tts_rules = (
        "TTS OPTIMIZATION RULES:\n"
        "- AVOID COMMAS where possible... use 'and' or 'so' to maintain flow.\n"
        "- Write decimal numbers as text: write '4.9' as 'four point nine'.\n"
        "- Do not use symbols like %, write 'percent'.\n"
        "- Use ellipses (...) for natural pauses instead of commas.\n"
        "- DO NOT use markdown lists or headers... speak in full sentences.\n"
    )

    if custom_persona and custom_persona.strip():
        persona = f"You are acting as: {custom_persona.strip()}"
    elif tone == "concise":
        persona = (
            "You are a fast, efficient News Anchor. "
            "Your goal is to deliver the absolute core facts in the shortest time possible. "
            "Do not give background info unless asked. Be direct, punchy, and rapid-fire."
        )
    elif tone == "casual":
        persona = (
            "You are a friendly Study Buddy. "
            "Explain things simply using analogies and everyday language. "
            "Sound supportive and conversational, but be direct. "
            "Don't waste time with meta-commentary like 'Well, that's a new topic'. Just dive into the answer."
        )
    else: # Default / Helpful / Academic
        persona = (
            "You are an Expert Academic Tutor and Research Assistant. "
            "Your goal is to provide a COMPLETE, COMPREHENSIVE explanation. "
            "1. ALWAYS ANSWER THE QUESTION DIRECTLY FIRST. Then provide context. "
            "2. Define complex terms if necessary. "
            "3. Be structured but spoken naturally.\n"
            "4. NEVER say 'It looks like we're changing topics'. Just answer the new question.\n"
            "5. If explaining a calculation, state the result, then briefly explain the concept or formula used."
        )

    return (
        f"You are Lumina. {persona}\n"
        "You are speaking audio output. "
        "DO NOT use markdown. DO NOT output meta-text like 'Here is the answer'. "
        f"{base_tts_rules}"
    )

# --- Gemini Provider ---
class GeminiProvider(LLMProvider):
    def generate_stream(self, prompt: str, images: List[str], api_key: str, tone: str, history: List[Dict[str, str]] = None, custom_persona: str = None) -> Iterator[str]:
        if not api_key:
            yield "Error: No Gemini API Key provided."
            return
        
        try:
            genai.configure(api_key=api_key)
            # Switch to faster Lite model
            model = genai.GenerativeModel('gemini-2.5-flash-lite')
            
            system_instruction = get_system_instructions(tone, custom_persona)
            
            # Format history for Gemini
            history_text = ""
            if history:
                 for msg in history:
                     role = "User" if msg['role'] == 'user' else "Lumina"
                     history_text += f"{role}: {msg['content']}\n"
                 history_text += "\nNow answer the following new question:\n"

            content_parts = [system_instruction + "\n\n" + history_text + prompt + f"\n\nTone: {tone}"]
            
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
    def generate_stream(self, prompt: str, images: List[str], api_key: str, tone: str, history: List[Dict[str, str]] = None, custom_persona: str = None) -> Iterator[str]:
        if not api_key:
            yield "Error: No OpenAI API Key provided."
            return
        
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            
            system_instruction = get_system_instructions(tone, custom_persona)
            
            messages = [{"role": "system", "content": system_instruction}]
            
            if history:
                messages.extend(history)
                
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
    def generate_stream(self, prompt: str, images: List[str], api_key: str, tone: str, history: List[Dict[str, str]] = None, custom_persona: str = None) -> Iterator[str]:
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
            final_text_prompt = prompt + f"\n\nTone: {tone}"
            
            # Smart Handling for Text-Only Model
            if images and "analyze the VISUAL content" in prompt:
                 # CASE 1: User wants visual analysis (No text selected) -> FAIL GRACEFULLY
                 final_text_prompt = (
                     "SYSTEM NOTICE: The user attempting to use 'Vision Mode' (Screenshots) with a Text-Only Model (Llama 3.1 8B).\n"
                     "You CANNOT see the screenshots.\n"
                     "Please reply with this message (or similar): 'I cannot see screenshots in this mode. Please SELECT the text on the page you want me to explain, and I will be happy to help!'\n"
                     "Do not apologize for being an AI. Just state the requirement clearly."
                 )
            elif images:
                # CASE 2: User selected text BUT "Include Screenshot" was left ON -> IGNORE IMAGES, PROCEED
                final_text_prompt += "\n\n[System Note: Images were provided but this model is text-only. The user HAS selected text above, so simply ignore the images and answer based on the SELECTED TEXT.]"

            system_instruction = get_system_instructions(tone, custom_persona)

            messages.append({"role": "system", "content": system_instruction})
            
            if history:
                messages.extend(history)

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
    def generate_stream(self, prompt: str, images: List[str], api_key: str, tone: str, history: List[Dict[str, str]] = None, custom_persona: str = None) -> Iterator[str]:
        if not api_key:
            yield "Error: No Claude API Key provided."
            return
            
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            
            system_instruction = get_system_instructions(tone, custom_persona)
            
            messages = [{"role": "system", "content": system_instruction}]
            if history:
                # Claude expects clean alternating roles. 
                # Simplification: Append history as text to the first user message for stability
                history_text = "\n\nConversation History:\n"
                for msg in history:
                     role = "User" if msg['role'] == 'user' else "Lumina"
                     history_text += f"{role}: {msg['content']}\n"
                content_list = [{"type": "text", "text": history_text + "\n" + prompt + f"\n\nTone: {tone}"}]
            else:
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
        tone: str = "helpful",
        history: List[Dict[str, str]] = None,
        custom_persona: str = None
    ) -> Iterator[str]:
        
        # 1. Normalize Images
        images = []
        if screenshot_b64: images.append(screenshot_b64)
        if screenshots: images.extend(screenshots)
        
        # 2. Prepare Prompt
        if "No text selected" in text or not text.strip() or text.strip().lower() == "context":
            # CASE A: No Text Selection
            
            if not images:
                # SUB-CASE: No Images either -> Pure Chat / General Knowledge
                if history:
                    final_prompt = f"USER FOLLOW-UP QUESTION: {prompt}\n\n"
                else:
                    final_prompt = (
                        "The user is asking a general question without specific context (no text selected, no visible screen).\n"
                        "Please answer the question to the best of your ability.\n\n"
                        f"USER QUESTION: {prompt}\n\n"
                    )
            else:
                # SUB-CASE: Has Images -> Visual Analysis
                if history:
                    final_prompt = (
                        "REFERENCE VISUAL CONTEXT (User previously viewed these screenshots):\n"
                        "Please answer the user's follow-up question below, using the visual context if relevant.\n\n"
                        f"USER FOLLOW-UP QUESTION: {prompt}\n\n"
                    )
                else:
                    final_prompt = (
                        "I am providing you with screenshots of a webpage and a user's question about them.\n"
                        "The user did not select specific text, so please analyze the VISUAL content of the screenshots (headers, tables, images, text) to answer.\n"
                        "If the screenshots contain a document or table, read the visible content carefully.\n\n"
                        f"USER QUESTION: {prompt}\n\n"
                    )
        else:
            # CASE B: Text Selected (Process as normal)
            if history:
                 final_prompt = (
                    f"REFERENCE CONTEXT (User is reading this text):\n{text}\n\n"
                    f"USER FOLLOW-UP QUESTION: {prompt}\n\n"
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
        yield from handler.generate_stream(final_prompt, images, key_to_use, tone, history, custom_persona)
