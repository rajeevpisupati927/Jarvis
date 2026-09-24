# J.A.R.V.I.S. (Vercel-Ready)

An advanced, fully voice-activated AI assistant inspired by Tony Stark's Iron Man tech. This project features a highly immersive, 3D holographic web UI built from scratch using pure CSS and SVGs, powered by a lightweight Python/Flask backend and the Groq LLM API.

## Features

- **Continuous Voice Interaction**: Automatically detects when you stop speaking, processes your command, reads the response out loud, and immediately resumes listening for continuous conversation.
- **Stark Tech UI**: An incredible, cyberpunk-themed HTML/CSS interface featuring an animated Arc Reactor, glowing terminal text, and a right-aligned command log.
- **3D Armor Database**: A fully interactive 3D Coverflow Carousel built with pure CSS, containing glowing 2D vector outlines of the Hulkbuster, Iron Spider, and Mark 85 armor.
- **Autonomous Web Browsing**: J.A.R.V.I.S. is capable of searching the live internet for news and weather, and can physically open websites (like YouTube or GitHub) directly in your browser tab.
- **Vercel-Ready Backend**: Stripped of heavy dependencies like LangChain or Gradio, running on a minimal Flask API that is ready to deploy.

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/rajeevpisupati927/Jarvis.git
   cd Jarvis
   ```

2. **Install dependencies**
   Make sure you have Python installed, then run:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory and add your Groq API key:
   ```env
   GROQ_API_KEY="your-groq-api-key-here"
   ```

4. **Run the Server**
   Start the Flask application:
   ```bash
   python app.py
   ```

5. **Access the Interface**
   Open your browser and navigate to:
   `http://localhost:8080`

## Usage
Click the **"ACTIVATE J.A.R.V.I.S."** button. Wait for the audio uplink to secure, then simply speak naturally. You can ask him to search the web, write code, tell you the time, or open Netflix. When you're done, click **"DEACTIVATE"**.
