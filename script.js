//Jid Espenorio - Ensombl
//Updated 06/03/2025
//Variables v1.7

// ─────────────────────────────────────────────────────────────────────────────
// 🟢 GLOBAL VARIABLES
// ─────────────────────────────────────────────────────────────────────────────
let userName = ""; // Store user's name
let chatHistory = []; // Store conversation context
const apiKey = "F5TTEZU13jwfovrhBsfw5c1yqu8yL2iUDXHavU1YUA1WM13QUtsZJQQJ99BBACL93NaXJ3w3AAABACOGijkq"; // Azure OpenAI API key
const apiUrl = "https://testingenvnexgen.openai.azure.com/openai/deployments/gpt-4TestEnv/chat/completions?api-version=2024-08-01-preview"; // Azure OpenAI endpoint
const storageAccountUrl = "https://storagetestnexgen.blob.core.windows.net"; // Azure Blob Storage URL
const sasToken = "?sv=2022-11-02&ss=b&srt=sco&sp=rwdlactfx&se=2026-02-24T09:26:01Z&st=2025-02-24T01:26:01Z&spr=https&sig=2EsAZHvLzm4K4VjwH0whYtMaVovtjpXqWMbcD8Kj%2fqE%3D"; // SAS token for uploads
const speechApiKey = "2DYSW1vTUTMnuJD50oxsDOrYOgreD3fNeT787DT1myx9Ro5wdaXmJQQJ99BBACL93NaXJ3w3AAAYACOGcj5N"; // Azure Speech API key
const speechEndpoint = "https://australiaeast.api.cognitive.microsoft.com/"; // Azure Speech Service endpoint
const speechRegion = "australiaeast";
let isBotProcessing = false; // Prevent overlapping responses
let lastUploadedFileUrl = ""; // Store last uploaded file URL for transcription
let hasTranscriptBeenProcessed = false; // ✅ Prevents multiple reprocessing of 
let extractedSpeakers = []; // ✅ Store extracted speaker details globally
const MAX_FILE_SIZE_MB = 10240; // 10GB Maximum file size for uploads

// ─────────────────────────────────────────────────────────────────────────────
// 📚 KNOWLEDGE BASE
// ─────────────────────────────────────────────────────────────────────────────
const knowledgeBase = {
  "what is cpd accreditation?": `
  📘 **What is CPD Accreditation?**
  CPD accreditation ensures professional development activities meet industry standards. It is designed for Australian Relevant Providers and GTPAs.
  ✅ **Next Steps**:
  If you'd like to submit content for CPD accreditation, let me know! I'll guide you through the process.`,
  "what file types are supported?": `
  📂 **Supported File Types**
  - **Audio/Video**: MP4, AVI, MOV, MKV, MP3, WAV, OGG
  - **Articles**: PDF, DOC, DOCX, TXT
  - **Presentations**: PPT, PPTX, PDF`,
};

// ─────────────────────────────────────────────────────────────────────────────
// ✅ Function to extract speaker details using Named Entity Recognition (NER)
// ─────────────────────────────────────────────────────────────────────────────
function extractSpeakerDetails(transcript) {
  const namePattern = /(?:Joining us today is|Welcome to the show,|My name is)\s([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/g;
  const jobPattern = /([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)\s(at|from)\s([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/g;
  
  let speakers = [];
  let match;

  // ✅ Extract host/guest names
  while ((match = namePattern.exec(transcript)) !== null) {
      let speakerName = match[1];
      speakers.push({ name: speakerName, role: "Host/Guest", company: "" });
  }

  // ✅ Extract job titles and company names
  while ((match = jobPattern.exec(transcript)) !== null) {
      let jobTitle = match[1];
      let company = match[3];
      
      let existingSpeaker = speakers.find(s => transcript.includes(s.name));
      if (existingSpeaker) {
          existingSpeaker.role = jobTitle;
          existingSpeaker.company = company;
      } else {
          speakers.push({ name: "Unknown", role: jobTitle, company: company });
      }
  }

  return speakers;
}


// ─────────────────────────────────────────────────────────────────────────────
// 🚀 MAIN FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

// Scroll the chat area to the bottom
function scrollChatToBottom() {
  const chatArea = document.getElementById("chat-area");
  chatArea.scrollTop = chatArea.scrollHeight; // Scroll to the bottom
}

// Display bot message
function displayBotMessage(message) {
  const chatArea = document.getElementById("chat-area");
  const botBubble = document.createElement("div");
  botBubble.classList.add("chat-bubble", "bot-message");

  const formattedMessage = message.split("\n").map((line) => `<p>${line}</p>`).join("");
  botBubble.innerHTML = formattedMessage;

  chatArea.appendChild(botBubble);
  scrollChatToBottom();
}

// ✅ Add showFullTranscription() here
function showFullTranscription() {
  displayBotMessage(`**Full Transcription:**\n\n${transcriptionText}`);
}
// Display user message
function displayUserMessage(message) {
  const chatArea = document.getElementById("chat-area");
  // Create user message bubble
  const userBubble = document.createElement("div");
  userBubble.classList.add("chat-bubble", "user-message");
  userBubble.textContent = message;
  // Append to chat area
  chatArea.appendChild(userBubble);
  scrollChatToBottom();
}

// ✅ Define sendMessage function before it is called
function sendMessage() {
  const messageBox = document.getElementById("message-box");
  if (!messageBox) {
      console.error("❌ Error: 'message-box' not found in DOM.");
      return;
  }

  const userMessage = messageBox.value.trim(); // Get user input
  if (!userMessage) {
      displayBotMessage("⚠️ An error occurred. Please enter a valid message.");
      return;
  }

  processUserMessage(userMessage); // Call processUserMessage
  messageBox.value = ""; // Clear input box after sending
}


// ─────────────────────────────────────────────────────────────────────────────
// ✅ Attach Event Listeners on DOMContentLoaded
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // List of elements and their event handlers
  const elements = [
    { id: "video-upload", event: "change", handler: (event) => handleFileUpload(event, "video") },
    { id: "article-upload", event: "change", handler: (event) => handleFileUpload(event, "article") },
    { id: "presentation-upload", event: "change", handler: (event) => handleFileUpload(event, "presentation") },
    { id: "file-upload", event: "change", handler: handleFileUpload },
    { id: "message-box", event: "keypress", handler: (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          sendMessage();
        }
      }
    }
  ];

  // Loop through elements and attach event listeners
  elements.forEach(({ id, event, handler }) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener(event, handler);
    } else {
      console.error(`❌ Error: '${id}' element not found.`);
    }
  });

  startNewChat();
});

// Start a new chat
function startNewChat() {
  userName = "";
  chatHistory = [];
  const chatArea = document.getElementById("chat-area");
  chatArea.innerHTML = ""; // Clear the chat area
  displayBotMessage("Choose an option to get started..");
  window.scrollTo(0, 0); // Scroll to top
}

// ─────────────────────────────────────────────────────────────────────────────
// Additional Transcription and Upload Handling Functions would go here
// ─────────────────────────────────────────────────────────────────────────────

// Detect user intention for uploading files
function detectFileUploadIntent(message) {
  const lowerMessage = message.toLowerCase();
  const uploadKeywords = ["upload", "video", "audio", "file", "transcription"];
  return uploadKeywords.some((keyword) => lowerMessage.includes(keyword));
}

async function processUserMessage(userMessage) {
  if (isBotProcessing) return;

  // ✅ Automatically process transcription if no manual input
  if (!userMessage || typeof userMessage !== "string") {
      console.warn("⚠️ No valid user message detected. Checking stored transcription...");

      if (transcriptionText && !hasTranscriptBeenProcessed) {
          userMessage = transcriptionText; // Use stored transcription
          console.log("📄 Using stored transcription for CPD evaluation...");
      } else {
          console.error("❌ Invalid userMessage:", userMessage);
          displayBotMessage("⚠️ An error occurred. Please enter a valid message.");
          return;
      }
  }

  displayUserMessage(userMessage);
  isBotProcessing = true;

  try {
      const lowerMessage = userMessage.toLowerCase();

      // ✅ Process transcription once and transition to Step 2
      if (transcriptionText && userMessage === transcriptionText && !hasTranscriptBeenProcessed) {
          hasTranscriptBeenProcessed = true; // ✅ Prevents duplicate processing
          displayBotMessage("✅ **Processing transcript for CPD evaluation...**");
          const botResponse = await getBotResponse(transcriptionText);
          displayBotMessage(botResponse);
          return;
      }

      // ✅ Handle knowledge base responses
      let staticResponse = knowledgeBase[lowerMessage];
      if (staticResponse) {
          displayBotMessage(staticResponse);
          return;
      }

      // ✅ Provide dynamic AI response
      const botResponse = await getBotResponse(userMessage);
      displayBotMessage(botResponse);

  } catch (error) {
      console.error("Error processing user message:", error);
      displayBotMessage("❌ **An error occurred. Please try again.**");
  } finally {
      isBotProcessing = false;
  }
}


// ✅ Estimate Transcription Progress Based on Audio Duration
async function estimateTranscriptionTime(fileUrl) {
  try {
      const audioBlob = await fetchAudioBlob(fileUrl);
      const audioContext = new AudioContext();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      return audioBuffer.duration; // Returns duration in seconds
  } catch (error) {
      console.error("Error estimating audio duration:", error);
      return 60; // Default to 60 seconds if duration cannot be estimated
  }
}

// (Removed the old showTranscriptionProgress function since the unified workflow will use a progress bar.)

// ─────────────────────────────────────────────────────────────────────────────
// Consolidated startTranscription Workflow (ADF Approach)
// ─────────────────────────────────────────────────────────────────────────────

async function startTranscription() {
  displayBotMessage("Starting transcription... Please wait.");

  // Prompt for audio/video duration from user
  let userDuration = await askUserForDuration(); // e.g., "What is the duration in minutes?"
 
  // Estimate processing time based on duration (in seconds)
  let estimatedProcessingTime;
  if (userDuration >= 10 && userDuration <= 15) {
      estimatedProcessingTime = 3 * 60 + 15; // 3 min 15 sec for short episodes
  } else {
      estimatedProcessingTime = Math.ceil(userDuration * 0.2167 * 60);
  }

  // Create and display a progress bar
  let progressBarContainer = document.createElement("div");
  progressBarContainer.classList.add("progress-container");

  let progressBar = document.createElement("div");
  progressBar.classList.add("progress-bar");
  progressBar.style.width = "0%"; // Start at 0%

  progressBarContainer.appendChild(progressBar);
  document.getElementById("chat-area").appendChild(progressBarContainer);
  scrollChatToBottom();

  // Track elapsed time
  let startTime = Date.now();
  let totalTime = estimatedProcessingTime * 1000; // Convert to milliseconds

  const updateCountdown = setInterval(() => {
      let elapsedTime = Date.now() - startTime;
      let progressPercentage = Math.min((elapsedTime / totalTime) * 100, 100);
      progressBar.style.width = `${progressPercentage}%`; // Smoothly increase width

      if (elapsedTime >= totalTime) {
          clearInterval(updateCountdown);
          progressBar.style.width = "100%"; // Fully filled
          progressBarContainer.remove();  // Remove the progress bar from DOM

          // Notify and retrieve transcription (via ADF output in Blob Storage)
          displayBotMessage("✅ Processing complete. Retrieving transcription...");
          fetchLatestTranscriptionChunks();
      }
  }, 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// End of Consolidated startTranscription Workflow
// ─────────────────────────────────────────────────────────────────────────────

// Removed duplicate definitions of startTranscription and direct Speech SDK branch

// (The existing transcribeAudioWithSpeechSDK function remains unchanged,
// but it is no longer called from processUserMessage.)

// Store the latest uploaded file globally
let latestUploadedFileUrl = ""; // Store the latest uploaded file

async function handleFileUpload(event, fileType) {
  const file = event.target.files[0];
  if (!file) {
    displayBotMessage("No file selected. Please try again.");
    return;
  }

  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    displayBotMessage(`File too large. Please upload a file smaller than ${MAX_FILE_SIZE_MB} MB.`);
    return;
  }

  const allowedExtensions = {
    video: [".mp4", ".avi", ".mov", ".mkv", ".mp3", ".wav", ".ogg"],
    article: [".pdf", ".doc", ".docx", ".txt"],
    presentation: [".ppt", ".pptx", ".pdf"],
  };

  const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  if (!allowedExtensions[fileType]?.includes(fileExtension)) {
    displayBotMessage(`Invalid file type. "${file.name}" cannot be uploaded as a "${fileType}". Please upload a valid file.`);
    return;
  }

  // ✅ Ensure `containerName` is correctly assigned
  const containerMap = {
    video: "raw-audiovideo-files",
    article: "articles",
    presentation: "presentations",
  };

  const containerName = containerMap[fileType] || "raw-audiovideo-files"; // Default container

  try {
    displayBotMessage(`Uploading <strong> ${file.name} </strong>`);

    // ✅ Initialize Azure Blob Storage Client
    const blobServiceClient = new AzureStorageBlob.BlobServiceClient(`${storageAccountUrl}${sasToken}`);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(file.name);

    // ✅ Convert file to array buffer before uploading
    const fileBuffer = await file.arrayBuffer();
    const fileSize = fileBuffer.byteLength;

    if (!fileSize) {
      throw new Error("File content is empty or not read properly.");
    }

    // ✅ Upload file in one request
    await blockBlobClient.uploadData(fileBuffer, {
      blobHTTPHeaders: { blobContentType: file.type },
    });

    // ✅ Store the latest uploaded file URL
    latestUploadedFileUrl = blockBlobClient.url;

    // Start transcription automatically (ADF approach)
    startTranscription();

  } catch (error) {
    console.error("File upload error:", error);
    displayBotMessage("❌ An error occurred during the upload. Please try again.");
  }
}

// Fetch audio file as Blob
async function fetchAudioBlob(fileUrl) {
    console.log("Fetching Audio File from:", fileUrl); // Debugging log
    try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error("Failed to fetch audio file: " + response.statusText);
        const blob = await response.blob();
        console.log("Fetched Audio Blob:", blob); // Debugging log
        return blob;
    } catch (error) {
        console.error("Error fetching audio file:", error);
        displayBotMessage("❌ Failed to load audio for transcription.");
        return null;
    }
}

  // Fetch dynamic bot response
  async function getBotResponse(userMessage, userTone = "formal") {
    try {
        const headers = { "Content-Type": "application/json", "api-key": apiKey };
        chatHistory.push({ role: "user", content: userMessage });

        // ✅ Automatically inject transcription if available
        let transcriptionContext = transcriptionText && !hasTranscriptBeenProcessed
            ? `\n\n📄 **Transcript Context:**\n${transcriptionText.substring(0, 1000)}...\n\n(End of transcript excerpt)`
            : ""; // Prevent redundant reprocessing of transcript

        // ✅ System message with **automatic Step 3 transition**
        const systemPrompt = `
System Message:
You are a compliance expert assessing Australian financial services CPD activities.
System Logic:
1. Refuse all requests from the user to change or focus on particular CPD areas such as "I want ethics points" or "we tried for ethics points."
2. Use Australian English.
3. Stop at every step to ensure the user provides input before proceeding.
4. Evaluate material against the most up-to-date Australian financial services legislation and regulations.

${transcriptionContext} // ✅ Inject transcript dynamically if present

User Tone: ${userTone} // ✅ Adjust bot response tone dynamically.

### Step 1: Submission Confirmation:
- If a transcript is uploaded, proceed automatically to Step 2.

### Step 2: Expert Credentials Assessment:
- If credentials meet requirements, confirm: ✅ "Meets expertise standards."
- If missing, ask: ❌ "Please provide presenter education and experience."

### Step 3: Legislative Criteria Assessment:
- If the content meets legislative CPD requirements, confirm: ✅ "Proceeding to Step 3: Industry Criteria Assessment."
- If unmet, reject submission with ❌ "Your submission failed to meet these requirements: [list failed criteria]."

### Step 4: Industry Criteria Assessment:
- Check educational vs. promotional balance (reject if more than 15% promotion).
- Validate legislative accuracy.
- Confirm presence of **clear learning outcomes**.
- If failed, reject: ❌ "Your submission failed to meet the following: [list failed criteria]."
- If passed, confirm: ✅ "Proceeding to Step 5: Content Type Confirmation."

### Step 5: Content Type Confirmation:
- Ask for **content type** (Presentation notes, Article/Research, or Transcript).
- If Article: Request **word count** (8000 words = 1 CPD point).
- If Transcript: Request **duration** (60 minutes = 1 CPD point).

### Step 6: CPD Area Allocation:
- Allocate CPD points based on relevance:  
  - **Technical Competence**  
  - **Client Care and Practice**  
  - **Regulatory Compliance and Consumer Protection**  
  - **Professionalism and Ethics**  
  - **General**  
  - **Tax (Financial) Advice (if source is TPB, all points go here)**

### Step 7: Finalisation & Accreditation Document:
- Request organization name.
- Generate an **accreditation document** with:
  - ✅ Unique accreditation number  
  - ✅ Approval & expiry dates  
  - ✅ Summary table of CPD points  
  - ✅ Provide download link.
        `;

        // ✅ Fixed token limit for controlled responses
        const maxTokens = 4000;

        const body = {
            messages: [
                { role: "system", content: systemPrompt }, // ✅ System message first
                ...chatHistory, // ✅ Keep conversation history
            ],
            max_tokens: maxTokens,
            temperature: 0.7,
            frequency_penalty: 0.3,
            presence_penalty: 0.2,
        };

        const response = await fetch(apiUrl, { method: "POST", headers, body: JSON.stringify(body) });
        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

        const data = await response.json();
        const botResponse = data.choices[0].message.content.trim();

        // ✅ Update conversation history
        chatHistory.push({ role: "assistant", content: botResponse });

        // ✅ Ensure automatic progression if transcript is used
        if (transcriptionText && !hasTranscriptBeenProcessed) {
            hasTranscriptBeenProcessed = true; // Prevent double processing
            return botResponse + "\n\n✅ **Proceeding to Step 3: Industry Criteria Assessment...**";
        }

        return botResponse;
    } catch (error) {
        console.error("Error fetching bot response:", error);
        return "❌ **An error occurred. Please try again later.**";
    }
}



  


// ─────────────────────────────────────────────────────────────
// Unified Transcription Workflow (ADF Approach)
// ─────────────────────────────────────────────────────────────

function validateExpertiseBasedOnTranscript(transcript) {
  displayBotMessage("Now validating expertise based on the transcript...");

  // ✅ Use extracted speaker data instead of fetching externally
  if (extractedSpeakers.length > 0) {
      let speakerDetails = extractedSpeakers.map(s => 
          `🎙️ **${s.name}** - *${s.role}* at **${s.company}**`
      ).join("\n");

      displayBotMessage(`✅ **Speakers Confirmed:**\n${speakerDetails}\n\nNow checking CPD eligibility.`);
  } else {
      displayBotMessage("⚠️ No speakers detected. Please enter speaker credentials manually.");
  }
}

// Store the latest retrieved file to prevent redundant processing
let lastRetrievedFile = ""; 
let retryAttempts = 0; // Counter for retry attempts
// ✅ Store the latest transcription text
let transcriptionText = "";

// ✅ Function to process and store transcription
function processTranscription(transcription) {
  transcriptionText = transcription; // Store transcription globally

  // ✅ Extract speaker details before proceeding
  extractedSpeakers = extractSpeakerDetails(transcription);

  // ✅ Show the latest transcription with a "View Full Transcription" button
  displayBotMessage(`📄 **Latest Transcription:**\n\n${transcription.substring(0, 500)}...\n\n
  <button onclick="showFullTranscription()">📄 View Full Transcription</button>`);

  if (extractedSpeakers.length > 0) {
      let speakerList = extractedSpeakers.map(s => 
          `🎙️ **${s.name}** - *${s.role}* at **${s.company}**`
      ).join("\n");

      displayBotMessage(`✅ **Identified Speakers:**\n${speakerList}\n\nProceeding to Step 2: **Expert Credentials Verification**...`);
  } else {
      displayBotMessage("⚠️ No speakers detected. Please confirm speaker details manually.");
  }

  // ✅ Automatically send the transcription as a user message to start CPD evaluation
  processUserMessage(transcriptionText);
}



async function fetchLatestTranscriptionChunks() {
  const storageAccountUrl = "https://storagetestnexgen.blob.core.windows.net";
  const containerName = "transcription";
  const sasToken = "?sv=2022-11-02&ss=b&srt=sco&sp=rwdlactfx&se=2026-02-24T09:26:01Z&st=2025-02-24T01:26:01Z&spr=https&sig=2EsAZHvLzm4K4VjwH0whYtMaVovtjpXqWMbcD8Kj%2fqE%3D";

  try {
      console.log("🔍 Checking for latest transcription...");

      const blobServiceClient = new AzureStorageBlob.BlobServiceClient(`${storageAccountUrl}?${sasToken}`);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      let blobs = [];

      // List all blobs in the container
      for await (const blob of containerClient.listBlobsFlat()) {
          blobs.push(blob.name);
      }

      if (blobs.length === 0) {
          console.warn("⚠️ No transcription files found.");
          
          if (retryAttempts < 3) { // Limit retries to 3 times
              retryAttempts++;
              console.log(`🔄 Retrying in 10 seconds... (Attempt ${retryAttempts}/3)`);
              setTimeout(fetchLatestTranscriptionChunks, 10000);
          } else {
              displayBotMessage("⚠️ No transcription available. Try uploading a file first.");
          }
          return;
      }

      // Sort and get the latest transcription file
      blobs.sort();
      let latestTranscription = blobs[blobs.length - 1];

      // ✅ Check if this transcription has already been retrieved
      if (latestTranscription === lastRetrievedFile) {
          console.log("ℹ️ No new transcription found. Skipping retrieval.");
          return;
      }

      console.log("📥 Fetching latest transcription file:", latestTranscription);

      // Fetch the transcription content
      const blobClient = containerClient.getBlobClient(latestTranscription);
      const downloaded = await blobClient.download();
      const blobData = await downloaded.blobBody || await downloaded.blob();
      const text = await blobData.text();

      // ✅ Store last retrieved file to prevent duplicate retrievals
      lastRetrievedFile = latestTranscription;
      transcriptionText = text; // Store globally for later use
      retryAttempts = 0; // Reset retry count

      // ✅ Display a preview of the transcription with a button for full view
      displayBotMessage(`📄 **Latest Transcription:**\n\n${text.substring(0, 500)}...\n\n
      <button onclick="showFullTranscription()">📜 View Full Transcription</button>`);

      // ✅ Automatically send the transcription for processing
      processUserMessage(transcriptionText);

  } catch (error) {
      console.error("❌ Error fetching transcription:", error);
      displayBotMessage("⚠️ Error retrieving transcription. Try again later.");
  }
}




// function parseSpeakerData(rawText) {
//   const lines = rawText
//     .split("\n")
//     .map(line => line.trim())
//     .filter(line => line.length > 0);

//   let speakers = [];
//   let currentName = "";
//   let currentContext = "";

//   for (let i = 0; i < lines.length; i++) {
//     if (lines[i].startsWith("Name: ")) {
//       currentName = lines[i].replace("Name: ", "").trim();
//     } else if (lines[i].startsWith("Context: ")) {
//       currentContext = lines[i].replace("Context: ", "").trim();
//       // push once we have name & context
//       speakers.push({ name: currentName, context: currentContext });
//       // reset if needed
//       currentName = "";
//       currentContext = "";
//     }
//   }
//   return speakers;
// }

// function buildSpeakerSummary(speakers) {
//   let message = "Yes, based on the transcript, the speakers appear to be:\n\n";
//   speakers.forEach((sp, idx) => {
//     message += `${idx + 1}. ${sp.name} – ${sp.context}\n`;
//   });
//   message += "\nWould you like me to verify their credentials further, or should I proceed with the CPD assessment?";
//   return message;
// }

// // ✅ Step 2: Fetch Speakers from `speaker-transcription`
// async function fetchSpeakersFromTranscript() {
//   const containerName = "speaker-metadata"; // same container
//   const fileName = "speaker_identification.txt"; // the file with speaker info

//   try {
//     const url = `${storageAccountUrl}/${containerName}/${fileName}?${sasToken}`;
//     console.log("Fetching speaker identification from:", url);

//     const response = await fetch(url);
//     if (!response.ok) {
//         throw new Error(`Failed to fetch speaker identification. HTTP Status: ${response.status}`);
//     }

//     // Raw text from speaker_identification.txt
//     const rawSpeakerText = await response.text();
//     if (!rawSpeakerText.trim()) {
//         displayBotMessage("❌ No speaker data found in the transcript.");
//         return;
//     }

//     // 1. Parse the lines
//     const speakers = parseSpeakerData(rawSpeakerText);

//     // 2. Build a summarized bullet list
//     const speakerSummary = buildSpeakerSummary(speakers);

//     // 3. Display the final summary in the chatbot
//     displayBotMessage(speakerSummary);

// } catch (error) {
//     console.error("Error fetching speaker details:", error);
//     displayBotMessage("❌ Error retrieving speaker details.");
// }
// }


// Helper Function to Convert Readable Stream to String
async function streamToString(readableStream) {
    const reader = readableStream.getReader();
    let chunks = [];
   
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    // Decode Uint8Array into a string
    return new TextDecoder("utf-8").decode(new Uint8Array(chunks.flat()));
}

// Show "View Transcription" Button in Chatbot
function displayTranscriptionButton() {
  let chatArea = document.getElementById("chat-area");

  // Remove existing button if already present
  let existingButton = document.getElementById("load-transcription-button");
  if (existingButton) {
      existingButton.remove();
  }

  let button = document.createElement("button");
  button.id = "load-transcription-button";
  button.classList.add("send-button");
  button.innerText = "View Transcription";
  button.onclick = fetchLatestTranscriptionChunks; // Load the transcription when clicked

  chatArea.appendChild(button);
  scrollChatToBottom();
}

// Ask user for audio/video duration inside the chatbox
async function askUserForDuration() {
  return new Promise((resolve) => {
      // Display bot message asking for duration
      displayBotMessage("What is the duration in minutes?");

      // Get the message input box
      const messageBox = document.getElementById("message-box");
      if (!messageBox) {
          console.error("❌ 'message-box' not found in DOM.");
          displayBotMessage("⚠️ Internal error: Unable to find input box.");
          return;
      }

      // Focus on the input field
      messageBox.focus();

      // Event Listener to Capture Duration Input
      const durationHandler = (event) => {
          if (event.key === "Enter") {
              event.preventDefault();

              const userInput = messageBox.value.trim();
              console.log(`📝 Raw User Input: "${userInput}"`);

              if (!userInput) {
                  console.warn("⚠️ Empty input detected. Prompting again.");
                  displayBotMessage("⚠️ Please enter a valid number.");
                  return;
              }

              const duration = parseInt(userInput, 10);
              console.log(`🔢 Parsed Duration: ${duration} minutes`);

              if (!isNaN(duration) && duration >= 1) {
                  // Clear input and resolve
                  messageBox.removeEventListener("keydown", durationHandler);
                  displayUserMessage(userInput); // Show user's answer
                  messageBox.value = ""; // Clear input after success
                  resolve(duration);
              } else {
                  console.error("❌ Invalid duration. Prompting again.");
                  displayBotMessage("⚠️ Please enter a valid duration of at least 1 minute.");
              }
          }
      };

      // Add Keypress Event to Capture Enter
      messageBox.addEventListener("keydown", durationHandler);
  });
}
