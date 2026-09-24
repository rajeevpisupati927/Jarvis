import pyttsx3
import speech_recognition as sr
import webbrowser
import datetime

# Initialize the text-to-speech engine
engine = pyttsx3.init('sapi5')
voices = engine.getProperty('voices')
# Set to male voice (0) or female voice (1)
engine.setProperty('voice', voices[0].id)

def speak(audio):
    """Speaks the given audio string."""
    engine.say(audio)
    engine.runAndWait()

def wish_me():
    """Wishes the user based on the current time."""
    hour = int(datetime.datetime.now().hour)
    if 0 <= hour < 12:
        speak("Good Morning!")
    elif 12 <= hour < 18:
        speak("Good Afternoon!")
    else:
        speak("Good Evening!")
    
    speak("I am Jarvis. How can I help you today?")

def take_command():
    """Listens to microphone input and returns the recognized text."""
    r = sr.Recognizer()
    with sr.Microphone() as source:
        print("Listening...")
        # Adjust for ambient noise
        r.pause_threshold = 1
        audio = r.listen(source)
    
    try:
        print("Recognizing...")
        query = r.recognize_google(audio, language='en-in')
        print(f"User said: {query}\n")
    except Exception as e:
        print("Say that again please...")
        return "None"
    return query.lower()

if __name__ == "__main__":
    wish_me()
    while True:
        query = take_command()
        
        if query == "none":
            continue
            
        if 'open youtube' in query:
            speak("Opening YouTube")
            webbrowser.open("https://www.youtube.com")
            
        elif 'open whatsapp' in query:
            speak("Opening WhatsApp")
            webbrowser.open("https://web.whatsapp.com")
            
        elif 'open google' in query:
            speak("Opening Google")
            webbrowser.open("https://www.google.com")
            
        elif 'time' in query:
            str_time = datetime.datetime.now().strftime("%H:%M:%S")
            speak(f"Sir, the time is {str_time}")
            
        elif 'exit' in query or 'quit' in query or 'stop' in query:
            speak("Goodbye Sir, have a good day.")
            break
