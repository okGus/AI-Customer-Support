'use client';
import { Box, Button, Stack, TextField } from "@mui/material";
import { useState } from "react";

interface MessageType {
  role: 'user' | 'assistant';
  content: string;
}

export default function HomePage() {
  const [messages, setMessages] = useState<MessageType[]>([
    {
      role: 'assistant',
      content: `Hi! I'm the support assistant. How can I help you today?`,
    },
  ]);

  const [message, setMessage] = useState<string>('');

  const sendMessage = async () => {

    // setMessages([...messages, { role: 'user', content: message }]);
    setMessages(prevMessages => [
      ...prevMessages,
      { role: 'user', content: message},
      { role: 'assistant', content: ''}
    ]);
    setMessage('');

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([...messages, {role: 'user', content: message}]),
    });


    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    // Handle streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      // Process each chunk of data from the stream
      const processText = async () => {
        const { done, value } = await reader.read();
        if (done) return;

        // Decode the chunk and update the latest assistant message
        const text = decoder.decode(value, { stream: true });
        setMessages(prevMessages => {
          const updatedMessages = [...prevMessages];
          const lastMessageIndex = updatedMessages.length - 1;

          // Ensure that the last message is correctly typed
          const lastMessage = updatedMessages[lastMessageIndex];
          if (lastMessage?.role === 'assistant') {
            updatedMessages[lastMessageIndex] = {
              ...lastMessage,
              content: `${lastMessage.content ?? ''}${text}`
            } as MessageType;
          }
          
          return updatedMessages;
        });

        // Continue reading the stream
        await processText();
      };

      // Start processing the stream
      await processText();
    }

  };

  return (
    <Box
      width={'100%'}
      height={'100vh'}
      display={'flex'}
      flexDirection={'column'}
      justifyContent={'center'}
      alignItems={'center'}
    >
      <Stack
        direction={'column'}
        width={'60%'}
        height={'80%'}
        // border={'1px solid #333'}
        p={2}
        overflow={'auto'}
      >
        <Stack
          direction={'column'}
          spacing={2}
          flexGrow={1}
          // overflow={'auto'}
        >
          {messages.map((message, index) => (
            <Box
              key={index}
              display={'flex'}
              justifyContent={message.role === 'assistant' ? 'flex-start' : 'flex-end'}
            >
              <Box
                bgcolor={message.role === 'assistant' ? 'primary.main' : 'secondary.main'}
                color={'white'}
                borderRadius={1}
                p={2}
              >
                {message.content}
              </Box>
            </Box>
          ))}
        </Stack>
        
      </Stack>

      <Stack
        width={'50%'}
        display={'flex'}
        direction={'row'}
        spacing={2}
      >
        <TextField 
          label='Message' 
          fullWidth 
          value={message} 
          onChange={(e) => setMessage(e.target.value)}
        />
          <Button 
            variant="contained"
            onClick={sendMessage}
          >
            Send
          </Button>
      </Stack>
    </Box>
  );
}
