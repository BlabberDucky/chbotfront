import React, { useState, useEffect, useRef } from 'react';
import { 
  Container, 
  Paper, 
  TextField, 
  Button, 
  Typography, 
  Box,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import { Mic, MicOff, Send } from '@mui/icons-material';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

function App() {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showError, setShowError] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60); // 60 seconds timeout
  const recognitionRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Check browser compatibility
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Your browser does not support speech recognition. Please use Chrome or Edge.');
      setShowError(true);
      return;
    }

    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true; // Changed to true to keep listening
    recognitionRef.current.interimResults = true; // Changed to true to get real-time results
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      setIsListening(true);
      setError('');
      setTimeLeft(60);
      // Start the countdown
      timeoutRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            stopListening();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    recognitionRef.current.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      
      setQuestion(transcript);
      
      // If we have a final result, stop listening
      if (event.results[0].isFinal) {
        stopListening();
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setError(`Error: ${event.error}`);
      setShowError(true);
      stopListening();
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
      }
    };

    // Socket.IO event listeners
    socket.on('botResponse', (data) => {
      setResponse(data);
      setIsLoading(false);
      speakResponse(data);
    });

    socket.on('error', (error) => {
      setResponse('Error: ' + error);
      setIsLoading(false);
      setError(error);
      setShowError(true);
    });

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
      }
      socket.off('botResponse');
      socket.off('error');
    };
  }, []);

  const startListening = () => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setError('Failed to start voice recognition. Please try again.');
      setShowError(true);
    }
  };

  const stopListening = () => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
      }
      setIsListening(false);
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
  };

  const speakResponse = (text) => {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Error with speech synthesis:', error);
      setError('Failed to speak response. Please try again.');
      setShowError(true);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (question.trim()) {
      setIsLoading(true);
      socket.emit('askQuestion', question);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Voice Bot
        </Typography>
        
        <Box component="form" onSubmit={handleSubmit} sx={{ mb: 3 }}>
          <TextField
            fullWidth
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask me anything..."
            variant="outlined"
            sx={{ mb: 2 }}
          />
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              color={isListening ? "error" : "primary"}
              onClick={isListening ? stopListening : startListening}
              startIcon={isListening ? <MicOff /> : <Mic />}
              disabled={!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)}
            >
              {isListening ? 'Stop Listening' : 'Start Listening'}
            </Button>
            
            <Button
              variant="contained"
              color="primary"
              type="submit"
              disabled={!question.trim() || isLoading}
              startIcon={isLoading ? <CircularProgress size={20} /> : <Send />}
            >
              Send
            </Button>
          </Box>
        </Box>

        {isListening && (
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              Listening... {timeLeft}s remaining
            </Typography>
          </Box>
        )}

        {response && (
          <Paper 
            elevation={2} 
            sx={{ 
              p: 2, 
              bgcolor: 'grey.100',
              borderRadius: 2
            }}
          >
            <Typography variant="body1">
              {response}
            </Typography>
          </Paper>
        )}

        <Snackbar 
          open={showError} 
          autoHideDuration={6000} 
          onClose={() => setShowError(false)}
        >
          <Alert 
            onClose={() => setShowError(false)} 
            severity="error" 
            sx={{ width: '100%' }}
          >
            {error}
          </Alert>
        </Snackbar>
      </Paper>
    </Container>
  );
}

export default App;
