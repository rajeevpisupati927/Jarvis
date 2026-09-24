import os
import datetime
import json
from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv

load_dotenv()

from groq import Groq

app = Flask(__name__, static_folder='.', static_url_path='')

groq_api_key = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=groq_api_key)

# 1. Native Tool Definitions
def get_local_time() -> str:
    return f"The current date and time is {datetime.datetime.now().strftime('%A, %B %d, %Y %I:%M %p')}."

def web_search(query: str) -> str:
    try:
        from duckduckgo_search import DDGS
        results = DDGS().text(query, max_results=3)
        return str(results) if results else "No results found."
    except Exception as e:
        return f"Search failed: {e}"

def open_website(url: str) -> str:
    return f"ACTION_OPEN_WEBSITE: {url}"

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_local_time",
            "description": "Returns the current date and time.",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Searches the web for current events, news, or factual information.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query."}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_website",
            "description": "Opens a website for the user in a new tab.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The full URL of the website to open (e.g. https://www.youtube.com)."}
                },
                "required": ["url"]
            }
        }
    }
]

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')


@app.route('/api/transcribe', methods=['POST'])
def handle_voice():
    if not groq_api_key:
        return jsonify({'error': 'GROQ_API_KEY not found in .env file.'}), 500
        
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
        
    audio_file = request.files['audio']
    import tempfile
    temp_path = os.path.join(tempfile.gettempdir(), "temp_audio.webm")
    audio_file.save(temp_path)
    
    try:
        # 1. Transcribe Audio
        with open(temp_path, "rb") as file:
            transcription = groq_client.audio.transcriptions.create(
                file=("temp_audio.webm", file.read()),
                model="whisper-large-v3",
                response_format="text"
            ).strip()
            
        if not transcription:
            raise ValueError("No speech detected.")
            
        # 2. Native Groq LLM Request with Tools
        messages = [
            {"role": "system", "content": "You are J.A.R.V.I.S., Tony Stark's highly advanced, loyal AI assistant. Address the user as 'Sir'. Keep conversational responses concise, brilliant, and polite. If you write code, provide ONLY the code block and a maximum 1-sentence verbal explanation. NEVER write long explanations for code."},
            {"role": "user", "content": transcription}
        ]
        
        response = groq_client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            tools=tools,
            tool_choice="auto"
        )
        
        response_message = response.choices[0].message
        
        action = None
        
        # 3. Handle Tool Calls
        if response_message.tool_calls:
            messages.append(response_message)
            for tool_call in response_message.tool_calls:
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments)
                
                if function_name == "get_local_time":
                    tool_result = get_local_time()
                elif function_name == "web_search":
                    tool_result = web_search(function_args.get("query"))
                elif function_name == "open_website":
                    url = function_args.get("url")
                    tool_result = open_website(url)
                    action = {"type": "open_url", "url": url}
                else:
                    tool_result = "Tool not found."
                    
                messages.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": function_name,
                    "content": tool_result,
                })
                
            # Force the model to summarize by using a fresh, isolated prompt without tool history
            summary_messages = [
                {"role": "system", "content": "You are J.A.R.V.I.S., Tony Stark's highly advanced, loyal AI assistant. Provide a short, direct verbal response to the user based on the information found. Do not mention that you used a tool or searched the web, just present the information naturally as if you already knew it."},
                {"role": "user", "content": f"User asked: {transcription}\n\nInformation found: {tool_result}"}
            ]
            
            # Send results back to Groq for final answer
            second_response = groq_client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=summary_messages
            )
            
            if second_response.choices[0].message.content:
                reply = second_response.choices[0].message.content
            else:
                reply = f"Here is what I found: {tool_result}"
        else:
            reply = response_message.content
        
        # Cleanup
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        payload = {
            'text': transcription,
            'response': reply
        }
        if action:
            payload['action'] = action
            
        return jsonify(payload)
        
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Starting Vercel-Ready J.A.R.V.I.S. Server on port 8080...")
    app.run(host='0.0.0.0', port=8080, debug=True)
