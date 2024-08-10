'use client';
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import SendIcon from '@mui/icons-material/Send';
import { UserButton, useSession, useUser } from "@clerk/nextjs";
import { dark } from '@clerk/themes';
import { createClient } from "@supabase/supabase-js";
import { env } from "~/env";

interface MessageType {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIChat() {
    // Local history of messages
    const [messages, setMessages] = useState<MessageType[]>([
      {
        role: 'assistant',
        content: `Hi! I'm the support assistant. How can I help you today?`,
      },
    ]);
  
    const [message, setMessage] = useState<string>(''); // Users question
    const messagesRef = useRef<MessageType[]>(messages); // useRef hook to maintain a reference to the latest state

    const [conversations, setConversations] = useState<{ id: number; title: string }[]>([]); // List of existing conversations
    const [conversationId, setConversationId] = useState<number | null>(null); // Store the current conversation ID
    const conversationIdRef = useRef(conversationId);

    const [isNewConversation, setIsNewConversation] = useState(false);


    const { user } = useUser();
    // const { session } = useSession();

    useEffect(() => {
      messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
      conversationIdRef.current = conversationId;
    }, [conversationId]);

    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_KEY);

    // Fetch existing conversations when the component mounts
    useEffect(() => {
      // console.log(user);
      if (!user) return;
      const user_id = user?.id;

      const fetchConversations = async () => {
        const { data, error } = await supabase
          .from('conversations')
          .select('id, title')
          .eq('user_id', user_id);

        if (error) {
          console.error('Error fetching conversations:', error);
        } else {
          setConversations(data || []);
        }

        // console.log(data);
      };

      void fetchConversations();
    }, []);
  
    // const sendMessage = async () => {
  
    //   // setMessages([...messages, { role: 'user', content: message }]);
    //   setMessages(prevMessages => [
    //     ...prevMessages,
    //     { role: 'user', content: message},
    //     { role: 'assistant', content: ''}
    //   ]);
    //   setMessage('');
  
    //   const response = await fetch('/api/openai', {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify([...messages, {role: 'user', content: message}]),
    //   });
  
    //   if (!response.ok) {
    //     throw new Error('Network response was not ok');
    //   }
  
    //   // Handle streaming response
    //   const reader = response.body?.getReader();
    //   const decoder = new TextDecoder();
  
    //   if (reader) {
    //     // Process each chunk of data from the stream
    //     const processText = async () => {
    //       const { done, value } = await reader.read();
    //       if (done) return;
  
    //       // Decode the chunk and update the latest assistant message
    //       const text = decoder.decode(value, { stream: true });
    //       setMessages(prevMessages => {
    //         const updatedMessages = [...prevMessages];
    //         const lastMessageIndex = updatedMessages.length - 1;
  
    //         // Ensure that the last message is correctly typed
    //         const lastMessage = updatedMessages[lastMessageIndex];
    //         if (lastMessage?.role === 'assistant') {
    //           updatedMessages[lastMessageIndex] = {
    //             ...lastMessage,
    //             content: `${lastMessage.content ?? ''}${text}`
    //           } as MessageType;
    //         }
            
    //         return updatedMessages;
    //       });
  
    //       // Continue reading the stream
    //       await processText();
    //     };
  
    //     // Start processing the stream
    //     await processText();
    //   }
  
    // };
    const awsSubmit = async (conversation_id: number) => {
      if (!user) return;

      const user_id = user?.id;

      if (!user_id) {
        console.error('User ID is missing.');
        return;
      }

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

          // Insert the user message and assistant response
          const { error } = await supabase.from('messages').insert([
            { conversation_id: conversation_id, user_id: user_id, role: 'user', content: message },
            { conversation_id: conversation_id, user_id: user_id, role: 'assistant', content: result }
          ]);

          if (error) {
            console.error('Error inserting messages into supabase:', error);
          }
        }

      } catch (error) {
        console.error('Error processing request.', error);
      }
    };

    const handleSubmit = async () => {
      if(!user) return;
      let currentConversationId = conversationIdRef.current;
      if (isNewConversation || (messages && messages[0]?.role === 'assistant')) {
        const user_id = user?.id;
        try {
          const { data, error } = await supabase
            .from('conversations')
            .insert([{ user_id: user_id, title: message }])
            .select('id')
            .single();

          if (error) {
            console.error('Error creating new conversation:', error);
            return;
          }

          currentConversationId = data.id as number;
          setConversationId(data.id as number);
          setIsNewConversation(false);
        } catch (error) {
          console.error('Error creating new conversation.', error);
        }
      }

      if (currentConversationId === null) {
        console.error('No Conversation selected.');
        return;
      }

      await awsSubmit(currentConversationId);
    };
  
    const handleKeyUp = async (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        try {
          await handleSubmit(); // Await the sendMessage call
        } catch (error) {
          console.error('Error sending message:', error);
        }
      }
    };

    const handleSelectConversation = (id: number) => {
      setConversationId(id);
      setIsNewConversation(false);
      // Optionally fetch messages for the selected conversation
    }

    const handleNewConversation = () => {
      setIsNewConversation(true);
      setMessages([]);
      // const user_id = user?.id;
      // try {
      //   const { data, error } = await supabase
      //     .from('conversations')
      //     .insert([{ user_id: user_id, title: 'New Conversation' }])
      //     .select('id')
      //     .single();
      //     // .select('*');

      //   if (error) {
      //     console.error('Error creating new conversation:', error);
      //     return;
      //   }

      //   // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      //   setConversationId(data.id);
      //   setIsNewConversation(false);
      //   setMessages([]);
      // } catch (error) {
      //   console.error('Error creating new conversation.', error);
      // }
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
        // bgcolor={'#4C4D4D'}
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

        <Box
          display={'flex'}
          width={'100%'}
          height={'100%'}
          // maxHeight={'20%'}
        >

          <Stack
            height={'100%'}
            // justifyContent={'space-between'}
            width={'25%'}
            // maxHeight={'20%'}
          >
            <Box
              height={'100%'}
              // maxHeight={'10%'}
              overflow={'auto'}
            >
              <Stack
                // p={2}
                // color={'white'}
                // bgcolor={'red'}
                // overflow={'auto'}
              >
                {conversations.map(convo => (
                  <Button 
                    key={convo.id} 
                    onClick={() => handleSelectConversation(convo.id)}
                  >
                    {convo.title}
                  </Button>
                ))}
              </Stack>
            </Box>
            <Box
              p={2}
            >
              <Button
                onClick={handleNewConversation}
              >
                Start New Conversation
              </Button>
            </Box>
          </Stack>


          <Box
            display={'flex'}
            flexDirection={'column'}
            width={'100%'}
            height={'100%'}
            justifyContent={'center'}
            alignItems={'center'}
          >
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
                onClick={handleSubmit}
                startIcon={<SendIcon />}
              >
                Send
              </Button>
            </Stack>
          </Box>
        </Box>
      </Box>
    );
  }
  