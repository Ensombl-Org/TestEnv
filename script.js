//script.js backup
// Variables
let userName = ""; // Store user's name
let chatHistory = []; // Store conversation context
const apiKey = "F5TTEZU13jwfovrhBsfw5c1yqu8yL2iUDXHavU1YUA1WM13QUtsZJQQJ99BBACL93NaXJ3w3AAABACOGijkq"; // Azure OpenAI API key
const apiUrl = "https://testingenvnexgen.openai.azure.com/openai/deployments/gpt-4TestEnv/chat/completions?api-version=2024-08-01-preview"; // Azure OpenAI endpoint
const storageAccountUrl = "https://storagetestnexgen.blob.core.windows.net"; // Azure Blob Storage URL
const sasToken = "?sv=2022-11-02&ss=b&srt=sco&sp=rwdlactfx&se=2026-02-24T09:26:01Z&st=2025-02-24T01:26:01Z&spr=https&sig=2EsAZHvLzm4K4VjwH0whYtMaVovtjpXqWMbcD8Kj%2FqE%3D"; // SAS token for uploads
const speechApiKey = "2DYSW1vTUTMnuJD50oxsDOrYOgreD3fNeT787DT1myx9Ro5wdaXmJQQJ99BBACL93NaXJ3w3AAAYACOGcj5N"; // Azure Speech API key
const speechEndpoint = "https://australiaeast.api.cognitive.microsoft.com/"; // Azure Speech Service endpoint
const speechRegion = "australiaeast";
let isBotProcessing = false; // Prevent overlapping responses
let lastUploadedFileUrl = ""; // Store last uploaded file URL for transcription
const MAX_FILE_SIZE_MB = 10240; // 10GB Maximum file size for uploads

// Knowledge Base for Static Responses
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

// Attach Event Listeners on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  const videoUpload = document.getElementById("video-upload");
  const articleUpload = document.getElementById("article-upload");
  const presentationUpload = document.getElementById("presentation-upload");

  videoUpload.addEventListener("change", (event) => handleFileUpload(event, "video"));
  articleUpload.addEventListener("change", (event) => handleFileUpload(event, "article"));
  presentationUpload.addEventListener("change", (event) => handleFileUpload(event, "presentation"));

  document.getElementById("message-box").addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      processUserMessage(event.target.value);
      event.target.value = ""; // Clear the input field
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


// Detect user intention for uploading files
function detectFileUploadIntent(message) {
  const lowerMessage = message.toLowerCase();
  const uploadKeywords = ["upload", "video", "audio", "file", "transcription"];
  return uploadKeywords.some((keyword) => lowerMessage.includes(keyword));
}

// Process user messages
async function processUserMessage(userMessage) {
  if (isBotProcessing) return;

  displayUserMessage(userMessage);
  isBotProcessing = true;

  try {
      if (userMessage.toLowerCase() === "yes" && lastUploadedFileUrl) {
          displayBotMessage("🕒 Transcription in progress... Please wait.");
          
          // Estimate transcription time and show progress updates
          const estimatedDuration = await estimateTranscriptionTime(lastUploadedFileUrl);
          const progressInterval = await showTranscriptionProgress(estimatedDuration);

          // Perform transcription
          const transcription = await transcribeAudioWithSpeechSDK(lastUploadedFileUrl);

          // Stop progress updates once transcription is done
          clearInterval(progressInterval);
          isBotProcessing = false;

          if (transcription) {
              //displayBotMessage("✅ **Transcription completed successfully.**");
              displayBotMessage(`📝 **Transcription Text:** ${transcription}`);
          } else {
              displayBotMessage("❌ **Transcription failed. Please try again.**");
          }
          lastUploadedFileUrl = "";
      } else if (userMessage.toLowerCase() === "no") {
          displayBotMessage("Transcription skipped. Let me know if you need any other assistance.");
          lastUploadedFileUrl = "";
      } else {
          const staticResponse = knowledgeBase[userMessage.toLowerCase()];
          if (staticResponse) {
              displayBotMessage(staticResponse);
          } else {
              const botResponse = await getBotResponse(userMessage);
              displayBotMessage(botResponse);
          }
      }
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

// ✅ Show Progress Updates while Transcribing
function showTranscriptionProgress() {
  const progressMessages = [
    "⏳ Transcribing audio... Please wait.",
    "🔄 Processing speech recognition...",
    "📝 Extracting text from audio...",
    "⏳ Almost done..."
  ];
  let index = 0;

  return setInterval(() => {
    if (!isBotProcessing) return;
    displayBotMessage(progressMessages[index % progressMessages.length]);
    index++;
  }, 5000);
  return progressInterval;
}

// 🎤 Transcribe Audio Using Azure Speech SDK
async function transcribeAudioWithSpeechSDK(fileUrl) {
  try {
    const estimatedDuration = await estimateTranscriptionTime(fileUrl);
    const progressInterval = await showTranscriptionProgress(estimatedDuration);

    const speechConfig = window.SpeechSDK.SpeechConfig.fromSubscription(speechApiKey, speechRegion);
    speechConfig.speechRecognitionLanguage = "en-US";

    const audioBlob = await fetchAudioBlob(fileUrl);
    const audioConfig = window.SpeechSDK.AudioConfig.fromWavFileInput(audioBlob);
    const recognizer = new window.SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

    return new Promise((resolve, reject) => {
      recognizer.recognizeOnceAsync(result => {
        if (result.reason === window.SpeechSDK.ResultReason.RecognizedSpeech) {
          resolve(result.text);
        } else {
          reject("Transcription failed.");
        }
      });
    });
  } catch (error) {
    console.error("Transcription error:", error);
    displayBotMessage("❌ Transcription error. Please try again.");
    return null;
  }
}


// ✅ Store the latest uploaded file globally
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

    //displayBotMessage(`✅ "${file.name}" uploaded successfully`);

    // ✅ Start transcription automatically
    startTranscription();

  } catch (error) {
    console.error("File upload error:", error);
    displayBotMessage("❌ An error occurred during the upload. Please try again.");
  }
}

// Transcribe audio using Azure Speech SDK
async function transcribeAudioWithSpeechSDK(fileUrl) {
    console.log("Starting transcription for:", fileUrl); // Debugging log
    try {
        const speechConfig = window.SpeechSDK.SpeechConfig.fromSubscription(speechApiKey, speechRegion);
        speechConfig.speechRecognitionLanguage = "en-US";
        console.log("Speech SDK Config Loaded"); // Debugging log

        const audioBlob = await fetchAudioBlob(fileUrl);
        console.log("Audio Blob fetched:", audioBlob); // Debugging log

        const audioConfig = window.SpeechSDK.AudioConfig.fromWavFileInput(audioBlob);
        console.log("Audio Config Loaded"); // Debugging log

        const recognizer = new window.SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
        console.log("Recognizer Created"); // Debugging log

        return new Promise((resolve, reject) => {
            recognizer.recognizeOnceAsync(result => {
                if (result.reason === window.SpeechSDK.ResultReason.RecognizedSpeech) {
                    console.log("Transcription Successful:", result.text); // Debugging log
                    resolve(result.text);
                } else {
                    console.log("Transcription Failed:", result.reason); // Debugging log
                    reject("Transcription failed. Reason: " + result.reason);
                }
            });
        });
    } catch (error) {
        console.error("Error during transcription:", error);
        displayBotMessage("❌ An error occurred while transcribing. Please try again.");
        return null;
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

      // ✅ Define System Message & Compliance Logic
      const systemPrompt = `
      You are a compliance expert assessing Australian financial services CPD activities.
      Your goal is to strictly evaluate CPD accreditation submissions according to legislation and industry standards.

      🔹 **System Rules:**
      1️⃣ Refuse all requests to change CPD areas (e.g., "I want ethics points").
      2️⃣ Use **Australian English**.
      3️⃣ **Stop at each step** and require user input before continuing.
      4️⃣ Evaluate content against **Australian financial services legislation & regulations**.

      🔹 **Evaluation Steps:**
      - **Step 1: Content Submission** → Require file upload.
      - **Step 2: Expert Credentials** → Validate expertise based on transcript.
      - **Step 3: Legislative Criteria** → Assess content against CPD rules.
      - **Step 4: Industry Standards** → Check compliance with industry expectations.
      - **Step 5: CPD Points Calculation** → Convert duration to points.
      - **Step 6: CPD Area Allocation** → Assign points based on content focus.

      🔹 **Response Style (User Tone Preference):**
      ${userTone === "formal" ? "- Use a professional tone with structured explanations." : ""}
      ${userTone === "friendly" ? "- Use a conversational and approachable style." : ""}
      ${userTone === "expert-level" ? "- Provide advanced insights with legislative references." : ""}
      `;

      // ✅ **Determine `max_tokens` Dynamically**
      let maxTokens = 1000; // Default for normal chatbot conversations

      if (userMessage.toLowerCase().includes("transcribe")) {
          maxTokens = 4000; // Transcription need more tokens
      } else if (userMessage.toLowerCase().includes("compliance")) {
          maxTokens = 3500; // Compliance assessment needs high context
      } else if (userMessage.toLowerCase().includes("cpd points")) {
          maxTokens = 3000; // CPD calculations require medium-length responses
      } else if (userMessage.toLowerCase().includes("summary")) {
          maxTokens = 2500; // Final summaries require concise responses
      }

      // ✅ Construct Message Payload
      const body = {
          messages: [
              { role: "system", content: systemPrompt }, // System message with compliance rules
              ...chatHistory, // Maintain user interaction history
          ],
          max_tokens: maxTokens, // 🔥 **Dynamically allocated tokens**
          temperature: userTone === "expert-level" ? 0.5 : 0.7, // Reduce randomness for expert mode
          frequency_penalty: 0.3, // Reduce repetitive responses
          presence_penalty: 0.2, // Encourage diverse responses
      };

      // ✅ Fetch AI Response
      const response = await fetch(apiUrl, { method: "POST", headers, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

      const data = await response.json();
      const botResponse = data.choices[0].message.content.trim();

      // ✅ Store conversation history
      chatHistory.push({ role: "assistant", content: botResponse });

      return botResponse;
  } catch (error) {
      console.error("Error fetching bot response:", error);
      return "❌ **An error occurred. Please try again later.**";
  }
}


// ✅ Function to handle transcription steps before loading chunks
async function startTranscription() {
    const progressMessages = [
        "⏳ Transcribing audio... Please wait.",
        "🔄 Processing speech recognition...",
        "📝 Extracting text from audio...",
        "⏳ Almost done..."
    ];
    
    let index = 0;
    let progressInterval = setInterval(() => {
        if (index < progressMessages.length) {
            displayBotMessage(progressMessages[index]);
            index++;
        } else {
            clearInterval(progressInterval);
            displayBotMessage("✅ **Transcription completed.**");

            // Dynamically add the "Load Transcription" button inside the chat area
            let chatArea = document.getElementById("chat-area");
            
            // Check if button already exists (avoid duplicates)
            let existingButton = document.getElementById("load-transcription-button");
            if (existingButton) {
                existingButton.remove();
            }

            let loadButton = document.createElement("button");
            loadButton.id = "load-transcription-button";
            loadButton.classList.add("send-button");
            loadButton.innerText = "Load Transcription";
            loadButton.onclick = waitForTranscriptionCompletion; // Wait for ADF to complete

            chatArea.appendChild(loadButton);
            scrollChatToBottom();
        }
    }, 5000);
}

// ✅ Wait for Transcription Completion (Secure ADF Monitoring)
async function startTranscription() {
    displayBotMessage("🕒 Starting transcription... Please wait.");
    
    // Call ADF completion checker before allowing transcription view
    await waitForTranscriptionCompletion();
}


//"View Transcription" button only appears after ADF completion.

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


// ✅ Fetch Latest Transcription Chunks from ADLS
async function fetchLatestTranscriptionChunks() {
    //displayBotMessage("⏳ Waiting for transcription to complete...");
    
    const storageAccountUrl = "https://storagetestnexgen.blob.core.windows.net";
    const containerName = "transcription";
    const sasToken = "sv=2022-11-02&ss=b&srt=sco&sp=rwdlactfx&se=2026-02-24T09:26:01Z&st=2025-02-24T01:26:01Z&spr=https&sig=2EsAZHvLzm4K4VjwH0whYtMaVovtjpXqWMbcD8Kj%2FqE%3D";

     try {
        const blobServiceClient = new AzureStorageBlob.BlobServiceClient(`${storageAccountUrl}?${sasToken}`);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        let blobs = [];

        // ✅ List all blobs in the transcription container
        for await (const blob of containerClient.listBlobsFlat()) {
            blobs.push(blob.name);
        }

        if (blobs.length === 0) {
            displayBotMessage("❌ No transcription found. Trying again in 10 seconds...");
            setTimeout(fetchLatestTranscriptionChunks, 10000); // Retry after 10 seconds
            return;
        }

        // ✅ Sort blobs alphabetically to get the latest chunk
        blobs.sort();
        let latestTranscription = blobs[blobs.length - 1]; // Get the newest transcription file

        // ✅ Fetch the transcription content
        const blobClient = containerClient.getBlobClient(latestTranscription);
        const response = await blobClient.download();
        const downloaded = await blobClient.download();
				const blobData = await downloaded.blobBody; // ✅ Use blobBody to get the Blob
				const text = await blobData.text(); // ✅ Read text content from the blob

        // ✅ Display the transcription text in the chatbot
        displayBotMessage(`📝 **Transcription:** ${text}`);

    } catch (error) {
        console.error("Error fetching transcription:", error);
        displayBotMessage("❌ Error retrieving transcription. Retrying in 10 seconds...");
        setTimeout(fetchLatestTranscriptionChunks, 10000); // Retry after 10 seconds
    }
}

// ✅ Helper Function to Convert Readable Stream to String
async function streamToString(readableStream) {
    const reader = readableStream.getReader();
    let chunks = [];
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }

    // ✅ Decode Uint8Array into a string
    return new TextDecoder("utf-8").decode(new Uint8Array(chunks.flat()));
}


// ✅ Show "View Transcription" Button in Chatbot
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
  button.innerText = "Load Transcription";
  // Handle button click to load transcription
  loadButton.onclick = async () => {
    loadButton.innerText = "Loading...";
    loadButton.disabled = true;

    try {
        await waitForTranscriptionCompletion();  // Call ADF or transcription logic
        loadButton.innerText = "View Transcription";
    } catch (error) {
        loadButton.innerText = "Retry";
        console.error("Error during transcription:", error);
    } finally {
        loadButton.disabled = false;
    }
  };
  // button.onclick = fetchLatestTranscriptionChunks; // Load the transcription when clicked
  // Append button and scroll to bottom
  chatArea.appendChild(button);
  scrollChatToBottom();
}


// ✅ Ask user for audio/video duration inside the chatbox
async function askUserForDuration() {
  return new Promise((resolve) => {
      // ✅ Display bot message asking for duration
      displayBotMessage("⏳ What is the duration in minutes?");

      // ✅ Get the message input box
      const messageBox = document.getElementById("message-box");
      if (!messageBox) {
          console.error("❌ 'message-box' not found in DOM.");
          displayBotMessage("⚠️ Internal error: Unable to find input box.");
          return;
      }

      // ✅ Focus on the input field
      messageBox.focus();

      // ✅ Event Listener to Capture Duration Input
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
                  // ✅ Clear input and resolve
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

      // ✅ Add Keypress Event to Capture Enter
      messageBox.addEventListener("keydown", durationHandler);
  });
}




// ✅ Automatically Display Button After Countdown (Faster Processing)
async function waitForTranscriptionCompletion() {
  let userDuration = await askUserForDuration(); // Ask user for duration
  let estimatedProcessingTime;

  if (userDuration >= 10 && userDuration <= 15) {
      estimatedProcessingTime = 3 * 60 + 15; // 3 min 15 sec for Short Episodes
  } else {
      estimatedProcessingTime = Math.ceil(userDuration * 0.2167 * 60); // Convert to seconds for longer durations
  }

  // ✅ Replace estimated time message with "Waiting for transcription to complete..."
  let countdownMessage = null;  // No need to display this message


  // ✅ Create Progress Bar
  let progressBarContainer = document.createElement("div");
  progressBarContainer.classList.add("progress-container");

  let progressBar = document.createElement("div");
  progressBar.classList.add("progress-bar");
  progressBar.style.width = "0%"; // Start at 0%

  progressBarContainer.appendChild(progressBar);
  document.getElementById("chat-area").appendChild(progressBarContainer);

  // ✅ Track real elapsed time to avoid drift
  let startTime = Date.now();
  let totalTime = estimatedProcessingTime * 1000; // Convert to milliseconds

  const updateCountdown = setInterval(() => {
      let elapsedTime = Date.now() - startTime;
      let progressPercentage = Math.min((elapsedTime / totalTime) * 100, 100);
      progressBar.style.width = `${progressPercentage}%`; // Smoothly increase width

      if (elapsedTime >= totalTime) {
          clearInterval(updateCountdown);
          progressBar.style.width = "100%"; // Fully filled
          progressBarContainer.remove();  // Clean up progress bar


          // ✅ Safely remove "Waiting for transcription..." message
          if (countdownMessage && countdownMessage.remove) {
              countdownMessage.remove();
          }

          //displayBotMessage("🕒 **Processing complete. Preparing transcription...**");

          // ✅ Ensure "View Transcription" button appears **exactly** at the right time
          setTimeout(() => {
            //  displayBotMessage("✅ **Transcription is ready! Click below to view.**");
              
              // ✅ Ensure the button is created
              fetchLatestTranscriptionChunks();
          }, 1000); // Short delay to ensure smooth transition
      }
  }, 1000); // Update every second
}


// ✅ Ensure this function exists
function displayTranscriptionButton() {
    let chatArea = document.getElementById("chat-area");

    // Prevent duplicate buttons
    if (!document.getElementById("load-transcription-button")) {
        let button = document.createElement("button");
        button.id = "load-transcription-button";
        button.classList.add("send-button");
        button.innerText = "View Transcription";
        button.onclick = fetchLatestTranscriptionChunks; // Load the transcription when clicked

        chatArea.appendChild(button);
        scrollChatToBottom();
    }
}







