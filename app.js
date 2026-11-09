// JavaScript App Logic: High Performance, Offline Fallbacks & Interactive Scam Analyzer

document.addEventListener('DOMContentLoaded', () => {
  // DOM Element References
  const tabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const fileInput = document.getElementById('file-upload');
  const fileNameDisplay = document.getElementById('file-name');
  const textInput = document.getElementById('scam-text-input');
  const phoneInput = document.getElementById('phone-input');
  const phoneNotes = document.getElementById('phone-notes');

  const analyzeTextBtn = document.getElementById('analyze-text-btn');
  const analyzePhoneBtn = document.getElementById('analyze-phone-btn');
  const analyzeVoiceBtn = document.getElementById('analyze-voice-btn');

  const resultSection = document.getElementById('result-section');
  const riskBadge = document.getElementById('risk-badge');
  const scoreBar = document.getElementById('score-bar');
  const scoreValue = document.getElementById('score-value');
  const breakdownList = document.getElementById('breakdown-list');
  const adviceList = document.getElementById('advice-list');

  const micBtn = document.getElementById('mic-btn');
  const micStatus = document.getElementById('mic-status');
  const speechPreview = document.getElementById('speech-preview');
  const transcriptText = document.getElementById('transcript-text');

  const profileBtn = document.getElementById('profile-btn');
  const profileModal = document.getElementById('profile-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const sampleBtns = document.querySelectorAll('.sample-btn');
  const offlineBanner = document.getElementById('offline-banner');

  let isRecording = false;
  let recognition = null;

  // Connection Monitoring for Low Latency / Unstable Networks
  function updateOnlineStatus() {
    if (!navigator.onLine) {
      offlineBanner.classList.remove('hidden');
    } else {
      offlineBanner.classList.add('hidden');
    }
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // Tab Switching Logic
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tabContents.forEach(c => c.classList.add('hidden'));

      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const activeTabId = `${tab.dataset.tab}-tab`;
      document.getElementById(activeTabId).classList.remove('hidden');
    });
  });

  // File Upload Display
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      fileNameDisplay.textContent = e.target.files[0].name;
    } else {
      fileNameDisplay.textContent = 'No file selected';
    }
  });

  // Voice Speech Recognition Setup (Web Speech API)
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      transcriptText.textContent = transcript;
      speechPreview.classList.remove('hidden');
      analyzeVoiceBtn.classList.remove('hidden');
      stopRecording();
    };

    recognition.onerror = () => {
      micStatus.textContent = 'Error. Tap to Try Again';
      stopRecording();
    };

    recognition.onend = () => {
      stopRecording();
    };
  } else {
    micStatus.textContent = 'Voice API Not Supported';
  }

  micBtn.addEventListener('click', () => {
    if (!recognition) {
      alert('Speech recognition is not supported in this browser version. You can type your explanation in the text area!');
      return;
    }

    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  });

  function startRecording() {
    isRecording = true;
    micBtn.classList.add('recording');
    micStatus.textContent = 'Listening...';
    try {
      recognition.start();
    } catch (e) {
      console.log('Recognition already started');
    }
  }

  function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('recording');
    if (micStatus.textContent === 'Listening...') {
      micStatus.textContent = 'Tap to Speak';
    }
  }

  // Sample Scams Pre-loading
  const sampleData = {
    bank: "ALERT: Your Chase bank account has been locked due to suspicious activity. Click http://chase-security-update.com immediately to restore access.",
    prize: "Congratulations! You have won a $1,000 Walmart Gift Card! Call +1 (800) 555-0199 now to claim your reward. Shipping fee of $5 required.",
    tech: "Hello, this is Steve calling from Microsoft Tech Support. We noticed a dangerous virus on your computer. Please download AnyDesk so I can fix it."
  };

  sampleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.sample;
      textInput.value = sampleData[type];
      document.getElementById('tab-text').click();
      runAnalysis(sampleData[type], 'message');
    });
  });

  // Event Listeners for Analysis Buttons
  analyzeTextBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (!text && fileInput.files.length === 0) {
      alert('Please paste text or select a file to analyze.');
      return;
    }
    const contentToAnalyze = text || `Uploaded File: ${fileInput.files[0].name}`;
    runAnalysis(contentToAnalyze, 'message');
  });

  analyzePhoneBtn.addEventListener('click', () => {
    const phone = phoneInput.value.trim();
    const notes = phoneNotes.value.trim();
    if (!phone) {
      alert('Please enter a phone number.');
      return;
    }
    runAnalysis(`${phone} - ${notes}`, 'phone');
  });

  analyzeVoiceBtn.addEventListener('click', () => {
    const voiceText = transcriptText.textContent;
    if (!voiceText) return;
    runAnalysis(voiceText, 'voice');
  });

  // Core Scam Analysis Engine (Client-Side for Instant Offline / Low Latency Speed)
  function runAnalysis(input, source) {
    resultSection.classList.remove('hidden');
    resultSection.scrollIntoView({ behavior: 'smooth' });

    let score = 15; // Base risk score
    const flags = [];
    const advice = [];

    const lowerStr = input.toLowerCase();

    // Key Scam Patterns Check
    if (lowerStr.includes('urgent') || lowerStr.includes('alert') || lowerStr.includes('immediately') || lowerStr.includes('locked')) {
      score += 30;
      flags.push({ text: "<strong>Artificial Urgency:</strong> Scammers push you to act quickly before you have time to double-check.", level: "high" });
    }

    if (lowerStr.includes('click') || lowerStr.includes('http') || lowerStr.includes('.com') || lowerStr.includes('link')) {
      score += 25;
      flags.push({ text: "<strong>Suspicious Link Detected:</strong> Phishing links clone real websites to steal your passwords or banking info.", level: "high" });
    }

    if (lowerStr.includes('bank') || lowerStr.includes('chase') || lowerStr.includes('microsoft') || lowerStr.includes('irs') || lowerStr.includes('walmart')) {
      score += 20;
      flags.push({ text: "<strong>Brand Impersonation:</strong> Scammers frequently claim to represent trusted companies, banks, or government agencies.", level: "medium" });
    }

    if (lowerStr.includes('won') || lowerStr.includes('gift card') || lowerStr.includes('prize') || lowerStr.includes('fee')) {
      score += 25;
      flags.push({ text: "<strong>Too-Good-To-Be-True Offer:</strong> Demanding upfront fees or gift cards to release winnings is a classic fraud tactic.", level: "high" });
    }

    if (lowerStr.includes('virus') || lowerStr.includes('support') || lowerStr.includes('anydesk') || lowerStr.includes('remote')) {
      score += 30;
      flags.push({ text: "<strong>Remote Access Request:</strong> Legitimate tech support will never call unprompted to request access to your computer.", level: "high" });
    }

    if (flags.length === 0) {
      flags.push({ text: "<strong>No obvious automated red flags found:</strong> However, always stay cautious if an unknown sender asks for personal info.", level: "low" });
      score = 20;
    }

    score = Math.min(score, 98);

    // Update UI elements
    scoreBar.style.width = `${score}%`;
    scoreValue.textContent = `${score}%`;

    if (score >= 70) {
      riskBadge.textContent = "High Risk Scam";
      riskBadge.className = "risk-badge high";
      scoreBar.style.backgroundColor = "var(--danger-color)";
      advice.push("Do NOT click any links, open attachments, or reply to this message.");
      advice.push("Do NOT share any personal info, passwords, or gift card numbers.");
      advice.push("If it claims to be your bank or service, call the official number on your physical card or official website directly.");
    } else if (score >= 40) {
      riskBadge.textContent = "Moderate Suspicion";
      riskBadge.className = "risk-badge medium";
      scoreBar.style.backgroundColor = "var(--warning-color)";
      advice.push("Verify the identity of the sender using a separate trusted contact method.");
      advice.push("Avoid clicking embedded links. Type the official URL into your browser directly.");
    } else {
      riskBadge.textContent = "Likely Safe / Low Risk";
      riskBadge.className = "risk-badge low";
      scoreBar.style.backgroundColor = "var(--success-color)";
      advice.push("Looks normal, but stay vigilant when sharing sensitive financial details.");
    }

    // Populate Lists
    breakdownList.innerHTML = flags.map(f => `<li class="flag-${f.level}">${f.text}</li>`).join('');
    adviceList.innerHTML = advice.map(a => `<li>${a}</li>`).join('');

    // Save to Local User Profile / History
    saveToHistory(input.substring(0, 30) + '...', score);
  }

  // Profile Modal Event Handlers
  profileBtn.addEventListener('click', () => profileModal.classList.remove('hidden'));
  closeModalBtn.addEventListener('click', () => profileModal.classList.add('hidden'));
  window.addEventListener('click', (e) => {
    if (e.target === profileModal) profileModal.classList.add('hidden');
  });

  function saveToHistory(itemText, score) {
    const historyList = document.getElementById('history-list');
    const li = document.createElement('li');
    li.innerHTML = `<strong>${itemText}</strong>: Risk Score ${score}% (${score >= 70 ? 'High' : 'Moderate/Low'})`;
    historyList.prepend(li);

    const countElem = document.getElementById('scam-count');
    countElem.textContent = parseInt(countElem.textContent || 0) + 1;
  }
});
