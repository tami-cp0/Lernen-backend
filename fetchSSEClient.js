const { EventSource } = require('eventsource');


const chatId = '66c9b5e1-178c-4196-bf4c-9fd732a9b9f4';
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhMzIzN2U1Ny1jYjA4LTQwMTEtOTg1ZC1hMjgwODA2YTJlNjEiLCJlbWFpbCI6ImZpbmR0YW1pbG9yZUBnbWFpbC5jb20iLCJwcm92aWRlciI6Imdvb2dsZSIsInR5cGUiOiJhdXRob3JpemF0aW9uIiwiaWF0IjoxNzY4MTY3ODMwLCJleHAiOjE3Njg3NzI2MzB9.L78M1f_ghJBnXDLhs_5uw0LlyMJxoRrtrznsCoFlPz4';

const createUrl = `http://localhost:3005/api/v1/chats/${chatId}/sse/create-stream-session`;

const body = {
  message: 'write a 3 sentence story',
  selectedDocumentIds: ['doc-uuid-1', 'doc-uuid-2'],
  pageNumber: 1,
  pageContent: 'Some page content',
};

async function createStreamSession() {
  const res = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }
}

function streamMessage() {
  const streamUrl =
    `http://localhost:3005/api/v1/chats/${chatId}/sse/stream-message`;

  const es = new EventSource(streamUrl);

  es.onmessage = (event) => {
    // Each observer.next({ data }) becomes event.data
    console.log('Chunk:', event.data);
  };

  es.onerror = (err) => {
    console.error('SSE error', err);
    es.close();
  };
}


(async () => {
  await createStreamSession();
  streamMessage();
})();



