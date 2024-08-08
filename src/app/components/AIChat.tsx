'use client';
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import SendIcon from '@mui/icons-material/Send';
import { UserButton, useSession, useUser } from "@clerk/nextjs";
import { dark } from '@clerk/themes';
import { createClient } from "@supabase/supabase-js";

interface MessageType {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIChat() {
    const [messages, setMessages] = useState<MessageType[]>([
      {
        role: 'assistant',
        content: `Hi! I'm the support assistant. How can I help you today?`,
      },
    ]);
  
    const [message, setMessage] = useState<string>('');

    const { user } = useUser();
    const { session } = useSession();
    
    function createClerkSupabaseClient() {
        return createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_KEY!,
            {
                global: {
                // Get the custom Supabase token from Clerk
                fetch: async (url, options = {}) => {
                    const clerkToken = await session?.getToken({
                    template: 'supabase',
                    });

                    // Insert the Clerk Supabase token into the headers
                    const headers = new Headers(options?.headers);
                    headers.set('Authorization', `Bearer ${clerkToken}`);

                    // Now call the default fetch
                    return fetch(url, {
                    ...options,
                    headers,
                    });
                },
                },
            }
        );
    }

    const client = createClerkSupabaseClient();
  
    const sendMessage = async () => {
  
      // setMessages([...messages, { role: 'user', content: message }]);
      setMessages(prevMessages => [
        ...prevMessages,
        { role: 'user', content: message},
        { role: 'assistant', content: ''}
      ]);
      setMessage('');
  
      const response = await fetch('/api/openai', {
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

    const handleAwsSubmit = async () => {
      setMessages(prevMessages => [
        ...prevMessages,
        { role: 'user', content: message },
        { role: 'assistant', content: '' }
      ]);
      setMessage('');

      try {
        const response = await fetch('/api/aws', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_message: message }),
        });

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        // console.log('response.json - ', response.json());
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let result = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            result += chunk;

            setMessages(prevMessages => {
              const updatedMessages = [...prevMessages];
              const lastMessageIndex = updatedMessages.length - 1;
              const lastMessage = updatedMessages[lastMessageIndex];
              if (lastMessage?.role === 'assistant') {
                updatedMessages[lastMessageIndex] = {
                  ...lastMessage,
                  content: result
                } as MessageType;
              }

              return updatedMessages;
            });
          }
        }
      } catch (error) {
        console.error('Error processing request.', error);
      }

    };
  
    const handleKeyUp = async (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        try {
          await handleAwsSubmit(); // Await the sendMessage call
        } catch (error) {
          console.error('Error sending message:', error);
        }
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
        bgcolor={'#191a1a'}
      >
        <Box
          display={'flex'}
          width={'100%'}
          justifyContent={'space-between'}
          padding={'20px'}
        >   
          <Typography 
            variant={"h6"}
            color={'grey'}
          >
            Consuetudinem Auxilium
          </Typography>
          <UserButton 
            showName 
            appearance={{
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              baseTheme: dark,
              variables: {
                colorText: 'white',
              },
            }}
          />
        </Box>
        <Stack
          direction={'column-reverse'}
          width={'70%'}
          height={'80%'}
          p={2}
          overflow={'auto'}
          flexGrow={1}
          flexShrink={1}
          // bgcolor={'#D8D8D8'}
        >
          <Stack
            direction={'column'}
            spacing={2}
          >
            {messages.map((message, index) => (
              <Box
                key={index}
                display={'flex'}
                justifyContent={message.role === 'assistant' ? 'flex-start' : 'flex-end'}
              >
                <Box
                  bgcolor={message.role === 'assistant' ? '#202222' : '#191a1a'}
                  color={'white'}
                  borderRadius={1}
                  p={2}
                  border={'1px solid #333'}
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
          m={2}
          bgcolor={'#202222'}
        >
          <TextField 
            autoComplete="off"
            label='Message' 
            fullWidth 
            value={message} 
            onChange={(e) => setMessage(e.target.value)}
            onKeyUp={handleKeyUp}
            InputLabelProps={{
              sx: {
                '&.MuiFormLabel-filled, &.Mui-focused': {
                  display: 'none' // Hide the label when the input is focused or filled
                }
              },
              style: { color: 'grey' } // Set the color of the label text
            }}
            InputProps={{
              style: { color: 'grey '}
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: 'transparent', // Default border color
                },
                '&:hover fieldset': {
                  borderColor: 'transparent', // Hover border color
                },
                '&.Mui-focused fieldset': {
                  borderColor: 'transparent', // Focused border color
                },
              },
              '& .MuiInputBase-input': {
                color: 'grey', // Text color
              },
            }}
          />
          <Button 
            // variant="contained"
            onClick={handleAwsSubmit}
            startIcon={<SendIcon />}
          >
            Send
          </Button>
        </Stack>
      </Box>
    );
  }
  